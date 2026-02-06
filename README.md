# SDET Store

A fully seeded e-commerce storefront built for testing. Use it to evaluate agentic QA bots, practice manual testing, or sharpen your automation skills. It ships with realistic UI flows, a REST API, 19 toggleable bugs, and a deterministic dataset — no external services required.

**Stack:** Hono + SQLite + TypeScript
**Runs on:** Node 20, Docker, or Fly.io

---

## Table of Contents

- [Quick Start](#quick-start)
- [UI Flows](#ui-flows)
- [API Reference](#api-reference)
- [Bug Flags](#bug-flags)
- [Admin Endpoints](#admin-endpoints)
- [Seeded Test Data](#seeded-test-data)
- [Database Seeding](#database-seeding)
- [Gherkin Specs](#gherkin-specs)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)

---

## Quick Start

```bash
npm install
npm run seed:dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app starts in `healthy` mode with a fully seeded database.

---

## UI Flows

The storefront has six pages connected by a standard e-commerce flow:

### Signup (`GET /signup`)
Form fields: name, email, password, confirm password.
Validation: name ≥ 2 chars, valid email format, password ≥ 8 chars with at least 1 uppercase letter and 1 number.
On success → redirects to products page.

### Login (`GET /login`)
Form fields: email, password.
On success → sets a `session_id` cookie (7-day expiry) and redirects to products page.

### Products (`GET /products`)
Displays a product grid with name, price, stock status, and category.
**Search:** text input filters by product name.
**Filters:** category dropdown, in-stock checkbox.
**Sort:** name (A-Z), price low→high, price high→low.
**Actions:** "Add to Cart" button per product (disabled when out of stock). Cart count shown in the navigation bar.

### Cart (`GET /cart`)
Lists all items with product name, unit price, quantity input, line subtotal, and a remove button.
Shows a cart total at the bottom.
**Actions:** update quantity, remove item, proceed to checkout.

### Checkout (3-step flow)
1. **Shipping** (`GET /checkout`) — full name, address, city, ZIP code (5 digits).
2. **Payment** (`GET /checkout/payment`) — card number (13-19 digits), expiry (MM/YY), CVC (3-4 digits). Only the last 4 digits of the card are stored.
3. **Review** (`GET /checkout/review`) — summary of shipping details, payment info (last 4), item table, and order total. Submit to confirm.

On confirmation → creates the order, decrements product stock, clears the cart, and redirects to the order page.

### Order Confirmation (`GET /order/:id`)
Displays order ID, status, items, and total.

### Account (`GET /account`)
Shows the logged-in user's name and email.

---

## API Reference

All API endpoints return JSON. Authentication is cookie-based (session cookie set on login).

### Auth

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `POST` | `/api/login` | `{ "email": "...", "password": "..." }` | `{ "ok": true, "user": { "id", "email", "name" } }` |
| `GET` | `/api/me` | — | `{ "ok": true, "user": { "id", "email", "name" } }` |
| `POST` | `/api/logout` | — | `{ "ok": true }` |

Error responses: `400` (missing credentials), `401` (invalid credentials or not authenticated).

### Products

| Method | Endpoint | Query Params | Response |
|--------|----------|-------------|----------|
| `GET` | `/api/products` | `search`, `category`, `sort`, `in_stock` | `{ "ok": true, "count": N, "products": [...] }` |

**Query parameters:**
- `search` — filter by product name (case-insensitive in healthy mode)
- `category` — filter by category name (exact match)
- `sort` — `name`, `price_asc`, `price_desc`
- `in_stock` — set to `1` to hide out-of-stock items

Each product includes: `id`, `name`, `description`, `price`, `category`, `stock`, `available_stock`, `in_stock`.
`available_stock` accounts for items already in the authenticated user's cart.

### Cart

All cart endpoints require authentication.

| Method | Endpoint | Body / Params | Response |
|--------|----------|--------------|----------|
| `POST` | `/api/cart/items` | `{ "product_id": 1, "quantity": 1 }` | `{ "ok": true, "item": {...}, "cart_count": N }` |
| `PATCH` | `/api/cart/items/:id` | `{ "quantity": 2 }` | `{ "ok": true, "item": {...}, "cart_count": N }` |
| `DELETE` | `/api/cart/items/:id` | — | `{ "ok": true, "cart_count": N }` |

- Adding an item that's already in the cart increments its quantity (capped at available stock).
- Setting quantity below 1 removes the item.
- `:id` refers to the `product_id`.

### Orders

| Method | Endpoint | Headers | Body | Response |
|--------|----------|---------|------|----------|
| `POST` | `/api/orders` | `Idempotency-Key: <string>` | `{ "shipping_name", "shipping_address", "shipping_city", "shipping_zip", "payment_last4" }` | `{ "ok": true, "order": {...} }` |

- `Idempotency-Key` is **required**. Sending the same key returns the original order with `"idempotent": true` instead of creating a duplicate.
- `payment_last4` must be exactly 4 digits.
- On success: creates the order (status `confirmed`), decrements stock, and clears the cart.
- Status codes: `201` (created), `200` (idempotent replay), `400` (validation error), `401` (not authenticated).

### Flaky Endpoint (Resilience Testing)

| Method | Endpoint | Headers | Response |
|--------|----------|---------|----------|
| `GET` | `/api/flaky` | `X-Client-Id: <string>` (optional) | `{ "ok": true, "attempt": N }` or `500` |

Simulates transient failures for retry-logic testing. The endpoint fails the first N requests before succeeding (default N = 2, configurable via `FLAKY_FAILS` env var).

- Use `X-Client-Id` to track attempts per client. Without it, the session cookie is used.
- Failure response: `{ "error": "temporary_failure", "attempt": N }` with status `500`.

---

## Bug Flags

The app has 19 intentional bugs that can be activated one at a time by setting the `APP_MODE` environment variable or by calling the admin API. The default mode is `healthy` (no bugs).

### UI Authentication Bugs

| Mode | Behavior | What to detect |
|------|----------|----------------|
| `buggy-auth-1` | Login accepts any password for `alice@example.com` | Authentication bypass — any password works for a known user |
| `buggy-auth-2` | Signup allows duplicate email addresses | Missing uniqueness constraint — can register with an existing email |
| `buggy-auth-3` | Expired sessions are still accepted | Session expiry not enforced — stale cookies grant access |

### UI Product Bugs

| Mode | Behavior | What to detect |
|------|----------|----------------|
| `buggy-products-1` | Search becomes case-sensitive | "headphones" won't match "Wireless Headphones" |
| `buggy-products-2` | Out-of-stock items show an active "Add to Cart" button | Stock validation bypassed in the UI |
| `buggy-products-3` | Price sort direction is inverted | "Low to High" actually sorts high to low |

### UI Cart Bugs

| Mode | Behavior | What to detect |
|------|----------|----------------|
| `buggy-cart-1` | Remove button silently does nothing | Item stays in cart after clicking remove |
| `buggy-cart-2` | Line subtotal shows unit price regardless of quantity | 2 × $10.00 displays as $10.00 instead of $20.00 |
| `buggy-cart-3` | Cart count in the nav bar always shows 0 | Badge count is wrong even with items in cart |

### UI Checkout Bugs

| Mode | Behavior | What to detect |
|------|----------|----------------|
| `buggy-checkout-1` | ZIP code validation is skipped | Invalid ZIP codes (letters, wrong length) are accepted |
| `buggy-checkout-2` | Order total sums unit prices, ignoring quantity | Total for 2 × $10 shows $10 instead of $20 |
| `buggy-checkout-3` | Order confirmation shows "pending" instead of "confirmed" | Incorrect order status after successful checkout |

### API Bugs

| Mode | Behavior | What to detect |
|------|----------|----------------|
| `buggy-api-auth-1` | API endpoints accessible without authentication | Protected routes return data without a session |
| `buggy-api-auth-2` | API login accepts any password for existing users | Authentication bypass on the API layer |
| `buggy-api-products-1` | `in_stock=1` filter is ignored | Out-of-stock products appear in filtered results |
| `buggy-api-cart-1` | Cart allows quantities beyond available stock | No stock validation — can add 999 of a product with 5 in stock |
| `buggy-api-orders-1` | Idempotency key is ignored | Duplicate orders created with the same key |
| `buggy-api-flaky-1` | Flaky endpoint tracks attempts globally instead of per client | All clients share a single failure counter |

### Switching Modes

**Via environment variable:**
```bash
APP_MODE=buggy-cart-2 npm run dev
```

**Via admin API (at runtime):**
```bash
curl -X POST http://localhost:3000/__admin/mode \
  -H "Content-Type: application/json" \
  -H "x-admin-token: your-token" \
  -d '{"mode": "buggy-cart-2"}'
```

---

## Admin Endpoints

Admin endpoints are disabled by default. To enable them, set the `ADMIN_TOKEN` environment variable in your .env or fly.toml for deployments. Authenticate with the `x-admin-token` header or the `?token=` query parameter.

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `GET` | `/__admin/mode` | — | Returns the current bug mode |
| `POST` | `/__admin/mode` | `{ "mode": "buggy-cart-2" }` | Sets the bug mode (validates against known modes) |
| `POST` | `/__admin/seed` | — | Re-seeds the database to its initial state |

---

## Seeded Test Data

The seed script creates a deterministic dataset so tests are repeatable.

### Users

| Email | Password | Notes |
|-------|----------|-------|
| `alice@example.com` | `Password123!` | Has a valid session and a pre-loaded cart |
| `bob@example.com` | `TestPass456!` | Has an expired session |
| `taken@example.com` | `Exists789!` | Useful for duplicate-email tests |

### Products (16 total)

| Category | Product | Price | Stock |
|----------|---------|-------|-------|
| Electronics | Wireless Headphones | $79.99 | 25 |
| Electronics | USB-C Hub | $34.99 | 50 |
| Electronics | Mechanical Keyboard | $129.99 | 15 |
| Electronics | Webcam HD | $49.99 | **0** |
| Electronics | Portable Monitor | $199.99 | 8 |
| Books | Testing JavaScript Apps | $39.99 | 100 |
| Books | Clean Code | $29.99 | 75 |
| Books | The Pragmatic Programmer | $44.99 | 60 |
| Books | Eloquent JavaScript | $24.99 | **0** |
| Books | Design Patterns | $49.99 | 30 |
| Clothing | Dev T-Shirt | $19.99 | 200 |
| Clothing | Hoodie Debug Mode | $54.99 | 45 |
| Clothing | Code Baseball Cap | $14.99 | 80 |
| Home & Garden | Desk Lamp LED | $32.99 | 35 |
| Home & Garden | Cable Organizer Kit | $12.99 | 150 |
| Home & Garden | Standing Desk Mat | $44.99 | 20 |

Two products are out of stock (Webcam HD, Eloquent JavaScript) for testing stock-related flows.

### Alice's Pre-loaded Cart

| Product | Qty | Subtotal |
|---------|-----|----------|
| Wireless Headphones | 1 | $79.99 |
| Testing JavaScript Apps | 2 | $79.98 |
| Dev T-Shirt | 1 | $19.99 |
| **Total** | | **$179.96** |

This lets you jump straight into cart and checkout tests without adding items first.

---

## Database Seeding

### How it works

The seed script (`db/seed.ts`) drops and recreates all tables, then inserts the data defined in `src/seed-data.ts`. The schema includes: `users`, `sessions`, `categories`, `products`, `cart_items`, `orders`, `order_items`, and `idempotency_keys`.

### Running the seed

```bash
# Local development
npm run seed:dev

# Production (after building)
npm run seed

# Via admin API (at runtime)
curl -X POST http://localhost:3000/__admin/seed \
  -H "x-admin-token: your-token"
```

### Customizing the seed data

- **Products, users, and cart items** — edit [src/seed-data.ts](src/seed-data.ts). The file exports arrays of users, products, and cart items, plus session definitions. Add or modify entries and re-run the seed.
- **Schema changes** — edit [db/seed.ts](db/seed.ts). This file defines the table structure and runs the insert statements.
- After any change, re-seed with `npm run seed:dev` to apply.

### Docker seeding

When running in Docker, seeding is controlled by two environment variables:
- `SEED_ON_START=1` (default) — seeds the database if the DB file doesn't exist yet.
- `FORCE_SEED=1` — re-seeds on every container start, regardless of existing data.

---

## Gherkin Specs

The `features/` directory contains Gherkin (`.feature`) files that document expected behavior. These are **documentation-only** — they are not wired to a test runner. Use them as a reference for what to test.

```
features/
├── api/
│   ├── admin.feature
│   ├── auth.feature
│   ├── bugs.feature
│   ├── cart.feature
│   ├── flaky.feature
│   ├── orders.feature
│   └── products.feature
└── ui/
    ├── account.feature
    ├── auth.feature
    ├── bugs.feature
    ├── cart.feature
    ├── checkout.feature
    └── products.feature
```

---

## Deployment

### Docker

```bash
docker build -t sdet-store .
docker run -p 3000:3000 \
  -e DATABASE_URL=/data/sqlite.db \
  -v $PWD/data:/data \
  sdet-store
```

### Fly.io

1. Edit `fly.toml` and set a unique `app` name.
2. Set your admin token as a secret (not in the toml file):
   ```bash
   fly secrets set ADMIN_TOKEN=your-token
   ```
3. Create a persistent volume (once):
   ```bash
   fly volumes create sdet_store_data --size 1
   ```
4. Deploy:
   ```bash
   fly deploy
   ```

The app expects a persistent volume mounted at `/data`.

---

## Environment Variables

Copy `.env.example` to `.env` and configure as needed.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | — | Path to SQLite database file |
| `APP_MODE` | `healthy` | Active bug mode (see [Bug Flags](#bug-flags)) |
| `ADMIN_TOKEN` | — | Enables admin endpoints when set |
| `FLAKY_FAILS` | `2` | Number of failures before the flaky endpoint succeeds |
| `SEED_ON_START` | `1` | Seed database on container start if DB doesn't exist |
| `FORCE_SEED` | `0` | Re-seed database on every container start |
