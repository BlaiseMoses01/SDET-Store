# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run seed:dev    # drop + recreate tables and reinsert fixtures into ./db/sqlite.db
npm run dev         # tsx watch on src/server.ts (reads ./db/sqlite.db)
npm run build       # tsc → app/dist
npm run seed        # node app/dist/db/seed.js (post-build seed)
npm start           # node app/dist/src/server.js
```

There is no test runner wired up. The `.feature` files under `features/` are Gherkin documentation only — they describe expected behavior and the `@xfail-<mode>` tags map to the bug modes (see `docs/bug-key.md`). Do not assume a `test` script exists.

The dev/seed scripts pin `DATABASE_URL=./db/sqlite.db`; production/Docker default to `/data/sqlite.db`. `DATABASE_URL` accepts a bare path or a `file://` URL.

## Architecture

A single Hono app serving both server-rendered HTML and a JSON API from one process, backed by `better-sqlite3` (synchronous, single-file DB).

**Request pipeline** (`src/server.ts`): `sessionMiddleware` runs on every route and populates `c.set("user", ...)` if a valid `session_id` cookie exists. It never blocks — each route module decides whether auth is required. Route modules are mounted at `/`: `routes-auth`, `routes-products`, `routes-cart`, `routes-checkout` (HTML UI); `routes-api` (`/api/*` JSON); `routes-admin` (`/__admin/*`).

**HTML rendering** uses `src/layout.ts` — a plain string template, no JSX/framework. UI elements expose `data-testid` attributes for test automation.

**Bug registry (`src/bugs.ts`) is the core abstraction.** All 19 intentional defects live behind named predicates (`shouldSkipPasswordCheck`, `shouldIgnoreApiInStockFilter`, etc.) that read a single module-level `mode` variable. Routes call these at decision points to branch between correct and buggy behavior. Mode is set from `APP_MODE` at startup and can be flipped at runtime via `POST /__admin/mode` (no restart). When adding behavior:

- A new bug ⇒ add to `VALID_MODES` in `src/bugs.ts`, add a `shouldX()` predicate, branch in the relevant route, document in `README.md` and `docs/bug-key.md`, and add an `@xfail-<mode>` scenario to the matching `features/**/*.feature`.
- Healthy-mode logic should remain the obvious default; the buggy branch should be the explicit deviation.

**Database lifecycle:** `src/seed-data.ts` exports `seedDatabase(db)`, which **drops and recreates every table** before reinserting fixtures. It is called by `db/seed.ts` (CLI) and `POST /__admin/seed` (runtime). Schema changes go here, not in a migration. The deterministic fixtures (users, sessions including one expired, products with two out-of-stock, Alice's preloaded cart) are intentional and referenced by feature specs — don't change IDs or quantities without updating `README.md` "Seeded Test Data" and the features.

**Admin endpoints** (`src/routes-admin.ts`) are gated by `ADMIN_TOKEN` env var. If unset, all `/__admin/*` return 501 — this is intentional, not a bug.

**Idempotent orders:** `POST /api/orders` requires an `Idempotency-Key` header; the `idempotency_keys` table maps `(key, user_id) → order_id`. The buggy-api-orders-1 mode skips that lookup. The whole order creation runs inside `db.transaction(...)`.

**Flaky endpoint** keeps per-client counters in an in-process `Map` (lost on restart). `buggy-api-flaky-1` switches to a single global counter.

## Conventions

- TypeScript with `"module": "nodenext"` — relative imports must use `.js` extensions even though the source is `.ts` (e.g. `import db from "./db.js"`).
- Build output is `app/dist/` (not `dist/`). The `start` and `seed` scripts and the Dockerfile depend on this path.
- Passwords are stored as plain text in the seed by design (this is a test harness, not a real store). Do not "fix" this.
- The codebase deliberately uses no ORM, no JSX, no client-side JS framework — keep additions in the same minimal style.
