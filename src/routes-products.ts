import { Hono } from "hono";
import db from "./db.js";
import { layout } from "./layout.js";
import { requireAuth, type SessionUser } from "./auth.js";
import {
  shouldUseCaseSensitiveSearch,
  shouldAllowOutOfStockPurchase,
  shouldInvertPriceSort,
  shouldShowZeroCartCount,
} from "./bugs.js";
import type { HonoVars } from "./types.ts";

const products = new Hono<{Variables:HonoVars}>();

// ─── Product listing with search and filters ───────────────────

products.get("/products", (c) => {
  const user  = c.get("user") as SessionUser | undefined;
  const userId = user?.id ?? -1;
  const error = (c.req.query("error") || "").trim();

  const search = (c.req.query("search") || "").trim();
  const category = c.req.query("category") || "";
  const sort = c.req.query("sort") || "name";
  const inStockOnly = c.req.query("in_stock") === "1";

  // Build query dynamically
  let where = "WHERE 1=1";
  const params: any[] = [];

  if (search) {
    if (shouldUseCaseSensitiveSearch()) {
      // Bug: GLOB is case-sensitive, so "headphones" won't match "Headphones"
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

  if (inStockOnly) {
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

  const productRows = db
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

  const categories = db
    .prepare(`SELECT * FROM categories ORDER BY name`)
    .all() as any[];

  // Cart count for nav
  let cartCount = 0;
  if (user) {
    if (shouldShowZeroCartCount()) {
      cartCount = 0; // Bug: always shows 0
    } else {
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id = ?`
        )
        .get(user.id) as any;
      cartCount = row.count;
    }
  }

  const productCards = productRows
    .map(
      (p) => {
        const availableStock = Math.max(0, p.stock - (p.cart_qty || 0));
        return `
    <div class="product-card" data-testid="product-card" data-product-id="${p.id}">
      <span class="product-category" data-testid="product-category">${p.category_name}</span>
      <h3 data-testid="product-name">${p.name}</h3>
      <p style="font-size: 0.85rem; color: #6b7280; flex: 1;">${p.description || ""}</p>
      <div class="product-price" data-testid="product-price">$${p.price.toFixed(2)}</div>
      <div class="product-stock ${availableStock > 0 ? "in-stock" : "out-of-stock"}" data-testid="product-stock">
        ${availableStock > 0 ? `${availableStock} in stock` : "Out of stock"}
      </div>
      ${
        user && (availableStock > 0 || shouldAllowOutOfStockPurchase())
          ? `<form method="POST" action="/cart/add" style="margin-top: 0.5rem;">
               <input type="hidden" name="product_id" value="${p.id}" />
               <button type="submit" class="btn btn-primary" style="width: 100%; font-size: 0.85rem;"
                       data-testid="add-to-cart">Add to Cart</button>
             </form>`
          : availableStock === 0
          ? `<button class="btn btn-secondary" style="width: 100%; font-size: 0.85rem; margin-top: 0.5rem;" disabled
                     data-testid="add-to-cart-disabled">Out of Stock</button>`
          : `<a href="/login" class="btn btn-secondary" style="width: 100%; font-size: 0.85rem; margin-top: 0.5rem; text-align: center;"
                data-testid="login-to-buy">Login to Buy</a>`
      }
    </div>
  `;
      }
    )
    .join("");

  const categoryOptions = categories
    .map(
      (cat: any) =>
        `<option value="${cat.slug}" ${category === cat.slug ? "selected" : ""}>${cat.name}</option>`
    )
    .join("");

  const errorMessages: Record<string, string> = {
    out_of_stock: "This item is out of stock.",
    product_not_found: "Product not found.",
    order_not_found: "Order not found.",
  };
  const errorHtml = errorMessages[error]
    ? `<div class="alert alert-error" data-testid="products-error">${errorMessages[error]}</div>`
    : "";

  const bodyHtml = `
    <h1 style="margin-bottom: 1.5rem;">Products</h1>
    ${errorHtml}

    <form method="GET" action="/products" class="filters" data-testid="filters-form">
      <div class="form-group">
        <label for="search">Search</label>
        <input type="text" id="search" name="search" data-testid="filter-search"
               value="${search}" placeholder="Search products..." />
      </div>
      <div class="form-group">
        <label for="category">Category</label>
        <select id="category" name="category" data-testid="filter-category">
          <option value="">All Categories</option>
          ${categoryOptions}
        </select>
      </div>
      <div class="form-group">
        <label for="sort">Sort By</label>
        <select id="sort" name="sort" data-testid="filter-sort">
          <option value="name" ${sort === "name" ? "selected" : ""}>Name</option>
          <option value="price_asc" ${sort === "price_asc" ? "selected" : ""}>Price: Low to High</option>
          <option value="price_desc" ${sort === "price_desc" ? "selected" : ""}>Price: High to Low</option>
        </select>
      </div>
      <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; padding-top: 1.5rem;">
        <input type="checkbox" id="in_stock" name="in_stock" value="1"
               data-testid="filter-in-stock" ${inStockOnly ? "checked" : ""} />
        <label for="in_stock" style="margin: 0;">In Stock Only</label>
      </div>
      <button type="submit" class="btn btn-primary" data-testid="filter-apply">Apply</button>
    </form>

    <p data-testid="product-count" style="margin-bottom: 1rem; color: #6b7280;">
      Showing ${productRows.length} product${productRows.length !== 1 ? "s" : ""}
    </p>

    <div class="product-grid" data-testid="product-grid">
      ${productCards || '<p data-testid="no-products">No products match your filters.</p>'}
    </div>
  `;

  // Inject cart count into nav
  const html = layout("Products", bodyHtml, user).replace(
    "<!--filled by route-->",
    String(cartCount)
  );

  return c.html(html);
});

export default products;
