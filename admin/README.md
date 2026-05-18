# SDET Store — Admin Panel

Separately deployed UI for flipping bug modes and reseeding the database on the main `sdet-store` app. Acts as a thin proxy over the main app's `/__admin/*` HTTP API; holds no state of its own.

## Env vars

| Var            | Required | Example                              |
|----------------|----------|--------------------------------------|
| `ADMIN_TOKEN`  | yes      | same value as the main app           |
| `MAIN_APP_URL` | yes      | `https://sdet-store.fly.dev`         |
| `PORT`         | no       | defaults to `3000`                   |

## Local dev

```bash
cd admin
npm install
ADMIN_TOKEN=secret MAIN_APP_URL=http://localhost:3000 PORT=3001 npm run dev
```

(Run the main app separately with `ADMIN_TOKEN=secret npm run dev` from the repo root.)

## Deploy to Fly

```bash
fly apps create sdet-store-admin
fly secrets set ADMIN_TOKEN=... MAIN_APP_URL=https://sdet-store.fly.dev -a sdet-store-admin
fly deploy -c admin/fly.toml
```

## How auto-refresh works

When you click a mode or "Reseed Database" button, the admin app proxies the action to the main app's `/__admin/mode` or `/__admin/seed` endpoint. The main app then broadcasts an SSE event on `/__admin/events`; every open ecom-site tab is listening and calls `location.reload()`.
