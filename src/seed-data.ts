import type { Database as SqliteDatabase } from "better-sqlite3";

export type SeedSummary = {
  users: number;
  sessions: number;
  categories: number;
  products: number;
  cart_items: number;
  out_of_stock: number;
};

export function seedDatabase(db: SqliteDatabase): SeedSummary {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    DROP TABLE IF EXISTS order_items;
    DROP TABLE IF EXISTS idempotency_keys;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS cart_items;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS users;

    CREATE TABLE users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      name        TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE sessions (
      id          TEXT PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      expires_at  TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE categories (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT UNIQUE NOT NULL,
      slug  TEXT UNIQUE NOT NULL
    );

    CREATE TABLE products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      slug          TEXT UNIQUE NOT NULL,
      description   TEXT,
      price         REAL NOT NULL,
      category_id   INTEGER NOT NULL REFERENCES categories(id),
      stock         INTEGER NOT NULL DEFAULT 0,
      image_url     TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE cart_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      product_id  INTEGER NOT NULL REFERENCES products(id),
      quantity    INTEGER NOT NULL DEFAULT 1,
      UNIQUE(user_id, product_id)
    );

    CREATE TABLE orders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL REFERENCES users(id),
      status          TEXT NOT NULL DEFAULT 'pending',
      shipping_name   TEXT,
      shipping_address TEXT,
      shipping_city   TEXT,
      shipping_zip    TEXT,
      payment_last4   TEXT,
      total           REAL NOT NULL,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE idempotency_keys (
      key         TEXT PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      order_id    INTEGER NOT NULL REFERENCES orders(id),
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE order_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    INTEGER NOT NULL REFERENCES orders(id),
      product_id  INTEGER NOT NULL REFERENCES products(id),
      quantity    INTEGER NOT NULL,
      price       REAL NOT NULL
    );
  `);

  // Users — passwords stored as plain text intentionally.
  const insertUser = db.prepare(
    `INSERT INTO users (email, password, name) VALUES (?, ?, ?)`
  );

  insertUser.run("alice@example.com", "Password123!", "Alice Johnson");
  insertUser.run("bob@example.com", "TestPass456!", "Bob Smith");
  insertUser.run("taken@example.com", "Exists789!", "Existing User");

  // Sessions — one valid, one expired
  const insertSession = db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`
  );

  const validSessionId = "sess_valid_alice_abc123";
  const expiredSessionId = "sess_expired_bob_xyz789";

  insertSession.run(
    validSessionId,
    1,
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  );

  insertSession.run(
    expiredSessionId,
    2,
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  );

  const insertCategory = db.prepare(
    `INSERT INTO categories (name, slug) VALUES (?, ?)`
  );

  insertCategory.run("Electronics", "electronics");
  insertCategory.run("Books", "books");
  insertCategory.run("Clothing", "clothing");
  insertCategory.run("Home & Garden", "home-garden");

  const insertProduct = db.prepare(
    `INSERT INTO products (name, slug, description, price, category_id, stock) VALUES (?, ?, ?, ?, ?, ?)`
  );

  insertProduct.run("Wireless Headphones", "wireless-headphones", "Noise-canceling over-ear headphones", 79.99, 1, 25);
  insertProduct.run("USB-C Hub", "usb-c-hub", "7-in-1 USB-C adapter", 34.99, 1, 50);
  insertProduct.run("Mechanical Keyboard", "mechanical-keyboard", "Cherry MX Brown switches, full-size", 129.99, 1, 15);
  insertProduct.run("Webcam HD", "webcam-hd", "1080p webcam with built-in mic", 49.99, 1, 0);
  insertProduct.run("Portable Monitor", "portable-monitor", "15.6 inch USB-C portable display", 199.99, 1, 8);

  insertProduct.run("Testing JavaScript Applications", "testing-js-apps", "A guide to modern JS testing", 39.99, 2, 100);
  insertProduct.run("Clean Code", "clean-code", "A handbook of agile software craftsmanship", 29.99, 2, 75);
  insertProduct.run("The Pragmatic Programmer", "pragmatic-programmer", "Your journey to mastery", 44.99, 2, 60);
  insertProduct.run("Eloquent JavaScript", "eloquent-js", "A modern introduction to programming", 24.99, 2, 0);
  insertProduct.run("Design Patterns", "design-patterns", "Elements of reusable OO software", 49.99, 2, 30);

  insertProduct.run("Dev T-Shirt", "dev-tshirt", "100% cotton, 'It works on my machine' print", 19.99, 3, 200);
  insertProduct.run("Hoodie - Debug Mode", "hoodie-debug", "Cozy hoodie for late-night debugging", 54.99, 3, 45);
  insertProduct.run("Baseball Cap - </code>", "cap-code", "Embroidered closing tag cap", 14.99, 3, 80);

  insertProduct.run("Desk Lamp LED", "desk-lamp-led", "Adjustable color temperature desk lamp", 32.99, 4, 35);
  insertProduct.run("Cable Management Kit", "cable-mgmt-kit", "25-piece cable organizer set", 12.99, 4, 150);
  insertProduct.run("Standing Desk Mat", "standing-desk-mat", "Anti-fatigue mat for standing desks", 44.99, 4, 20);

  const insertCartItem = db.prepare(
    `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)`
  );

  insertCartItem.run(1, 1, 1);
  insertCartItem.run(1, 6, 2);
  insertCartItem.run(1, 11, 1);

  const getCount = (table: string) =>
    (db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as any).count as number;

  const outOfStock = (db.prepare(`SELECT COUNT(*) as count FROM products WHERE stock = 0`).get() as any)
    .count as number;

  return {
    users: getCount("users"),
    sessions: getCount("sessions"),
    categories: getCount("categories"),
    products: getCount("products"),
    cart_items: getCount("cart_items"),
    out_of_stock: outOfStock,
  };
}
