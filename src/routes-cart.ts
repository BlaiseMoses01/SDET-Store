import { Hono } from "hono";
import db from "./db.js";
import { layout } from "./layout.js";
import { requireAuth, type SessionUser } from "./auth.js";
import {
  shouldSkipCartRemove,
  shouldShowUnitPriceAsSubtotal,
  shouldShowZeroCartCount,
} from "./bugs.js";

const cart = new Hono();

// ─── Helper ────────────────────────────────────────────────────

function getCartItems(userId: number) {
  return db
    .prepare(
      `SELECT ci.id, ci.quantity, p.id as product_id, p.name, p.price, p.stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ?
       ORDER BY ci.id`
    )
    .all(userId) as any[];
}

function getCartTotal(items: any[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getCartCount(userId: number): number {
  if (shouldShowZeroCartCount()) return 0; // Bug: always 0
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id = ?`
    )
    .get(userId) as any;
  return row.count;
}

// ─── View cart ─────────────────────────────────────────────────

cart.get("/cart", (c) => {
  const user = requireAuth(c);
  if (!user) return c.redirect("/login");

  const items = getCartItems(user.id);
  const total = getCartTotal(items);
  const cartCount = getCartCount(user.id);

  const rows = items
    .map(
      (item: any) => `
    <tr data-testid="cart-item" data-product-id="${item.product_id}">
      <td data-testid="cart-item-name">${item.name}</td>
      <td data-testid="cart-item-price">$${item.price.toFixed(2)}</td>
      <td>
        <form method="POST" action="/cart/update" style="display: flex; align-items: center; gap: 0.5rem;">
          <input type="hidden" name="product_id" value="${item.product_id}" />
          <input type="number" name="quantity" value="${item.quantity}" min="1" max="${item.stock}"
                 style="width: 60px; padding: 0.25rem;" data-testid="cart-item-quantity" />
          <button type="submit" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.25rem 0.75rem;"
                  data-testid="cart-item-update">Update</button>
        </form>
      </td>
      <td data-testid="cart-item-subtotal">$${
        shouldShowUnitPriceAsSubtotal()
          ? item.price.toFixed(2)  // Bug: ignores quantity
          : (item.price * item.quantity).toFixed(2)
      }</td>
      <td>
        <form method="POST" action="/cart/remove">
          <input type="hidden" name="product_id" value="${item.product_id}" />
          <button type="submit" class="btn btn-danger" style="font-size: 0.8rem; padding: 0.25rem 0.75rem;"
                  data-testid="cart-item-remove">Remove</button>
        </form>
      </td>
    </tr>
  `
    )
    .join("");

  const bodyHtml =
    items.length === 0
      ? `
    <div class="card">
      <h1 style="margin-bottom: 1rem;">Your Cart</h1>
      <p data-testid="cart-empty">Your cart is empty. <a href="/products">Browse products</a></p>
    </div>
  `
      : `
    <div class="card">
      <h1 style="margin-bottom: 1rem;">Your Cart</h1>
      <table class="cart-table" data-testid="cart-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Quantity</th>
            <th>Subtotal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div class="cart-total" data-testid="cart-total">
        Total: $${total.toFixed(2)}
      </div>
      <div style="text-align: right; margin-top: 1rem;">
        <a href="/checkout" class="btn btn-primary" data-testid="checkout-btn">Proceed to Checkout</a>
      </div>
    </div>
  `;

  const html = layout("Cart", bodyHtml, user).replace(
    "<!--filled by route-->",
    String(cartCount)
  );
  return c.html(html);
});

// ─── Add to cart ───────────────────────────────────────────────

cart.post("/cart/add", async (c) => {
  const user = requireAuth(c);
  if (!user) return c.redirect("/login");

  const body = await c.req.parseBody();
  const productId = Number(body.product_id);

  const product = db
    .prepare(`SELECT id, stock FROM products WHERE id = ?`)
    .get(productId) as any;

  if (!product || product.stock <= 0) {
    const reason = !product ? "product_not_found" : "out_of_stock";
    return c.redirect(`/products?error=${reason}`);
  }

  // Upsert — increment quantity if already in cart
  const existing = db
    .prepare(
      `SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?`
    )
    .get(user.id, productId) as any;

  if (existing) {
    const newQty = Math.min(existing.quantity + 1, product.stock);
    db.prepare(`UPDATE cart_items SET quantity = ? WHERE id = ?`).run(
      newQty,
      existing.id
    );
  } else {
    db.prepare(
      `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, 1)`
    ).run(user.id, productId);
  }

  return c.redirect("/cart");
});

// ─── Update quantity ───────────────────────────────────────────

cart.post("/cart/update", async (c) => {
  const user = requireAuth(c);
  if (!user) return c.redirect("/login");

  const body = await c.req.parseBody();
  const productId = Number(body.product_id);
  const quantity = Number(body.quantity);

  if (quantity < 1) {
    // Remove if quantity is 0 or invalid
    db.prepare(
      `DELETE FROM cart_items WHERE user_id = ? AND product_id = ?`
    ).run(user.id, productId);
  } else {
    const product = db
      .prepare(`SELECT stock FROM products WHERE id = ?`)
      .get(productId) as any;
    const clampedQty = Math.min(quantity, product?.stock || 1);

    db.prepare(
      `UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?`
    ).run(clampedQty, user.id, productId);
  }

  return c.redirect("/cart");
});

// ─── Remove from cart ──────────────────────────────────────────

cart.post("/cart/remove", async (c) => {
  const user = requireAuth(c);
  if (!user) return c.redirect("/login");

  const body = await c.req.parseBody();
  const productId = Number(body.product_id);

  if (!shouldSkipCartRemove()) {
    db.prepare(
      `DELETE FROM cart_items WHERE user_id = ? AND product_id = ?`
    ).run(user.id, productId);
  }
  // Bug: when shouldSkipCartRemove() is true, we just redirect without deleting

  return c.redirect("/cart");
});

export default cart;
