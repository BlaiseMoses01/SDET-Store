import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import db from "./db.js";
import { getMode, setMode, VALID_MODES } from "./bugs.js";
import { seedDatabase } from "./seed-data.js";
import { addSubscriber, removeSubscriber, broadcast } from "./events.js";
import {
  addActivitySubscriber,
  removeActivitySubscriber,
  record,
  snapshot,
  type ActivityEvent,
} from "./activity.js";

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
  broadcast(`mode:${nextMode}`);
  record({ kind: "mode_switch", detail: nextMode });
  return c.json({ ok: true, mode: getMode() });
});

admin.post("/__admin/seed", (c) => {
  const blocked = requireAdmin(c);
  if (blocked) return blocked;

  const summary = seedDatabase(db);
  broadcast("seed");
  record({ kind: "seed" });
  return c.json({ ok: true, summary });
});

admin.get("/__admin/modes", (c) => {
  return c.json({ modes: VALID_MODES });
});

admin.get("/__admin/state", (c) => {
  const blocked = requireAdmin(c);
  if (blocked) return blocked;

  const users = db
    .prepare("SELECT id, email, name, password FROM users ORDER BY id")
    .all();

  const sessions = db
    .prepare(
      `SELECT user_id, expires_at,
              CASE WHEN expires_at > datetime('now') THEN 0 ELSE 1 END AS expired
       FROM sessions
       ORDER BY user_id, expires_at DESC`,
    )
    .all();

  const carts = db
    .prepare(
      `SELECT ci.user_id, p.name AS product, p.price, ci.quantity
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       ORDER BY ci.user_id, p.name`,
    )
    .all();

  const orders = db
    .prepare(
      `SELECT id, user_id, status, total, created_at
       FROM orders
       ORDER BY id DESC
       LIMIT 20`,
    )
    .all();

  return c.json({ users, sessions, carts, orders });
});

// Ecom-browser refresh trigger (existing).
admin.get("/__admin/events", (c) => {
  return streamSSE(c, async (stream) => {
    const send = (data: string) => {
      stream.writeSSE({ data }).catch(() => {});
    };
    addSubscriber(send);

    const keepalive = setInterval(() => {
      stream.writeSSE({ data: "", event: "keepalive" }).catch(() => {});
    }, 25_000);

    stream.onAbort(() => {
      clearInterval(keepalive);
      removeSubscriber(send);
    });

    await new Promise<void>((resolve) => {
      stream.onAbort(() => resolve());
    });
  });
});

// Admin-only live activity feed.
admin.get("/__admin/activity", (c) => {
  const blocked = requireAdmin(c);
  if (blocked) return blocked;

  return streamSSE(c, async (stream) => {
    for (const e of snapshot()) {
      await stream.writeSSE({ data: JSON.stringify(e) }).catch(() => {});
    }

    const onEvent = (e: ActivityEvent) => {
      stream.writeSSE({ data: JSON.stringify(e) }).catch(() => {});
    };
    addActivitySubscriber(onEvent);

    const keepalive = setInterval(() => {
      stream.writeSSE({ data: "", event: "keepalive" }).catch(() => {});
    }, 25_000);

    stream.onAbort(() => {
      clearInterval(keepalive);
      removeActivitySubscriber(onEvent);
    });

    await new Promise<void>((resolve) => {
      stream.onAbort(() => resolve());
    });
  });
});

export default admin;
