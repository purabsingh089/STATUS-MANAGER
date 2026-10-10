import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type Database from "better-sqlite3";
import { nowIso } from "../db/client.js";
import type { AppConfig } from "../config.js";

const COOKIE = "srn_dash";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function registerDashboardAuth(app: FastifyInstance, db: Database.Database, config: AppConfig): void {
  app.post("/api/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as { password?: string };
    const expected = config.DASHBOARD_PASSWORD;
    if (!expected) {
      const token = issueSession(db, config);
      setCookie(reply, token, config);
      return { ok: true, mode: "open" };
    }
    const provided = body.password ?? "";
    if (!safeEqual(provided, expected)) {
      return reply.code(401).send({ error: "Invalid dashboard password" });
    }
    const token = issueSession(db, config);
    setCookie(reply, token, config);
    return { ok: true, mode: "password" };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = req.cookies[COOKIE];
    if (token) db.prepare("DELETE FROM dashboard_sessions WHERE token_hash = ?").run(hashToken(token));
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/session", async (req) => {
    const ok = isAuthenticated(req, db, config);
    return { authenticated: ok, passwordRequired: Boolean(config.DASHBOARD_PASSWORD) };
  });
}

export function authGuard(db: Database.Database, config: AppConfig) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url.startsWith("/api/auth/")) return;
    if (req.url === "/api/healthz") return;
    if (!isAuthenticated(req, db, config)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  };
}

export function isAuthenticated(req: FastifyRequest, db: Database.Database, config: AppConfig): boolean {
  if (!config.DASHBOARD_PASSWORD) return true;
  const token = req.cookies[COOKIE];
  if (!token) return false;
  const row = db.prepare("SELECT expires_at FROM dashboard_sessions WHERE token_hash = ?").get(hashToken(token)) as
    | { expires_at: string }
    | undefined;
  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM dashboard_sessions WHERE token_hash = ?").run(hashToken(token));
    return false;
  }
  return true;
}

function issueSession(db: Database.Database, config: AppConfig): string {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + config.DASHBOARD_SESSION_HOURS * 3600_000).toISOString();
  db.prepare("INSERT INTO dashboard_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    nowIso(),
    expires,
  );
  return token;
}

function setCookie(reply: FastifyReply, token: string, config: AppConfig): void {
  reply.setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: config.NODE_ENV === "production",
    maxAge: config.DASHBOARD_SESSION_HOURS * 3600,
  });
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
