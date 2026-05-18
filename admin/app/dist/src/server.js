import { Hono } from "hono";
import { serve } from "@hono/node-server";
import routes from "./routes.js";
const app = new Hono();
app.route("/", routes);
const port = Number(process.env.PORT) || 3000;
console.log(`SDET Store Admin running on port ${port}`);
console.log(`  MAIN_APP_URL = ${process.env.MAIN_APP_URL || "http://localhost:3000"}`);
console.log(`  ADMIN_TOKEN  = ${process.env.ADMIN_TOKEN ? "(set)" : "(MISSING — login will fail)"}`);
serve({
    fetch: app.fetch,
    port,
    hostname: "0.0.0.0",
});
//# sourceMappingURL=server.js.map