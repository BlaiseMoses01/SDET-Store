import Database from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";

function resolveDbPath() {
  const raw = process.env.DATABASE_URL;

  // Support DATABASE_URL like: file:///data/sqlite.db
  if (raw?.startsWith("file:")) return new URL(raw).pathname;

  // Support DATABASE_URL like: /data/sqlite.db
  if (raw && raw.trim().length > 0) return raw;

  // Default for Fly/Docker
  return "/data/sqlite.db";
}

const dbPath = resolveDbPath();
const db: SqliteDatabase = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export default db;

