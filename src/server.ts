import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { sessionMiddleware } from "./auth.js";
import auth from "./routes-auth.js";
import products from "./routes-products.js";
import cart from "./routes-cart.js";
import checkout from "./routes-checkout.js";
import api from "./routes-api.js";
import admin from "./routes-admin.js";

const app = new Hono();

app.use("*", sessionMiddleware);

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
