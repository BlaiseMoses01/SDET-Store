import { Hono } from "hono";
import db from "./db.js";
import { layout } from "./layout.js";
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  destroySession,
  requireAuth,
  type SessionUser,
} from "./auth.js";
import {
  shouldSkipPasswordCheck,
  shouldSkipDuplicateEmailCheck,
} from "./bugs.js";
import { HonoVars } from "./types.js";

const auth = new Hono<{Variables:HonoVars}>();

// ─── Signup ────────────────────────────────────────────────────

auth.get("/signup", (c) => {
  const user = c.get("user") as SessionUser | undefined;
  if (user) return c.redirect("/products");

  return c.html(
    layout(
      "Sign Up",
      `
    <div class="card" style="max-width: 400px; margin: 2rem auto;">
      <h1 style="margin-bottom: 1rem;">Create an account</h1>
      <form method="POST" action="/signup" data-testid="signup-form">
        <div class="form-group">
          <label for="name">Full Name</label>
          <input type="text" id="name" name="name" data-testid="signup-name"
                 required placeholder="Jane Doe" />
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" data-testid="signup-email"
                 required placeholder="jane@example.com" />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" data-testid="signup-password"
                 required placeholder="Min 8 chars, 1 uppercase, 1 number" />
        </div>
        <div class="form-group">
          <label for="confirm_password">Confirm Password</label>
          <input type="password" id="confirm_password" name="confirm_password"
                 data-testid="signup-confirm" required placeholder="Re-enter password" />
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;"
                data-testid="signup-submit">Sign Up</button>
      </form>
      <p style="margin-top: 1rem; text-align: center; font-size: 0.9rem;">
        Already have an account? <a href="/login">Log in</a>
      </p>
    </div>
    `
    )
  );
});

auth.post("/signup", async (c) => {
  const body = await c.req.parseBody();
  const name = (body.name as string)?.trim();
  const email = (body.email as string)?.trim().toLowerCase();
  const password = body.password as string;
  const confirmPassword = body.confirm_password as string;

  const errors: string[] = [];

  if (!name || name.length < 2) {
    errors.push("Name must be at least 2 characters.");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Please enter a valid email address.");
  }

  if (!password || password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  } else if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter.");
  } else if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number.");
  }

  if (password !== confirmPassword) {
    errors.push("Passwords do not match.");
  }

  // Check duplicate email
  if (errors.length === 0 && !shouldSkipDuplicateEmailCheck()) {
    const existing = db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get(email);
    if (existing) {
      errors.push("An account with this email already exists.");
    }
  }

  if (errors.length > 0) {
    return c.html(
      layout(
        "Sign Up",
        `
      <div class="card" style="max-width: 400px; margin: 2rem auto;">
        <h1 style="margin-bottom: 1rem;">Create an account</h1>
        <div class="alert alert-error" data-testid="signup-errors">
          ${errors.map((e) => `<div>${e}</div>`).join("")}
        </div>
        <form method="POST" action="/signup" data-testid="signup-form">
          <div class="form-group">
            <label for="name">Full Name</label>
            <input type="text" id="name" name="name" data-testid="signup-name"
                   value="${name || ""}" required />
          </div>
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" data-testid="signup-email"
                   value="${email || ""}" required />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" data-testid="signup-password" required />
          </div>
          <div class="form-group">
            <label for="confirm_password">Confirm Password</label>
            <input type="password" id="confirm_password" name="confirm_password"
                   data-testid="signup-confirm" required />
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%;"
                  data-testid="signup-submit">Sign Up</button>
        </form>
      </div>
      `
      )
    );
  }

  // Create user and session
  const result = db
    .prepare(`INSERT INTO users (email, password, name) VALUES (?, ?, ?)`)
    .run(email, password, name);

  const sessionId = createSession(result.lastInsertRowid as number);
  setSessionCookie(c, sessionId);

  return c.redirect("/products");
});

// ─── Login ─────────────────────────────────────────────────────

auth.get("/login", (c) => {
  const user = c.get("user") as SessionUser | undefined;
  if (user) return c.redirect("/products");

  return c.html(
    layout(
      "Login",
      `
    <div class="card" style="max-width: 400px; margin: 2rem auto;">
      <h1 style="margin-bottom: 1rem;">Log in</h1>
      <form method="POST" action="/login" data-testid="login-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" data-testid="login-email"
                 required placeholder="jane@example.com" />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" data-testid="login-password"
                 required placeholder="Your password" />
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;"
                data-testid="login-submit">Log In</button>
      </form>
      <p style="margin-top: 1rem; text-align: center; font-size: 0.9rem;">
        Don't have an account? <a href="/signup">Sign up</a>
      </p>
    </div>
    `
    )
  );
});

auth.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const email = (body.email as string)?.trim().toLowerCase();
  const password = body.password as string;

  let error = "";

  if (!email || !password) {
    error = "Please enter both email and password.";
  } else {
    const user = db
      .prepare(`SELECT id, password FROM users WHERE email = ?`)
      .get(email) as { id: number; password: string } | undefined;

    if (!user) {
      error = "Invalid email or password.";
    } else if (!shouldSkipPasswordCheck(email) && user.password !== password) {
      error = "Invalid email or password.";
    } else {
      // Success
      const sessionId = createSession(user.id);
      setSessionCookie(c, sessionId);
      return c.redirect("/products");
    }
  }

  return c.html(
    layout(
      "Login",
      `
    <div class="card" style="max-width: 400px; margin: 2rem auto;">
      <h1 style="margin-bottom: 1rem;">Log in</h1>
      <div class="alert alert-error" data-testid="login-error">${error}</div>
      <form method="POST" action="/login" data-testid="login-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" data-testid="login-email"
                 value="${email || ""}" required />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" data-testid="login-password" required />
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;"
                data-testid="login-submit">Log In</button>
      </form>
    </div>
    `
    )
  );
});

// ─── Logout ────────────────────────────────────────────────────

auth.get("/logout", async (c) => {
  const { getCookie } = await import("hono/cookie");
  const sessionId = getCookie(c, "session_id");
  if (sessionId) {
    destroySession(sessionId);
    clearSessionCookie(c);
  }
  return c.redirect("/login");
});

// ─── Account (protected) ──────────────────────────────────────

auth.get("/account", (c) => {
  const user = requireAuth(c);
  if (!user) return c.redirect("/login");

  return c.html(
    layout(
      "Account",
      `
    <div class="card" style="max-width: 500px; margin: 2rem auto;">
      <h1 style="margin-bottom: 1rem;">Your Account</h1>
      <div data-testid="account-info">
        <p><strong>Name:</strong> <span data-testid="account-name">${user.name}</span></p>
        <p><strong>Email:</strong> <span data-testid="account-email">${user.email}</span></p>
      </div>
    </div>
    `,
      user
    )
  );
});

export default auth;
