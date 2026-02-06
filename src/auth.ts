import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import crypto from "crypto";
import db from "./db.js";
import { shouldIgnoreSessionExpiry } from "./bugs.js";

// ─── Types ─────────────────────────────────────────────────────

export interface SessionUser {
  id: number;
  email: string;
  name: string;
}

// ─── Session helpers ───────────────────────────────────────────

export function createSession(userId: number): string {
  const sessionId = `sess_${crypto.randomBytes(16).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`
  ).run(sessionId, userId, expiresAt.toISOString());

  return sessionId;
}

export function getSessionUser(sessionId: string): SessionUser | null {
  // buggy-auth-3: ignore session expiry — expired sessions still work
  const query = shouldIgnoreSessionExpiry()
    ? `SELECT u.id, u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    : `SELECT u.id, u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`;

  const row = db.prepare(query).get(sessionId) as SessionUser | undefined;

  return row ?? null;
}

export function destroySession(sessionId: string): void {
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
}

// ─── Middleware ─────────────────────────────────────────────────

// Sets c.get("user") if a valid session cookie exists.
// Does NOT block the request — routes decide whether to require auth.
export async function sessionMiddleware(c: Context, next: Next) {
  const sessionId = getCookie(c, "session_id");

  if (sessionId) {
    const user = getSessionUser(sessionId);
    if (user) {
      c.set("user", user);
    }
  }

  await next();
}

// Helper: redirect to login if not authenticated
export function requireAuth(c: Context): SessionUser | null {
  const user = c.get("user") as SessionUser | undefined;
  if (!user) return null;
  return user;
}

// ─── Cookie helpers ────────────────────────────────────────────

export function setSessionCookie(c: Context, sessionId: string) {
  setCookie(c, "session_id", sessionId, {
    httpOnly: true,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
    sameSite: "Lax",
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, "session_id", { path: "/" });
}