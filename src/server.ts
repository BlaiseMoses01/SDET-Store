import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { SessionUser } from "./auth.js";
import { sessionMiddleware } from "./auth.js";
import { record } from "./activity.js";
import auth from "./routes-auth.js";
import products from "./routes-products.js";
import cart from "./routes-cart.js";
import checkout from "./routes-checkout.js";
import api from "./routes-api.js";
import admin from "./routes-admin.js";

const app = new Hono();

app.use("*", sessionMiddleware);

const ACTIVITY_INCLUDE = [
  /^\/$/,
  /^\/products/,
  /^\/cart/,
  /^\/checkout/,
  /^\/login/,
  /^\/signup/,
  /^\/logout/,
  /^\/account/,
  /^\/api\//,
];
const ACTIVITY_EXCLUDE = [/^\/__admin/, /^\/favicon/];

app.use("*", async (c, next) => {
  await next();
  try {
    const path = c.req.path;
    if (ACTIVITY_EXCLUDE.some((r) => r.test(path))) return;
    if (!ACTIVITY_INCLUDE.some((r) => r.test(path))) return;
    const user = (c as any).get("user") as SessionUser | undefined;
    const url = new URL(c.req.url);
    record({
      kind: "http",
      method: c.req.method,
      path: path + url.search,
      status: c.res.status,
      user: user?.email,
    });
  } catch {
    // never break a request because of activity recording
  }
});

app.get("/", (c) => c.redirect("/products"));

app.route("/", auth);
app.route("/", products);
app.route("/", cart);
app.route("/", checkout);
app.route("/", api);
app.route("/", admin);

const port = Number(process.env.PORT) || 3000;

console.log(`SDET Store running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
  hostname: "0.0.0.0",
});
