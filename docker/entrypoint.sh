#!/usr/bin/env sh
set -e

DB_PATH="${DATABASE_URL:-/data/sqlite.db}"
if echo "$DB_PATH" | grep -q "^file:"; then
  DB_PATH="${DB_PATH#file://}"
fi

if [ "${SEED_ON_START:-1}" = "1" ]; then
  if [ "${FORCE_SEED:-0}" = "1" ]; then
    echo "FORCE_SEED=1: reseeding database"
    node /app/app/dist/db/seed.js
  elif [ ! -f "$DB_PATH" ]; then
    echo "Database not found at $DB_PATH. Seeding..."
    node /app/app/dist/db/seed.js
  else
    echo "Database already exists at $DB_PATH. Skipping seed."
  fi
fi

exec node /app/app/dist/src/server.js
