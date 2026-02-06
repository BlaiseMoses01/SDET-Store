import { Hono } from "hono";
import db from "./db.js";
import { getMode, setMode, VALID_MODES } from "./bugs.js";
import { seedDatabase } from "./seed-data.js";

const admin = new Hono();

function requireAdmin(c: any) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return c.json({ error: "admin_disabled" }, 501);
  }

  const token =
    c.req.header("x-admin-token")?.trim() ||
    c.req.query("token")?.trim();

  if (!token || token !== adminToken) {
    return c.json({ error: "forbidden" }, 403);
  }

  return null;
}

admin.get("/__admin/mode", (c) => {
  const blocked = requireAdmin(c);
  if (blocked) return blocked;
  return c.json({ ok: true, mode: getMode() });
});

admin.post("/__admin/mode", async (c) => {
  const blocked = requireAdmin(c);
  if (blocked) return blocked;

  let body: any = null;
  try {
    body = await c.req.json();
  } catch {
    body = null;
  }

  const nextMode = (body?.mode as string | undefined)?.trim();
  if (!nextMode) {
    return c.json({ error: "missing_mode" }, 400);
  }

  if (!VALID_MODES.includes(nextMode as any)) {
    return c.json({ error: "invalid_mode", valid_modes: VALID_MODES }, 400);
  }

  setMode(nextMode);
  return c.json({ ok: true, mode: getMode() });
});

admin.post("/__admin/seed", (c) => {
  const blocked = requireAdmin(c);
  if (blocked) return blocked;

  const summary = seedDatabase(db);
  return c.json({ ok: true, summary });
});

export default admin;
