import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import db from "./db.js";
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  destroySession,
  requireAuth,
  type SessionUser,
} from "./auth.js";
import {
  shouldSkipPasswordCheck,
  shouldUseCaseSensitiveSearch,
  shouldInvertPriceSort,
  shouldIgnoreQuantityInTotal,
  shouldBypassApiAuth,
  shouldSkipApiPasswordCheck,
  shouldIgnoreApiInStockFilter,
  shouldAllowOverstockCart,
  shouldIgnoreIdempotency,
  shouldUseGlobalFlaky,
} from "./bugs.js";
import type { HonoVars } from "./types.js";

const api = new Hono<{ Variables: HonoVars }>();

db.exec(`
  CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    order_id INTEGER NOT NULL REFERENCES orders(id),
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const flakyAttempts = new Map<string, number>();
let globalFlakyAttempts = 0;
const flakyFailCount = Number.parseInt(process.env.FLAKY_FAILS || "2", 10);

async function readJson(c: any) {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

function requireApiUser(c: any): SessionUser | null {
  const user = requireAuth(c);
  if (!user && shouldBypassApiAuth()) {
    const row = db
      .prepare(`SELECT id, email, name FROM users ORDER BY id LIMIT 1`)
      .get() as SessionUser | undefined;
    if (row) return row;
  }
  return user ?? null;
}

function getCartCount(userId: number): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id = ?`
    )
    .get(userId) as any;
  return row.count;
}

function findCartItem(userId: number, id: number) {
  let row = db
    .prepare(`SELECT id, product_id, quantity FROM cart_items WHERE id = ? AND user_id = ?`)
    .get(id, userId) as any;
  if (!row) {
    row = db
      .prepare(
        `SELECT id, product_id, quantity FROM cart_items WHERE product_id = ? AND user_id = ?`
      )
      .get(id, userId) as any;
  }
  return row as { id: number; product_id: number; quantity: number } | undefined;
}

function getOrderSummary(orderId: number, userId: number) {
  const order = db
    .prepare(`SELECT id, status, total, created_at FROM orders WHERE id = ? AND user_id = ?`)
    .get(orderId, userId) as any;
  if (!order) return null;

  const items = db
    .prepare(
      `SELECT oi.product_id, p.name, oi.quantity, oi.price
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`
    )
    .all(orderId) as any[];

  return { ...order, items };
}

// ─── Auth ──────────────────────────────────────────────────────

api.post("/api/login", async (c) => {
  const body = await readJson(c);
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const password = (body?.password as string | undefined) || "";

  if (!email || !password) {
    return c.json({ error: "missing_credentials" }, 400);
  }

  const user = db
    .prepare(`SELECT id, email, name, password FROM users WHERE email = ?`)
    .get(email) as { id: number; email: string; name: string; password: string } | undefined;

  if (!user) {
    return c.json({ error: "invalid_credentials" }, 401);
  }

  if (
    !shouldSkipPasswordCheck(email) &&
    !shouldSkipApiPasswordCheck() &&
    user.password !== password
  ) {
    return c.json({ error: "invalid_credentials" }, 401);
  }

  const sessionId = createSession(user.id);
  setSessionCookie(c, sessionId);

  return c.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
});

api.get("/api/me", (c) => {
  const user = requireApiUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  return c.json({ ok: true, user });
});

api.post("/api/logout", (c) => {
  const sessionId = getCookie(c, "session_id");
  if (sessionId) {
    destroySession(sessionId);
    clearSessionCookie(c);
  }
  return c.json({ ok: true });
});

// ─── Products (search + filters) ───────────────────────────────

api.get("/api/products", (c) => {
  const user = c.get("user") as SessionUser | undefined;
  const userId = user?.id ?? -1;

  const search = (c.req.query("search") || "").trim();
  const category = c.req.query("category") || "";
  const sort = c.req.query("sort") || "name";
  const inStockOnly = c.req.query("in_stock") === "1";

  let where = "WHERE 1=1";
  const params: any[] = [];

  if (search) {
    if (shouldUseCaseSensitiveSearch()) {
      where += " AND (p.name GLOB ? OR p.description GLOB ?)";
      params.push(`*${search}*`, `*${search}*`);
    } else {
      where += " AND (p.name LIKE ? OR p.description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
  }

  if (category) {
    where += " AND c.slug = ?";
    params.push(category);
  }

  if (inStockOnly && !shouldIgnoreApiInStockFilter()) {
    where += " AND (p.stock - COALESCE(ci.cart_qty, 0)) > 0";
  }

  let orderBy = "p.name ASC";
  if (sort === "price_asc") {
    orderBy = shouldInvertPriceSort() ? "p.price DESC" : "p.price ASC";
  }
  if (sort === "price_desc") {
    orderBy = shouldInvertPriceSort() ? "p.price ASC" : "p.price DESC";
  }
  if (sort === "name") orderBy = "p.name ASC";

  const rows = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug,
              COALESCE(ci.cart_qty, 0) as cart_qty
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN (
         SELECT product_id, SUM(quantity) as cart_qty
         FROM cart_items
         WHERE user_id = ?
         GROUP BY product_id
       ) ci ON ci.product_id = p.id
       ${where}
       ORDER BY ${orderBy}`
    )
    .all(userId, ...params) as any[];

  const products = rows.map((p) => {
    const availableStock = Math.max(0, p.stock - (p.cart_qty || 0));
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      category: { id: p.category_id, name: p.category_name, slug: p.category_slug },
      stock: p.stock,
      available_stock: availableStock,
      in_stock: availableStock > 0,
    };
  });

  return c.json({ ok: true, count: products.length, products });
});

// ─── Cart ──────────────────────────────────────────────────────

api.post("/api/cart/items", async (c) => {
  const user = requireApiUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await readJson(c);
  const productId = Number(body?.product_id);
  const quantity = Number(body?.quantity ?? 1);

  if (!Number.isFinite(productId) || productId < 1 || !Number.isFinite(quantity) || quantity < 1) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const product = db
    .prepare(`SELECT id, stock FROM products WHERE id = ?`)
    .get(productId) as any;

  if (!product) return c.json({ error: "product_not_found" }, 404);
  if (!shouldAllowOverstockCart() && product.stock <= 0) {
    return c.json({ error: "out_of_stock" }, 409);
  }

  const existing = db
    .prepare(
      `SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?`
    )
    .get(user.id, productId) as any;

  let newQty = 0;
  if (existing) {
    newQty = shouldAllowOverstockCart()
      ? existing.quantity + quantity
      : Math.min(existing.quantity + quantity, product.stock);
    db.prepare(`UPDATE cart_items SET quantity = ? WHERE id = ?`).run(
      newQty,
      existing.id
    );
  } else {
    newQty = shouldAllowOverstockCart()
      ? quantity
      : Math.min(quantity, product.stock);
    db.prepare(
      `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)`
    ).run(user.id, productId, newQty);
  }

  return c.json({
    ok: true,
    item: { product_id: productId, quantity: newQty },
    cart_count: getCartCount(user.id),
  }, 201);
});

api.patch("/api/cart/items/:id", async (c) => {
  const user = requireApiUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  const body = await readJson(c);
  const quantity = Number(body?.quantity);

  if (!Number.isFinite(id) || !Number.isFinite(quantity)) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const cartItem = findCartItem(user.id, id);
  if (!cartItem) return c.json({ error: "cart_item_not_found" }, 404);

  if (quantity < 1) {
    db.prepare(`DELETE FROM cart_items WHERE id = ?`).run(cartItem.id);
    return c.json({
      ok: true,
      removed: true,
      cart_count: getCartCount(user.id),
    });
  }

  const product = db
    .prepare(`SELECT stock FROM products WHERE id = ?`)
    .get(cartItem.product_id) as any;

  const clampedQty = shouldAllowOverstockCart()
    ? quantity
    : Math.min(quantity, product?.stock || 1);
  db.prepare(`UPDATE cart_items SET quantity = ? WHERE id = ?`).run(
    clampedQty,
    cartItem.id
  );

  return c.json({
    ok: true,
    item: { product_id: cartItem.product_id, quantity: clampedQty },
    cart_count: getCartCount(user.id),
  });
});

api.delete("/api/cart/items/:id", (c) => {
  const user = requireApiUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid_request" }, 400);

  const cartItem = findCartItem(user.id, id);
  if (!cartItem) return c.json({ error: "cart_item_not_found" }, 404);

  db.prepare(`DELETE FROM cart_items WHERE id = ?`).run(cartItem.id);
  return c.json({ ok: true, cart_count: getCartCount(user.id) });
});

// ─── Idempotent Orders ─────────────────────────────────────────

api.post("/api/orders", async (c) => {
  const user = requireApiUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
  if (!idempotencyKey) return c.json({ error: "missing_idempotency_key" }, 400);

  const body = await readJson(c);
  const shippingName = (body?.shipping_name as string | undefined)?.trim();
  const shippingAddress = (body?.shipping_address as string | undefined)?.trim();
  const shippingCity = (body?.shipping_city as string | undefined)?.trim();
  const shippingZip = (body?.shipping_zip as string | undefined)?.trim();
  const paymentLast4 = (body?.payment_last4 as string | undefined)?.trim();

  const errors: string[] = [];
  if (!shippingName) errors.push("shipping_name is required");
  if (!shippingAddress) errors.push("shipping_address is required");
  if (!shippingCity) errors.push("shipping_city is required");
  if (!shippingZip) errors.push("shipping_zip is required");
  if (!paymentLast4 || !/^\d{4}$/.test(paymentLast4)) {
    errors.push("payment_last4 must be 4 digits");
  }

  if (errors.length > 0) return c.json({ error: "validation_error", details: errors }, 400);

  const items = db
    .prepare(
      `SELECT ci.quantity, p.id as product_id, p.name, p.price
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ?
       ORDER BY ci.id`
    )
    .all(user.id) as any[];

  if (items.length === 0) return c.json({ error: "cart_empty" }, 400);

  const total = shouldIgnoreQuantityInTotal()
    ? items.reduce((sum: number, item: any) => sum + item.price, 0)
    : items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

  const createOrder = db.transaction(() => {
    if (!shouldIgnoreIdempotency()) {
      const existing = db
        .prepare(
          `SELECT order_id FROM idempotency_keys WHERE key = ? AND user_id = ?`
        )
        .get(idempotencyKey, user.id) as any;
      if (existing) {
        return { orderId: existing.order_id, replayed: true };
      }
    }

    const result = db
      .prepare(
        `INSERT INTO orders (user_id, status, shipping_name, shipping_address, shipping_city, shipping_zip, payment_last4, total)
         VALUES (?, 'confirmed', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        user.id,
        shippingName,
        shippingAddress,
        shippingCity,
        shippingZip,
        paymentLast4,
        total
      );

    const orderId = result.lastInsertRowid as number;

    for (const item of items) {
      db.prepare(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`
      ).run(orderId, item.product_id, item.quantity, item.price);

      db.prepare(`UPDATE products SET stock = stock - ? WHERE id = ?`).run(
        item.quantity,
        item.product_id
      );
    }

    db.prepare(`DELETE FROM cart_items WHERE user_id = ?`).run(user.id);

    if (!shouldIgnoreIdempotency()) {
      db.prepare(
        `INSERT INTO idempotency_keys (key, user_id, order_id) VALUES (?, ?, ?)`
      ).run(idempotencyKey, user.id, orderId);
    }

    return { orderId, replayed: false };
  });

  const result = createOrder();
  const summary = getOrderSummary(result.orderId, user.id);
  if (!summary) return c.json({ error: "order_not_found" }, 404);

  return c.json(
    { ok: true, idempotent: result.replayed, order: summary },
    result.replayed ? 200 : 201
  );
});

// ─── Flaky endpoint ────────────────────────────────────────────

api.get("/api/flaky", (c) => {
  const key =
    c.req.header("X-Client-Id")?.trim() ||
    c.req.header("x-client-id")?.trim() ||
    getCookie(c, "session_id") ||
    "anon";
  const attempt = shouldUseGlobalFlaky()
    ? ++globalFlakyAttempts
    : (flakyAttempts.get(key) || 0) + 1;
  if (!shouldUseGlobalFlaky()) {
    flakyAttempts.set(key, attempt);
  }

  if (attempt <= flakyFailCount) {
    return c.json({ error: "temporary_failure", attempt }, 500);
  }

  return c.json({ ok: true, attempt });
});

export default api;
