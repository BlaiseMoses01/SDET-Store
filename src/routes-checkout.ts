import { Hono } from "hono";
import db from "./db.js";
import { layout } from "./layout.js";
import { requireAuth, type SessionUser } from "./auth.js";
import {
  shouldSkipZipValidation,
  shouldIgnoreQuantityInTotal,
  shouldShowWrongOrderStatus,
} from "./bugs.js";

const checkout = new Hono();

// ─── Helpers ───────────────────────────────────────────────────

function getCartItems(userId: number) {
  return db
    .prepare(
      `SELECT ci.quantity, p.id as product_id, p.name, p.price
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ?
       ORDER BY ci.id`
    )
    .all(userId) as any[];
}

function getCartTotal(items: any[]): number {
  if (shouldIgnoreQuantityInTotal()) {
    // Bug: sums unit prices only, ignoring quantity
    return items.reduce((sum, item) => sum + item.price, 0);
  }
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function stepsHtml(current: number): string {
  const steps = ["Shipping", "Payment", "Review"];
  return `<div class="steps" data-testid="checkout-steps">
    ${steps
      .map(
        (s, i) =>
          `<span class="step ${i + 1 === current ? "active" : ""} ${i + 1 < current ? "done" : ""}"
                 data-testid="step-${i + 1}">${i + 1}. ${s}</span>`
      )
      .join("")}
  </div>`;
}

// ─── Step 1: Shipping ──────────────────────────────────────────

checkout.get("/checkout", (c) => {
  const user = requireAuth(c);
  if (!user) return c.redirect("/login");

  const items = getCartItems(user.id);
  if (items.length === 0) return c.redirect("/cart");
  const error = (c.req.query("error") || "").trim();
  const errorHtml =
    error === "missing_checkout"
      ? `<div class="alert alert-error" data-testid="checkout-error">Your checkout session expired. Please start again.</div>`
      : "";

  return c.html(
    layout(
      "Checkout - Shipping",
      `
    <div class="card" style="max-width: 500px; margin: 2rem auto;">
      ${stepsHtml(1)}
      <h1 style="margin-bottom: 1rem;">Shipping Information</h1>
      ${errorHtml}
      <form method="POST" action="/checkout/shipping" data-testid="shipping-form">
        <div class="form-group">
          <label for="shipping_name">Full Name</label>
          <input type="text" id="shipping_name" name="shipping_name"
                 data-testid="shipping-name" required placeholder="Jane Doe" />
        </div>
        <div class="form-group">
          <label for="shipping_address">Address</label>
          <input type="text" id="shipping_address" name="shipping_address"
                 data-testid="shipping-address" required placeholder="123 Main St" />
        </div>
        <div class="form-group">
          <label for="shipping_city">City</label>
          <input type="text" id="shipping_city" name="shipping_city"
                 data-testid="shipping-city" required placeholder="Springfield" />
        </div>
        <div class="form-group">
          <label for="shipping_zip">ZIP Code</label>
          <input type="text" id="shipping_zip" name="shipping_zip"
                 data-testid="shipping-zip" required placeholder="12345"
                 pattern="[0-9]{5}" title="5 digit ZIP code" />
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;"
                data-testid="shipping-submit">Continue to Payment</button>
      </form>
    </div>
    `,
      user
    )
  );
});

checkout.post("/checkout/shipping", async (c) => {
  const user = requireAuth(c);
  if (!user) return c.redirect("/login");

  const body = await c.req.parseBody();
  const name = (body.shipping_name as string)?.trim();
  const address = (body.shipping_address as string)?.trim();
  const city = (body.shipping_city as string)?.trim();
  const zip = (body.shipping_zip as string)?.trim();

  const errors: string[] = [];
  if (!name) errors.push("Name is required.");
  if (!address) errors.push("Address is required.");
  if (!city) errors.push("City is required.");
  if (!shouldSkipZipValidation() && (!zip || !/^\d{5}$/.test(zip))) {
    errors.push("Valid 5-digit ZIP code is required.");
  }

  if (errors.length > 0) {
    return c.html(
      layout(
        "Checkout - Shipping",
        `
      <div class="card" style="max-width: 500px; margin: 2rem auto;">
        ${stepsHtml(1)}
        <h1 style="margin-bottom: 1rem;">Shipping Information</h1>
        <div class="alert alert-error" data-testid="shipping-errors">
          ${errors.map((e) => `<div>${e}</div>`).join("")}
        </div>
        <form method="POST" action="/checkout/shipping" data-testid="shipping-form">
          <div class="form-group">
            <label for="shipping_name">Full Name</label>
            <input type="text" id="shipping_name" name="shipping_name"
                   data-testid="shipping-name" value="${name || ""}" required />
          </div>
          <div class="form-group">
            <label for="shipping_address">Address</label>
            <input type="text" id="shipping_address" name="shipping_address"
                   data-testid="shipping-address" value="${address || ""}" required />
          </div>
          <div class="form-group">
            <label for="shipping_city">City</label>
            <input type="text" id="shipping_city" name="shipping_city"
                   data-testid="shipping-city" value="${city || ""}" required />
          </div>
          <div class="form-group">
            <label for="shipping_zip">ZIP Code</label>
            <input type="text" id="shipping_zip" name="shipping_zip"
                   data-testid="shipping-zip" value="${zip || ""}" required pattern="[0-9]{5}" />
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%;"
                  data-testid="shipping-submit">Continue to Payment</button>
        </form>
      </div>
      `,
        user
      )
    );
  }

  // Store shipping info in a temporary cookie (simple approach)
  // In a real app you'd use server-side sessions
  const shippingData = JSON.stringify({ name, address, city, zip });
  const { setCookie } = await import("hono/cookie");
  setCookie(c, "checkout_shipping", Buffer.from(shippingData).toString("base64"), {
    httpOnly: true,
    path: "/",
    maxAge: 3600,
  });

  return c.redirect("/checkout/payment");
});

// ─── Step 2: Payment ───────────────────────────────────────────

checkout.get("/checkout/payment", (c) => {
  const user = requireAuth(c);
  if (!user) return c.redirect("/login");

  return c.html(
    layout(
      "Checkout - Payment",
      `
    <div class="card" style="max-width: 500px; margin: 2rem auto;">
      ${stepsHtml(2)}
      <h1 style="margin-bottom: 1rem;">Payment Information</h1>
      <form method="POST" action="/checkout/payment" data-testid="payment-form">
        <div class="form-group">
          <label for="card_number">Card Number</label>
          <input type="text" id="card_number" name="card_number"
                 data-testid="payment-card" required placeholder="4111 1111 1111 1111"
                 maxlength="19" />
        </div>
        <div style="display: flex; gap: 1rem;">
          <div class="form-group" style="flex: 1;">
            <label for="card_expiry">Expiry</label>
            <input type="text" id="card_expiry" name="card_expiry"
                   data-testid="payment-expiry" required placeholder="MM/YY"
                   maxlength="5" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label for="card_cvc">CVC</label>
            <input type="text" id="card_cvc" name="card_cvc"
                   data-testid="payment-cvc" required placeholder="123"
                   maxlength="4" />
          </div>
        </div>
        <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
          <a href="/checkout" class="btn btn-secondary" style="flex: 1; text-align: center;"
             data-testid="payment-back">Back</a>
          <button type="submit" class="btn btn-primary" style="flex: 1;"
                  data-testid="payment-submit">Review Order</button>
        </div>
      </form>
    </div>
    `,
      user
    )
  );
});

checkout.post("/checkout/payment", async (c) => {
  const user = requireAuth(c);
  if (!user) return c.redirect("/login");

  const body = await c.req.parseBody();
  const cardNumber = (body.card_number as string)?.replace(/\s/g, "");
  const expiry = (body.card_expiry as string)?.trim();
  const cvc = (body.card_cvc as string)?.trim();

  const errors: string[] = [];
  if (!cardNumber || !/^\d{13,19}$/.test(cardNumber))
    errors.push("Please enter a valid card number.");
  if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry))
    errors.push("Please enter a valid expiry date (MM/YY).");
  if (!cvc || !/^\d{3,4}$/.test(cvc))
    errors.push("Please enter a valid CVC.");

  if (errors.length > 0) {
    return c.html(
      layout(
        "Checkout - Payment",
        `
      <div class="card" style="max-width: 500px; margin: 2rem auto;">
        ${stepsHtml(2)}
        <h1 style="margin-bottom: 1rem;">Payment Information</h1>
        <div class="alert alert-error" data-testid="payment-errors">
          ${errors.map((e) => `<div>${e}</div>`).join("")}
        </div>
        <form method="POST" action="/checkout/payment" data-testid="payment-form">
          <div class="form-group">
            <label for="card_number">Card Number</label>
            <input type="text" id="card_number" name="card_number"
                   data-testid="payment-card" value="${body.card_number || ""}" required maxlength="19" />
          </div>
          <div style="display: flex; gap: 1rem;">
            <div class="form-group" style="flex: 1;">
              <label for="card_expiry">Expiry</label>
              <input type="text" id="card_expiry" name="card_expiry"
                     data-testid="payment-expiry" value="${expiry || ""}" required maxlength="5" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label for="card_cvc">CVC</label>
              <input type="text" id="card_cvc" name="card_cvc"
                     data-testid="payment-cvc" required maxlength="4" />
            </div>
          </div>
          <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
            <a href="/checkout" class="btn btn-secondary" style="flex: 1; text-align: center;">Back</a>
            <button type="submit" class="btn btn-primary" style="flex: 1;"
                    data-testid="payment-submit">Review Order</button>
          </div>
        </form>
      </div>
      `,
        user
      )
    );
  }

  // Store last 4 digits
  const { setCookie } = await import("hono/cookie");
  setCookie(c, "checkout_payment_last4", cardNumber.slice(-4), {
    httpOnly: true,
    path: "/",
    maxAge: 3600,
  });

  return c.redirect("/checkout/review");
});

// ─── Step 3: Review ────────────────────────────────────────────

checkout.get("/checkout/review", async (c) => {
  const user = requireAuth(c);
  if (!user) return c.redirect("/login");

  const { getCookie } = await import("hono/cookie");
  const shippingRaw = getCookie(c, "checkout_shipping");
  const last4 = getCookie(c, "checkout_payment_last4");

  if (!shippingRaw || !last4) return c.redirect("/checkout?error=missing_checkout");

  const shipping = JSON.parse(
    Buffer.from(shippingRaw, "base64").toString()
  );

  const items = getCartItems(user.id);
  if (items.length === 0) return c.redirect("/cart");

  const total = getCartTotal(items);

  const itemRows = items
    .map(
      (item: any) => `
    <tr data-testid="review-item">
      <td data-testid="review-item-name">${item.name}</td>
      <td data-testid="review-item-qty">${item.quantity}</td>
      <td data-testid="review-item-subtotal">$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `
    )
    .join("");

  return c.html(
    layout(
      "Checkout - Review",
      `
    <div class="card" style="max-width: 500px; margin: 2rem auto;">
      ${stepsHtml(3)}
      <h1 style="margin-bottom: 1rem;">Review Your Order</h1>

      <div style="margin-bottom: 1rem;">
        <h3 style="font-size: 0.9rem; color: #6b7280; text-transform: uppercase;">Shipping</h3>
        <p data-testid="review-shipping-name">${shipping.name}</p>
        <p data-testid="review-shipping-address">${shipping.address}</p>
        <p><span data-testid="review-shipping-city">${shipping.city}</span>, <span data-testid="review-shipping-zip">${shipping.zip}</span></p>
      </div>

      <div style="margin-bottom: 1rem;">
        <h3 style="font-size: 0.9rem; color: #6b7280; text-transform: uppercase;">Payment</h3>
        <p data-testid="review-payment-last4">Card ending in ${last4}</p>
      </div>

      <div style="margin-bottom: 1rem;">
        <h3 style="font-size: 0.9rem; color: #6b7280; text-transform: uppercase;">Items</h3>
        <table class="cart-table">
          <thead>
            <tr><th>Product</th><th>Qty</th><th>Subtotal</th></tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="cart-total" data-testid="review-total">
          Total: $${total.toFixed(2)}
        </div>
      </div>

      <form method="POST" action="/checkout/confirm" data-testid="confirm-form">
        <div style="display: flex; gap: 1rem;">
          <a href="/checkout/payment" class="btn btn-secondary" style="flex: 1; text-align: center;"
             data-testid="review-back">Back</a>
          <button type="submit" class="btn btn-primary" style="flex: 1;"
                  data-testid="confirm-order">Place Order</button>
        </div>
      </form>
    </div>
    `,
      user
    )
  );
});

// ─── Confirm order ─────────────────────────────────────────────

checkout.post("/checkout/confirm", async (c) => {
  const user = requireAuth(c);
  if (!user) return c.redirect("/login");

  const { getCookie, deleteCookie } = await import("hono/cookie");
  const shippingRaw = getCookie(c, "checkout_shipping");
  const last4 = getCookie(c, "checkout_payment_last4");

  if (!shippingRaw || !last4) return c.redirect("/checkout?error=missing_checkout");

  const shipping = JSON.parse(
    Buffer.from(shippingRaw, "base64").toString()
  );

  const items = getCartItems(user.id);
  if (items.length === 0) return c.redirect("/cart");

  const total = getCartTotal(items);

  // Create order in a transaction
  const createOrder = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO orders (user_id, status, shipping_name, shipping_address, shipping_city, shipping_zip, payment_last4, total)
         VALUES (?, 'confirmed', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        user.id,
        shipping.name,
        shipping.address,
        shipping.city,
        shipping.zip,
        last4,
        total
      );

    const orderId = result.lastInsertRowid;

    for (const item of items) {
      db.prepare(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`
      ).run(orderId, item.product_id, item.quantity, item.price);

      // Decrement stock
      db.prepare(
        `UPDATE products SET stock = stock - ? WHERE id = ?`
      ).run(item.quantity, item.product_id);
    }

    // Clear cart
    db.prepare(`DELETE FROM cart_items WHERE user_id = ?`).run(user.id);

    return orderId;
  });

  const orderId = createOrder();

  // Clean up checkout cookies
  deleteCookie(c, "checkout_shipping", { path: "/" });
  deleteCookie(c, "checkout_payment_last4", { path: "/" });

  return c.redirect(`/order/${orderId}`);
});

// ─── Order confirmation page ───────────────────────────────────

checkout.get("/order/:id", (c) => {
  const user = requireAuth(c);
  if (!user) return c.redirect("/login");

  const orderId = Number(c.req.param("id"));

  const order = db
    .prepare(`SELECT * FROM orders WHERE id = ? AND user_id = ?`)
    .get(orderId, user.id) as any;

  if (!order) return c.redirect("/products?error=order_not_found");

  const items = db
    .prepare(
      `SELECT oi.*, p.name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`
    )
    .all(orderId) as any[];

  const itemRows = items
    .map(
      (item: any) => `
    <tr data-testid="order-item">
      <td data-testid="order-item-name">${item.name}</td>
      <td data-testid="order-item-qty">${item.quantity}</td>
      <td data-testid="order-item-price">$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `
    )
    .join("");

  return c.html(
    layout(
      "Order Confirmed",
      `
    <div class="card" style="max-width: 500px; margin: 2rem auto;">
      <div class="alert alert-success" data-testid="order-success">
        Order placed successfully!
      </div>
      <h1 style="margin-bottom: 1rem;">Order #<span data-testid="order-id">${orderId}</span></h1>

      <div style="margin-bottom: 1rem;">
        <p><strong>Status:</strong> <span data-testid="order-status">${
          shouldShowWrongOrderStatus() ? "pending" : order.status
        }</span></p>
        <p><strong>Shipping to:</strong></p>
        <p data-testid="order-shipping">${order.shipping_name}, ${order.shipping_address}, ${order.shipping_city} ${order.shipping_zip}</p>
        <p><strong>Payment:</strong> <span data-testid="order-payment">Card ending in ${order.payment_last4}</span></p>
      </div>

      <div class="order-summary">
        <table class="cart-table">
          <thead>
            <tr><th>Product</th><th>Qty</th><th>Subtotal</th></tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="cart-total" data-testid="order-total">
          Total: $${order.total.toFixed(2)}
        </div>
      </div>

      <div style="margin-top: 1.5rem; text-align: center;">
        <a href="/products" class="btn btn-primary">Continue Shopping</a>
      </div>
    </div>
    `,
      user
    )
  );
});

export default checkout;
