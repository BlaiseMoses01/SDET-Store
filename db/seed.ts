import Database from "better-sqlite3";
import { seedDatabase } from "../src/seed-data.js";

function resolveDbPath() {
  const raw = process.env.DATABASE_URL;

  // Supports: DATABASE_URL="file:///data/sqlite.db"
  if (raw?.startsWith("file:")) return new URL(raw).pathname;

  // Supports: DATABASE_URL="/data/sqlite.db"
  if (raw && raw.trim().length > 0) return raw;

  // Default for Fly volume
  return "/data/sqlite.db";
}

const DB_PATH = resolveDbPath();
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const summary = seedDatabase(db);

console.log("Database seeded successfully.");
console.log(`  Users: ${summary.users}`);
console.log(`  Sessions: ${summary.sessions} (1 valid, 1 expired)`);
console.log(`  Categories: ${summary.categories}`);
console.log(`  Products: ${summary.products} (${summary.out_of_stock} out of stock)`);
console.log(`  Cart items: ${summary.cart_items} (Alice's cart, total: $179.96)`);
console.log(`\n  DB path: ${DB_PATH}`);

db.close();
