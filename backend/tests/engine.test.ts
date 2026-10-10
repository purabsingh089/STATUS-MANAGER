import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { openDatabase, loadSettings } from "../src/db/client.js";
import { EventBus } from "../src/events/bus.js";
import { Logger } from "../src/logging/logger.js";
import { NotificationService } from "../src/notifications/service.js";
import { MockHostingProvider } from "../src/providers/mock.js";
import { BrowserController } from "../src/browser/controller.js";
import { AutomationEngine } from "../src/automation/engine.js";
import type { AppConfig } from "../src/config.js";

function makeEngine() {
  const dir = mkdtempSync(path.join(tmpdir(), "srn-"));
  const db = openDatabase(path.join(dir, "test.db"));
  const bus = new EventBus();
  const logger = new Logger(db, bus);
  const getSettings = () => loadSettings(db);
  const notifications = new NotificationService(db, bus, logger, getSettings);
  const mock = new MockHostingProvider();
  const browser = new BrowserController(
    { userDataDir: path.join(dir, "browser"), headless: true, enabled: false },
    logger,
  );
  const config = {
    NODE_ENV: "test",
    PORT: 3001,
    FRONTEND_ORIGIN: "http://localhost:3000",
    DATABASE_PATH: path.join(dir, "test.db"),
    PROVIDER: "mock",
    playwrightEnabled: false,
    playwrightHeadless: true,
    autoStart: false,
    encryptionKey: randomBytes(32),
    sessionSecret: "x".repeat(32),
  } as unknown as AppConfig;
  const engine = new AutomationEngine(db, bus, logger, notifications, mock, browser, config, getSettings, config.encryptionKey);
  return { engine, mock, dir, db };
}

describe("AutomationEngine", () => {
  let ctx: ReturnType<typeof makeEngine>;

  beforeEach(() => {
    ctx = makeEngine();
  });

  afterEach(() => {
    ctx.db.close();
    rmSync(ctx.dir, { recursive: true, force: true });
  });

  it("connects via mock login and reaches RUNNING", async () => {
    await ctx.engine.connectWithCredentials("demo", "pass");
    expect(ctx.engine.snapshot().state).toBe("RUNNING");
    expect(ctx.engine.snapshot().pageUrl).toBeNull();
    expect(ctx.engine.getServers().length).toBe(2);
    expect(ctx.engine.getAccount()?.loginState).toBe("authenticated");
  });

  it("pauses on security challenge without solving it", async () => {
    await ctx.engine.connectWithCredentials("demo", "pass");
    ctx.mock.setScenario("security_challenge");
    await ctx.engine.healthCheck();
    expect(ctx.engine.snapshot().state).toBe("CHALLENGE_REQUIRED");
    expect(ctx.engine.snapshot().reason).toContain("verification");
  });

  it("detects session expiry", async () => {
    await ctx.engine.connectWithCredentials("demo", "pass");
    ctx.mock.setScenario("session_expired");
    await ctx.engine.healthCheck();
    expect(["SESSION_EXPIRED", "LOGIN_REQUIRED"]).toContain(ctx.engine.snapshot().state);
  });

  it("stop leaves STOPPED", async () => {
    await ctx.engine.connectWithCredentials("demo", "pass");
    await ctx.engine.stop();
    expect(ctx.engine.snapshot().state).toBe("STOPPED");
  });
});
