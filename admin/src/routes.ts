import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { layout } from "./layout.js";
import { createSession, destroy, isValid } from "./session.js";
import { describeMode } from "./mode-descriptions.js";

const COOKIE = "admin_session";
const routes = new Hono();

type User = { id: number; email: string; name: string; password: string };
type SessionRow = { user_id: number; expires_at: string; expired: number };
type CartRow = { user_id: number; product: string; price: number; quantity: number };
type OrderRow = {
  id: number;
  user_id: number;
  status: string;
  total: number;
  created_at: string;
};
type State = {
  users: User[];
  sessions: SessionRow[];
  carts: CartRow[];
  orders: OrderRow[];
};

function adminToken(): string | undefined {
  return process.env.ADMIN_TOKEN;
}

function mainAppUrl(): string {
  return (process.env.MAIN_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function requireLogin(c: any): boolean {
  return isValid(getCookie(c, COOKIE));
}

function setSessionCookie(c: any, sid: string) {
  setCookie(c, COOKIE, sid, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 24 * 60 * 60,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderLogin(error?: string): string {
  return layout(
    "Login",
    `<div class="card" style="max-width: 420px; margin: 0 auto;">
      <h1>Admin Login</h1>
      <h2>Enter the admin token to continue.</h2>
      ${error ? `<div class="alert alert-error" data-testid="login-error">${escapeHtml(error)}</div>` : ""}
      <form method="POST" action="/login">
        <div class="form-group">
          <label for="token">Admin Token</label>
          <input type="password" id="token" name="token" required autofocus data-testid="login-token">
        </div>
        <button type="submit" class="btn btn-primary" data-testid="login-submit">Log in</button>
      </form>
    </div>`,
    false,
  );
}

const GROUP_ORDER: Array<{ label: string; match: (m: string) => boolean }> = [
  { label: "Healthy", match: (m) => m === "healthy" },
  { label: "UI — Auth", match: (m) => m.startsWith("buggy-auth-") },
  { label: "UI — Products", match: (m) => m.startsWith("buggy-products-") },
  { label: "UI — Cart", match: (m) => m.startsWith("buggy-cart-") },
  { label: "UI — Checkout", match: (m) => m.startsWith("buggy-checkout-") },
  { label: "API", match: (m) => m.startsWith("buggy-api-") },
];

function groupModes(modes: string[]): Array<{ label: string; items: string[] }> {
  return GROUP_ORDER
    .map((g) => ({ label: g.label, items: modes.filter(g.match) }))
    .filter((g) => g.items.length > 0);
}

function modeButton(mode: string, current: string): string {
  const classes = ["mode-btn"];
  if (mode === current) classes.push("active");
  if (mode === "healthy") classes.push("healthy");
  const desc = describeMode(mode);
  return `<form method="POST" action="/panel/mode" class="mode-btn-form">
    <input type="hidden" name="mode" value="${escapeHtml(mode)}">
    <button type="submit" class="${classes.join(" ")}" data-testid="mode-btn-${escapeHtml(mode)}">
      <span class="mode-name"><span class="dot"></span>${escapeHtml(mode)}</span>
      ${desc ? `<span class="mode-desc">${escapeHtml(desc)}</span>` : ""}
    </button>
  </form>`;
}

function fmtPrice(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtTimestamp(iso: string): string {
  // Server returns "YYYY-MM-DD HH:MM:SS" in UTC. Show HH:MM:SS for compactness.
  const m = /(\d{2}:\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : iso;
}

function renderStateCard(state: State | null, error: string | null): string {
  if (error) {
    return `<div class="card" data-testid="state-card">
      <h1>Database State</h1>
      <h2>Live snapshot of users, sessions, carts, and recent orders.</h2>
      <div class="alert alert-error" data-testid="state-error">${escapeHtml(error)}</div>
    </div>`;
  }
  if (!state) {
    return `<div class="card" data-testid="state-card"><h1>Database State</h1><h2>Loading…</h2></div>`;
  }

  const { users, sessions, carts, orders } = state;
  const sessionsByUser = new Map<number, SessionRow[]>();
  for (const s of sessions) {
    if (!sessionsByUser.has(s.user_id)) sessionsByUser.set(s.user_id, []);
    sessionsByUser.get(s.user_id)!.push(s);
  }
  const cartsByUser = new Map<number, CartRow[]>();
  for (const c of carts) {
    if (!cartsByUser.has(c.user_id)) cartsByUser.set(c.user_id, []);
    cartsByUser.get(c.user_id)!.push(c);
  }
  const orderCountByUser = new Map<number, number>();
  for (const o of orders) {
    orderCountByUser.set(o.user_id, (orderCountByUser.get(o.user_id) ?? 0) + 1);
  }
  const userById = new Map(users.map((u) => [u.id, u]));

  const sessionIndicator = (uid: number): string => {
    const rows = sessionsByUser.get(uid) ?? [];
    if (rows.length === 0) return `<span class="session-dot none" title="no sessions">—</span>`;
    const hasActive = rows.some((r) => r.expired === 0);
    return hasActive
      ? `<span class="session-dot active" title="active session">✓</span>`
      : `<span class="session-dot expired" title="expired only">⨯</span>`;
  };

  const userRows = users
    .map((u) => {
      const cartItems = cartsByUser.get(u.id) ?? [];
      const cartQty = cartItems.reduce((a, b) => a + b.quantity, 0);
      const orderCount = orderCountByUser.get(u.id) ?? 0;
      return `<tr data-testid="user-row-${u.id}">
        <td>${escapeHtml(u.name)}</td>
        <td class="mono">
          <span class="copy-cell">${escapeHtml(u.email)}
            <button class="copy-btn" data-copy="${escapeHtml(u.email)}" data-testid="copy-email-${u.id}">Copy</button>
          </span>
        </td>
        <td class="mono">
          <span class="copy-cell">${escapeHtml(u.password)}
            <button class="copy-btn" data-copy="${escapeHtml(u.password)}" data-testid="copy-password-${u.id}">Copy</button>
          </span>
        </td>
        <td>${sessionIndicator(u.id)}</td>
        <td class="num" data-testid="cart-qty-${u.id}">${cartQty}</td>
        <td class="num" data-testid="order-count-${u.id}">${orderCount}</td>
      </tr>`;
    })
    .join("");

  const cartsHtml = users
    .map((u) => {
      const items = cartsByUser.get(u.id) ?? [];
      if (items.length === 0) return "";
      const total = items.reduce((a, b) => a + b.price * b.quantity, 0);
      const rows = items
        .map(
          (i) =>
            `<li>${i.quantity}× ${escapeHtml(i.product)} <span class="muted">@ ${fmtPrice(i.price)}</span></li>`,
        )
        .join("");
      return `<div class="sub-block" data-testid="cart-${u.id}">
        <div class="sub-block-head">${escapeHtml(u.name)} <span class="muted">— ${fmtPrice(total)}</span></div>
        <ul class="sub-list">${rows}</ul>
      </div>`;
    })
    .join("");

  const ordersRows = orders
    .map((o) => {
      const who = userById.get(o.user_id);
      return `<tr data-testid="order-row-${o.id}">
        <td class="mono">#${o.id}</td>
        <td>${who ? escapeHtml(who.name) : `user ${o.user_id}`}</td>
        <td><span class="order-status status-${escapeHtml(o.status)}">${escapeHtml(o.status)}</span></td>
        <td class="num">${fmtPrice(o.total)}</td>
        <td class="mono muted">${escapeHtml(fmtTimestamp(o.created_at))}</td>
      </tr>`;
    })
    .join("");

  return `<div class="card" data-testid="state-card">
    <h1>Database State</h1>
    <h2>Live snapshot — refreshes automatically when activity fires.</h2>

    <h3 class="sub-head">Users</h3>
    <table class="users-table" data-testid="users-table">
      <thead>
        <tr><th>Name</th><th>Email</th><th>Password</th><th>Session</th><th class="num">Cart</th><th class="num">Orders</th></tr>
      </thead>
      <tbody>${userRows}</tbody>
    </table>

    <h3 class="sub-head">Active Carts</h3>
    ${cartsHtml || `<p class="muted small">No active carts.</p>`}

    <h3 class="sub-head">Recent Orders</h3>
    ${
      orders.length === 0
        ? `<p class="muted small" data-testid="no-orders">No orders yet.</p>`
        : `<table class="orders-table" data-testid="orders-table">
            <thead><tr><th>ID</th><th>User</th><th>Status</th><th class="num">Total</th><th>When (UTC)</th></tr></thead>
            <tbody>${ordersRows}</tbody>
          </table>`
    }

    <p class="meta">Passwords are stored as plain text in the seed by design.</p>
  </div>`;
}

function renderActivityCard(): string {
  return `<div class="card" data-testid="activity-card">
    <div class="card-header">
      <h1>Activity</h1>
      <span class="muted small" data-testid="activity-status">connecting…</span>
    </div>
    <h2>Live feed of requests, mode switches, and reseeds.</h2>
    <div class="activity-list" data-testid="activity-list"></div>
  </div>`;
}

function renderPanelScript(): string {
  return `<script>
    (function () {
      var list = document.querySelector('[data-testid="activity-list"]');
      var status = document.querySelector('[data-testid="activity-status"]');
      var stateCard = document.querySelector('[data-testid="state-card"]');
      if (!list || !stateCard) return;

      var MAX_ROWS = 50;

      function fmtTime(ts) {
        var d = new Date(ts);
        var h = String(d.getHours()).padStart(2, '0');
        var m = String(d.getMinutes()).padStart(2, '0');
        var s = String(d.getSeconds()).padStart(2, '0');
        return h + ':' + m + ':' + s;
      }

      function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }

      function statusClass(n) {
        if (!n) return '';
        if (n >= 500) return 'st-5xx';
        if (n >= 400) return 'st-4xx';
        if (n >= 300) return 'st-3xx';
        if (n >= 200) return 'st-2xx';
        return '';
      }

      function row(e) {
        var time = '<span class="act-time">' + fmtTime(e.ts) + '</span>';
        var user = '<span class="act-user">' + escapeHtml(e.user || '(anon)') + '</span>';
        var body;
        var kindClass;
        if (e.kind === 'mode_switch') {
          kindClass = 'k-mode';
          body = '<span class="act-kind ' + kindClass + '">MODE</span><span class="act-detail">→ ' + escapeHtml(e.detail || '') + '</span>';
        } else if (e.kind === 'seed') {
          kindClass = 'k-seed';
          body = '<span class="act-kind ' + kindClass + '">SEED</span>';
        } else {
          kindClass = 'k-http';
          var st = e.status ? '<span class="act-status ' + statusClass(e.status) + '">' + e.status + '</span>' : '';
          body = '<span class="act-kind ' + kindClass + '">' + escapeHtml(e.method || '') + '</span>' +
                 '<span class="act-path">' + escapeHtml(e.path || '') + '</span>' + st;
        }
        var div = document.createElement('div');
        div.className = 'act-row';
        div.innerHTML = time + user + body;
        return div;
      }

      function append(e) {
        var node = row(e);
        list.insertBefore(node, list.firstChild);
        while (list.children.length > MAX_ROWS) list.removeChild(list.lastChild);
      }

      var refreshTimer = null;
      function scheduleStateRefresh() {
        if (refreshTimer) return;
        refreshTimer = setTimeout(function () {
          refreshTimer = null;
          fetch('/panel/state-json', { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.text() : null; })
            .then(function (html) {
              if (html == null) return;
              var tmp = document.createElement('div');
              tmp.innerHTML = html;
              var fresh = tmp.querySelector('[data-testid="state-card"]');
              if (fresh) stateCard.replaceWith(fresh), stateCard = fresh;
            })
            .catch(function () {});
        }, 500);
      }

      function isMutating(e) {
        if (e.kind === 'mode_switch' || e.kind === 'seed') return true;
        if (e.kind === 'http' && e.method && e.method !== 'GET' && e.status && e.status >= 200 && e.status < 400) return true;
        return false;
      }

      try {
        var es = new EventSource('/panel/activity-proxy');
        es.onopen = function () { if (status) status.textContent = 'live'; };
        es.onerror = function () { if (status) status.textContent = 'disconnected'; };
        es.onmessage = function (ev) {
          try {
            var e = JSON.parse(ev.data);
            append(e);
            if (isMutating(e)) scheduleStateRefresh();
          } catch (_) {}
        };
      } catch (_) {
        if (status) status.textContent = 'unavailable';
      }
    })();
  </script>`;
}

async function fetchState(): Promise<{ state: State | null; error: string | null }> {
  try {
    const res = await fetch(`${mainAppUrl()}/__admin/state`, {
      headers: { "x-admin-token": adminToken() ?? "" },
    });
    if (!res.ok) throw new Error(`state fetch ${res.status}`);
    const state = (await res.json()) as State;
    return { state, error: null };
  } catch (e: any) {
    return { state: null, error: `Could not load state: ${e?.message ?? String(e)}` };
  }
}

async function fetchModeData(): Promise<{
  currentMode: string;
  modes: string[];
  error: string | null;
}> {
  const base = mainAppUrl();
  const token = adminToken() ?? "";
  try {
    const [modeRes, modesRes] = await Promise.all([
      fetch(`${base}/__admin/mode`, { headers: { "x-admin-token": token } }),
      fetch(`${base}/__admin/modes`),
    ]);
    if (!modeRes.ok) throw new Error(`mode fetch ${modeRes.status}`);
    if (!modesRes.ok) throw new Error(`modes fetch ${modesRes.status}`);
    const currentMode = ((await modeRes.json()) as { mode: string }).mode;
    const modes = ((await modesRes.json()) as { modes: string[] }).modes;
    return { currentMode, modes, error: null };
  } catch (e: any) {
    return {
      currentMode: "(unknown)",
      modes: [],
      error: `Could not reach main app at ${base}: ${e?.message ?? String(e)}`,
    };
  }
}

async function renderPanel(flash?: { kind: "success" | "error"; msg: string }): Promise<string> {
  const [{ currentMode, modes, error: modeError }, { state, error: stateError }] =
    await Promise.all([fetchModeData(), fetchState()]);

  const groups = groupModes(modes);
  const groupsHtml = groups
    .map(
      (g) => `<div class="section-group">
        <h3>${escapeHtml(g.label)}</h3>
        <div class="mode-grid">${g.items.map((m) => modeButton(m, currentMode)).join("")}</div>
      </div>`,
    )
    .join("");

  const flashHtml = flash
    ? `<div class="alert alert-${flash.kind === "success" ? "success" : "error"}" data-testid="flash">${escapeHtml(flash.msg)}</div>`
    : "";

  const errorHtml = modeError
    ? `<div class="alert alert-error" data-testid="fetch-error">${escapeHtml(modeError)}</div>`
    : "";

  const currentModeClass = currentMode === "healthy" ? "current-mode healthy" : "current-mode";

  return layout(
    "Panel",
    `${errorHtml}${flashHtml}
    <div class="card">
      <div class="card-header">
        <h1>Bug Mode</h1>
      </div>
      <div class="current-mode-row">
        <span class="label">Currently running:</span>
        <span class="${currentModeClass}" data-testid="current-mode">${escapeHtml(currentMode)}</span>
      </div>
      <h2>Click a mode to switch the main app. Connected ecom tabs auto-refresh.</h2>
      ${groupsHtml}
    </div>

    ${renderActivityCard()}

    ${renderStateCard(state, stateError)}

    <div class="card">
      <h1>Database</h1>
      <h2>Reset all tables and reinsert seed fixtures. Use this between interview sessions to wipe state.</h2>
      <form method="POST" action="/panel/seed">
        <button type="submit" class="btn btn-danger" data-testid="reseed-btn">Reseed Database</button>
      </form>
      <p class="meta">Target: <code>${escapeHtml(mainAppUrl())}</code></p>
    </div>
    ${renderPanelScript()}`,
    true,
  );
}

routes.get("/", (c) => {
  if (requireLogin(c)) return c.redirect("/panel");
  return c.html(renderLogin());
});

routes.post("/login", async (c) => {
  const expected = adminToken();
  if (!expected) {
    return c.html(renderLogin("ADMIN_TOKEN is not configured on the admin app."), 500);
  }
  const form = await c.req.parseBody();
  const submitted = (form.token as string | undefined)?.trim();
  if (!submitted || submitted !== expected) {
    return c.html(renderLogin("Invalid token."), 401);
  }
  const sid = createSession();
  setSessionCookie(c, sid);
  return c.redirect("/panel");
});

routes.get("/panel", async (c) => {
  if (!requireLogin(c)) return c.redirect("/");
  return c.html(await renderPanel());
});

routes.post("/panel/mode", async (c) => {
  if (!requireLogin(c)) return c.redirect("/");
  const form = await c.req.parseBody();
  const mode = (form.mode as string | undefined)?.trim();
  if (!mode) {
    return c.html(await renderPanel({ kind: "error", msg: "Missing mode." }), 400);
  }

  try {
    const res = await fetch(`${mainAppUrl()}/__admin/mode`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-token": adminToken() ?? "",
      },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) {
      const text = await res.text();
      return c.html(
        await renderPanel({ kind: "error", msg: `Main app returned ${res.status}: ${text}` }),
        502,
      );
    }
  } catch (e: any) {
    return c.html(
      await renderPanel({ kind: "error", msg: `Request failed: ${e?.message ?? String(e)}` }),
      502,
    );
  }

  return c.html(await renderPanel({ kind: "success", msg: `Mode set to ${mode}.` }));
});

routes.post("/panel/seed", async (c) => {
  if (!requireLogin(c)) return c.redirect("/");
  try {
    const res = await fetch(`${mainAppUrl()}/__admin/seed`, {
      method: "POST",
      headers: { "x-admin-token": adminToken() ?? "" },
    });
    if (!res.ok) {
      const text = await res.text();
      return c.html(
        await renderPanel({ kind: "error", msg: `Main app returned ${res.status}: ${text}` }),
        502,
      );
    }
  } catch (e: any) {
    return c.html(
      await renderPanel({ kind: "error", msg: `Request failed: ${e?.message ?? String(e)}` }),
      502,
    );
  }

  return c.html(await renderPanel({ kind: "success", msg: "Database reseeded." }));
});

routes.post("/logout", (c) => {
  const sid = getCookie(c, COOKIE);
  destroy(sid);
  deleteCookie(c, COOKIE, { path: "/" });
  return c.redirect("/");
});

// Client-side fetch target — returns just the state-card HTML for in-place swap.
routes.get("/panel/state-json", async (c) => {
  if (!requireLogin(c)) return c.redirect("/");
  const { state, error } = await fetchState();
  return c.html(renderStateCard(state, error));
});

// SSE pass-through so the browser doesn't need the admin token.
routes.get("/panel/activity-proxy", async (c) => {
  if (!requireLogin(c)) return c.redirect("/");

  const upstream = await fetch(`${mainAppUrl()}/__admin/activity`, {
    headers: { "x-admin-token": adminToken() ?? "" },
  });

  if (!upstream.ok || !upstream.body) {
    return c.text(`Upstream activity stream unavailable (${upstream.status})`, 502);
  }

  c.header("content-type", "text/event-stream");
  c.header("cache-control", "no-cache");
  c.header("x-accel-buffering", "no");

  return c.body(upstream.body);
});

export default routes;
