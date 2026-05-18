import type { SessionUser } from "./auth.js";

// Minimal layout wrapper. No frameworks, no build step.
// Just a function that returns an HTML string.

export function layout(
  title: string,
  body: string,
  user?: SessionUser | null
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | SDET Store</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; background: #f5f5f5; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Nav */
    nav { background: #1a1a1a; color: #fff; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    nav a { color: #fff; margin-left: 1.5rem; }
    .nav-brand { font-weight: 700; font-size: 1.1rem; }
    .nav-links { display: flex; align-items: center; gap: 0.5rem; }
    .cart-count { background: #ef4444; color: #fff; border-radius: 999px; padding: 0.1rem 0.5rem; font-size: 0.75rem; margin-left: 0.25rem; }

    /* Layout */
    main { max-width: 1000px; margin: 2rem auto; padding: 0 1rem; }
    .card { background: #fff; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

    /* Forms */
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.9rem; }
    .form-group input, .form-group select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.2); }
    .btn { display: inline-block; padding: 0.5rem 1.25rem; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; font-weight: 500; }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-danger { background: #ef4444; color: #fff; }
    .btn-secondary { background: #e5e7eb; color: #1a1a1a; }

    /* Alerts */
    .alert { padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9rem; }
    .alert-error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .alert-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

    /* Products */
    .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .product-card { background: #fff; border-radius: 8px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: flex; flex-direction: column; }
    .product-card h3 { font-size: 1rem; margin-bottom: 0.25rem; }
    .product-price { font-size: 1.1rem; font-weight: 700; color: #2563eb; margin: 0.5rem 0; }
    .product-category { font-size: 0.8rem; color: #6b7280; }
    .product-stock { font-size: 0.8rem; margin-top: auto; padding-top: 0.5rem; }
    .out-of-stock { color: #ef4444; font-weight: 600; }
    .in-stock { color: #16a34a; }

    /* Cart */
    .cart-table { width: 100%; border-collapse: collapse; }
    .cart-table th, .cart-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .cart-table th { font-size: 0.85rem; color: #6b7280; text-transform: uppercase; }
    .cart-total { font-size: 1.25rem; font-weight: 700; text-align: right; padding-top: 1rem; }

    /* Filters */
    .filters { display: flex; gap: 1rem; margin-bottom: 1.5rem; align-items: end; flex-wrap: wrap; }
    .filters .form-group { margin-bottom: 0; }

    /* Checkout steps */
    .steps { display: flex; gap: 0.5rem; margin-bottom: 2rem; }
    .step { padding: 0.5rem 1rem; border-radius: 999px; font-size: 0.85rem; background: #e5e7eb; color: #6b7280; }
    .step.active { background: #2563eb; color: #fff; }
    .step.done { background: #16a34a; color: #fff; }

    /* Order confirmation */
    .order-summary { border-top: 2px solid #e5e7eb; padding-top: 1rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <nav>
    <span class="nav-brand">SDET Store</span>
    <div class="nav-links">
      <a href="/products" data-testid="nav-products">Products</a>
      ${
        user
          ? `<a href="/cart" data-testid="nav-cart">Cart <span class="cart-count" data-testid="cart-count"><!--filled by route--></span></a>
             <a href="/account" data-testid="nav-account">${user.name}</a>
             <a href="/logout" data-testid="nav-logout">Logout</a>`
          : `<a href="/login" data-testid="nav-login">Login</a>
             <a href="/signup" data-testid="nav-signup">Sign Up</a>`
      }
    </div>
  </nav>
  <main>
    ${body}
  </main>
  <script>
    try {
      var es = new EventSource('/__admin/events');
      es.onmessage = function () { location.reload(); };
    } catch (_) {}
  </script>
</body>
</html>`;
}
