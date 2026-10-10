import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type Database from "better-sqlite3";
import type { AutomationEngine } from "../automation/engine.js";
import type { Logger } from "../logging/logger.js";
import type { NotificationService } from "../notifications/service.js";
import { loadSettings, saveSettings } from "../db/client.js";
import type { AppSettings } from "../types.js";
import type { MockHostingProvider } from "../providers/mock.js";
import { AppError } from "../types.js";

const settingsSchema = z.object({
  autoStart: z.boolean().optional(),
  healthCheckIntervalMs: z.number().int().min(5_000).max(600_000).optional(),
  serverCheckIntervalMs: z.number().int().min(5_000).max(600_000).optional(),
  accountSyncIntervalMs: z.number().int().min(10_000).max(3_600_000).optional(),
  retryCount: z.number().int().min(1).max(10).optional(),
  retryDelayMs: z.number().int().min(500).max(60_000).optional(),
  browserRestartOnCrash: z.boolean().optional(),
  browserNotifications: z.boolean().optional(),
  webhookNotifications: z.boolean().optional(),
  webhookUrl: z.string().nullable().optional(),
  appearance: z.enum(["dark", "light", "system"]).optional(),
  dailyReportHour: z.number().int().min(0).max(23).optional(),
  dailyReportMinute: z.number().int().min(0).max(59).optional(),
});

const connectSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export function registerRoutes(
  app: FastifyInstance,
  deps: {
    db: Database.Database;
    engine: AutomationEngine;
    logger: Logger;
    notifications: NotificationService;
    mock?: MockHostingProvider;
  },
): void {
  const { db, engine, logger, notifications, mock } = deps;

  app.get("/api/healthz", async () => ({ ok: true }));

  app.get("/api/status", async () => ({
    automation: engine.snapshot(),
    health: engine.getHealth(),
    account: engine.getAccount(),
  }));

  app.get("/api/account", async () => {
    const account = engine.getAccount();
    if (!account) return { account: null, note: "No account connected yet." };
    return { account };
  });

  app.post("/api/account/connect", async (req, reply) => {
    const parsed = connectSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await engine.connectWithCredentials(parsed.data.username, parsed.data.password);
    return { ok: true, automation: engine.snapshot() };
  });

  app.post("/api/account/disconnect", async () => {
    await engine.disconnectAccount();
    return { ok: true };
  });

  app.get("/api/servers", async () => ({
    servers: engine.getServers(),
    note: engine.getServers().length === 0 ? "No server metrics are available from the current provider." : undefined,
  }));

  app.get("/api/servers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const found = engine.getServers().find((s) => s.id === id);
    if (!found) return reply.code(404).send({ error: "Server not found", id });
    return { server: found };
  });

  app.get("/api/automation", async () => engine.snapshot());
  app.post("/api/automation/start", async () => {
    await engine.start();
    return engine.snapshot();
  });
  app.post("/api/automation/stop", async () => {
    await engine.stop();
    return engine.snapshot();
  });
  app.post("/api/automation/pause", async () => {
    await engine.pause();
    return engine.snapshot();
  });
  app.post("/api/automation/resume", async () => {
    await engine.resume();
    return engine.snapshot();
  });

  app.post("/api/browser/restart", async () => {
    await engine.restartBrowser();
    return engine.snapshot();
  });
  app.post("/api/session/reconnect", async () => {
    await engine.reconnect();
    return engine.snapshot();
  });

  app.get("/api/logs", async (req) => {
    const q = req.query as { level?: string; limit?: string };
    const rows = logger.query({
      level: q.level as "DEBUG" | "INFO" | "WARN" | "ERROR" | undefined,
      limit: q.limit ? Number(q.limit) : 200,
    });
    return { logs: rows };
  });

  app.get("/api/activity", async (req) => {
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 100), 300);
    const rows = db.prepare("SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?").all(limit);
    return { activity: rows };
  });

  app.get("/api/notifications", async () => ({ notifications: notifications.list() }));
  app.post("/api/notifications/:id/read", async (req) => {
    const { id } = req.params as { id: string };
    notifications.markRead(Number(id));
    return { ok: true };
  });

  app.get("/api/settings", async () => ({ settings: loadSettings(db) }));
  app.put("/api/settings", async (req, reply) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const current = loadSettings(db);
    const next: AppSettings = { ...current, ...parsed.data };
    saveSettings(db, next);
    return { settings: next };
  });

  app.get("/api/health", async () => engine.getHealth());

  app.get("/api/rewards", async () => {
    const accountId = engine.getAccountId();
    if (!accountId) return { coins: null, snapshots: [], note: "No observations recorded yet." };
    const snapshots = db
      .prepare("SELECT * FROM coin_snapshots WHERE account_id = ? ORDER BY id DESC LIMIT 200")
      .all(accountId);
    const latest = snapshots[0] as { balance: number; timestamp: string; change_amount: number | null } | undefined;
    return {
      coins: latest?.balance ?? null,
      change: latest?.change_amount ?? null,
      lastObservedAt: latest?.timestamp ?? null,
      snapshots,
    };
  });

  app.get("/api/resources", async () => {
    const accountId = engine.getAccountId();
    if (!accountId) return { resources: null };
    const row = db
      .prepare("SELECT * FROM resource_snapshots WHERE account_id = ? ORDER BY id DESC LIMIT 1")
      .get(accountId);
    return { resources: row ?? null };
  });

  app.get("/api/scheduler", async () => ({ tasks: engine.scheduler.list() }));

  app.post("/api/dev/scenario", async (req, reply) => {
    if (!mock) return reply.code(404).send({ error: "Mock provider is not active" });
    const body = (req.body ?? {}) as { scenario?: string };
    const allowed = [
      "connected",
      "disconnected",
      "session_expired",
      "server_offline",
      "network_failure",
      "security_challenge",
      "browser_crash",
    ] as const;
    if (!body.scenario || !allowed.includes(body.scenario as (typeof allowed)[number])) {
      return reply.code(400).send({ error: "Invalid scenario", allowed });
    }
    mock.setScenario(body.scenario as (typeof allowed)[number]);
    if (body.scenario === "connected") await engine.start();
    if (body.scenario === "security_challenge") await engine.healthCheck();
    if (body.scenario === "session_expired") await engine.healthCheck();
    if (body.scenario === "network_failure") await engine.healthCheck();
    if (body.scenario === "server_offline") await engine.syncServers();
    return { ok: true, scenario: mock.getScenario(), automation: engine.snapshot() };
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: err.message, code: err.code });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    logger.error("API error", { error: message });
    const status = message.includes("Manual") || message.includes("verification") ? 409 : 500;
    return reply.code(status).send({ error: message });
  });
}
