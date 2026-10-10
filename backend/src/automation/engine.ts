import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { AppConfig } from "../config.js";
import { nowIso } from "../db/client.js";
import type { EventBus } from "../events/bus.js";
import type { Logger } from "../logging/logger.js";
import { NotificationService } from "../notifications/service.js";
import type { HostingProviderAdapter } from "../providers/types.js";
import { BrowserController } from "../browser/controller.js";
import { CircuitBreaker, RetryExhaustedError, withExponentialBackoff } from "../retry/backoff.js";
import { AutomationStateMachine } from "../state/machine.js";
import type {
  AccountInfo,
  AppSettings,
  AutomationSnapshot,
  HealthSnapshot,
  HealthStatus,
  ServerInfo,
} from "../types.js";
import { Scheduler } from "./scheduler.js";
import { decryptSecret } from "../crypto/secrets.js";

export class AutomationEngine {
  readonly machine = new AutomationStateMachine("IDLE");
  readonly scheduler = new Scheduler();
  private startedAt: number | null = null;
  private lastCheckAt: string | null = null;
  private runId: string | null = null;
  private health: HealthSnapshot = {
    browser: "unknown",
    network: "unknown",
    srncloud: "unknown",
    authentication: "unknown",
    session: "unknown",
    automation: "unknown",
  };
  private account: AccountInfo | null = null;
  private servers: ServerInfo[] = [];
  private recovering = false;
  private readonly networkBreaker = new CircuitBreaker(5, 60_000);

  constructor(
    private readonly db: Database.Database,
    private readonly bus: EventBus,
    private readonly logger: Logger,
    private readonly notifications: NotificationService,
    private readonly provider: HostingProviderAdapter,
    private readonly browser: BrowserController,
    private readonly config: AppConfig,
    private readonly getSettings: () => AppSettings,
    private readonly encryptionKey: Buffer,
  ) {
    this.machine.onTransition((from, to, reason) => {
      this.logger.info(`Automation ${from} -> ${to}`, { reason: reason ?? undefined });
      this.activity(`Automation ${to.toLowerCase().replaceAll("_", " ")}`, reason);
      this.publishAutomation();
      this.updateHealthAutomation();
    });
    this.browser.onCrash(() => {
      void this.handleBrowserCrash();
    });
  }

  snapshot(): AutomationSnapshot {
    return {
      state: this.machine.state,
      reason: this.machine.lastReason,
      startedAt: this.startedAt ? new Date(this.startedAt).toISOString() : null,
      runtimeMs: this.startedAt ? Date.now() - this.startedAt : null,
      lastCheckAt: this.lastCheckAt,
      browser: this.health.browser,
      connection: this.health.network,
      runId: this.runId,
      pageUrl: this.provider.currentUrl?.() ?? null,
    };
  }

  getHealth(): HealthSnapshot {
    return { ...this.health };
  }

  getAccount(): AccountInfo | null {
    return this.account;
  }

  getAccountId(): string | null {
    return this.account?.id ?? null;
  }

  getServers(): ServerInfo[] {
    return this.servers;
  }

  async start(): Promise<void> {
    if (this.machine.state === "RUNNING" || this.machine.state === "CONNECTED") return;
    if (this.machine.state === "PAUSED") {
      await this.resume();
      return;
    }
    if (this.machine.state === "CHALLENGE_REQUIRED") {
      throw new Error("Manual verification is required before automation can start.");
    }
    if (this.machine.state === "LOGIN_REQUIRED") {
      this.machine.transition("AUTHENTICATING");
    } else if (this.machine.state !== "STARTING" && this.machine.state !== "AUTHENTICATING") {
      this.machine.transition("STARTING");
    }

    if (this.machine.state === "STARTING") {
      this.startedAt = Date.now();
      this.runId = randomUUID();
      this.db
        .prepare("INSERT INTO automation_runs (id, account_id, started_at, status) VALUES (?, ?, ?, ?)")
        .run(this.runId, this.ensureAccountRow(), nowIso(), "RUNNING");
    }

    try {
      if (this.config.playwrightEnabled) {
        await this.browser.launch();
        this.health.browser = (await this.browser.isHealthy()) ? "healthy" : "down";
      } else {
        this.health.browser = "unknown";
        this.logger.info("Browser automation skipped (PLAYWRIGHT_ENABLED=false)");
      }

      if (this.machine.state === "STARTING") this.machine.transition("AUTHENTICATING");

      const authed = await this.ensureAuthenticated();
      if (!authed) {
        this.machine.transition("LOGIN_REQUIRED", "Authentication required");
        await this.notifications.notify("session_expired", "Login required", "Connect your SRNCloud account to start monitoring.");
        return;
      }

      const challenge = await this.provider.detectChallenge();
      if (challenge.detected) {
        await this.enterChallenge(challenge.message);
        return;
      }

      this.machine.transition("CONNECTED");
      await this.holdAfkPage();
      await this.syncAll();
      this.machine.transition("RUNNING");
      this.wireScheduler();
      this.scheduler.start();
      this.activity("Automation started");
    } catch (error) {
      await this.handleStartError(error);
    }
  }

  async stop(): Promise<void> {
    if (this.machine.state === "STOPPED" || this.machine.state === "IDLE") return;
    try {
      this.machine.transition("STOPPING");
    } catch {
      this.machine.force("STOPPING", "stop requested");
    }
    this.scheduler.stop();
    await this.browser.close();
    this.endRun("STOPPED");
    this.machine.transition("STOPPED");
    this.startedAt = null;
    await this.notifications.notify("automation_stopped", "Automation stopped", "AFK Manager is no longer running.");
  }

  async pause(): Promise<void> {
    if (this.machine.state === "RUNNING" || this.machine.state === "CONNECTED") {
      this.machine.transition("PAUSED", "Paused by user");
      this.scheduler.stop();
    }
  }

  async resume(): Promise<void> {
    if (this.machine.state === "CHALLENGE_REQUIRED") {
      const challenge = await this.provider.detectChallenge();
      if (challenge.detected) {
        throw new Error("Complete the verification in the browser before resuming.");
      }
      this.machine.transition("PAUSED");
    }
    if (this.machine.state === "PAUSED") {
      this.machine.transition("RUNNING", "Resumed by user");
      this.wireScheduler();
      this.scheduler.start();
    }
  }

  async restartBrowser(): Promise<void> {
    if (!this.config.playwrightEnabled) {
      this.logger.warn("Browser restart skipped; Playwright is disabled");
      return;
    }
    await this.browser.restart();
    this.health.browser = (await this.browser.isHealthy()) ? "healthy" : "down";
    this.bus.emit("browser.status", { status: this.health.browser });
    const authed = await this.provider.isAuthenticated();
    if (!authed) {
      this.machine.force("LOGIN_REQUIRED", "Session missing after browser restart");
      await this.notifications.notify("session_expired", "Session missing", "Re-authenticate after the browser restart.");
      return;
    }
    if (this.machine.state === "BROWSER_ERROR") {
      this.machine.transition("STARTING");
      this.machine.transition("AUTHENTICATING");
      this.machine.transition("CONNECTED");
      this.machine.transition("RUNNING");
    }
  }

  async reconnect(): Promise<void> {
    this.logger.info("Reconnecting session");
    await this.syncAll();
  }

  async healthCheck(): Promise<void> {
    this.lastCheckAt = nowIso();
    try {
      if (this.networkBreaker.isOpen) {
        this.health.network = "degraded";
        this.publishHealth();
        return;
      }

      if (this.config.playwrightEnabled) {
        this.health.browser = (await this.browser.isHealthy()) ? "healthy" : "down";
        if (this.health.browser === "down") {
          await this.handleBrowserCrash();
          return;
        }
      }

      const challenge = await this.provider.detectChallenge();
      if (challenge.detected) {
        await this.enterChallenge(challenge.message);
        return;
      }

      const authed = await this.provider.isAuthenticated();
      this.health.authentication = authed ? "healthy" : "down";
      this.health.session = authed ? "healthy" : "down";
      this.health.network = "healthy";
      this.health.srncloud = "healthy";
      this.networkBreaker.recordSuccess();

      if (!authed) {
        this.machine.transition(
          this.machine.canTransition("SESSION_EXPIRED") ? "SESSION_EXPIRED" : "LOGIN_REQUIRED",
          "Session expired",
        );
        this.scheduler.stop();
        await this.notifications.notify("session_expired", "Session expired", "Sign in again through the normal login flow.");
        return;
      }

      await this.holdAfkPage();
      this.publishHealth();
      this.publishAutomation();
    } catch (error) {
      await this.handleNetworkError(error);
    }
  }

  async syncAccount(): Promise<void> {
    try {
      this.account = await this.provider.getAccount();
      this.persistAccount(this.account);
      this.bus.emit("account.updated", this.account);
      this.health.srncloud = "healthy";
      this.networkBreaker.recordSuccess();

      const rewards = await this.provider.getRewards();
      if (rewards.coins !== null) {
        this.recordCoins(rewards.coins, rewards.source);
      }
      const resources = await this.provider.getResourceAllocation();
      this.db
        .prepare(
          "INSERT INTO resource_snapshots (account_id, ram_gb, cpu_percent, disk_gb, coins, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(this.ensureAccountRow(), resources.ramGb, resources.cpuPercent, resources.diskGb, resources.coins, nowIso());
    } catch (error) {
      await this.handleNetworkError(error);
    }
  }

  async syncServers(): Promise<void> {
    try {
      this.servers = await this.provider.getServers();
      const accountId = this.ensureAccountRow();
      const stmt = this.db.prepare(
        `INSERT INTO servers (id, account_id, name, status, cpu_percent, ram_used_mb, ram_total_mb, disk_used_gb, disk_total_gb, players, max_players, uptime_ms, last_check_at, payload_json)
         VALUES (@id, @account_id, @name, @status, @cpu, @ramu, @ramt, @disku, @diskt, @players, @maxp, @uptime, @ts, @payload)
         ON CONFLICT(id) DO UPDATE SET
           status=excluded.status, cpu_percent=excluded.cpu_percent, ram_used_mb=excluded.ram_used_mb,
           ram_total_mb=excluded.ram_total_mb, disk_used_gb=excluded.disk_used_gb, disk_total_gb=excluded.disk_total_gb,
           players=excluded.players, max_players=excluded.max_players, uptime_ms=excluded.uptime_ms, last_check_at=excluded.last_check_at`,
      );
      for (const s of this.servers) {
        stmt.run({
          id: s.id,
          account_id: accountId,
          name: s.name,
          status: s.status,
          cpu: s.cpuPercent,
          ramu: s.ramUsedMb,
          ramt: s.ramTotalMb,
          disku: s.diskUsedGb,
          diskt: s.diskTotalGb,
          players: s.players,
          maxp: s.maxPlayers,
          uptime: s.uptimeMs,
          ts: s.lastCheckAt,
          payload: JSON.stringify(s),
        });
        if (s.status === "offline") {
          await this.notifications.notify("server_offline", `${s.name} is offline`, "A monitored server reported offline status.");
        }
      }
      this.bus.emit("server.status", this.servers);
      this.activity("Server status synchronized");
    } catch (error) {
      await this.handleNetworkError(error);
    }
  }

  async connectWithCredentials(username: string, password: string): Promise<void> {
    const encrypted = (await import("../crypto/secrets.js")).encryptSecret(
      JSON.stringify({ username, password }),
      this.encryptionKey,
    );
    const id = this.ensureAccountRow();
    this.db
      .prepare("UPDATE accounts SET display_name = ?, encrypted_credentials = ?, updated_at = ? WHERE id = ?")
      .run(username, encrypted, nowIso(), id);

    try {
      await this.provider.login({ username, password });
      this.activity("Account connected");
      if (!this.machine.isActive()) await this.start();
      else {
        this.machine.force("CONNECTED");
        this.machine.transition("RUNNING");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "MANUAL_VERIFICATION_REQUIRED") {
        await this.enterChallenge("Complete verification in the browser.");
        return;
      }
      throw error;
    }
  }

  async disconnectAccount(): Promise<void> {
    const id = this.ensureAccountRow();
    this.db.prepare("UPDATE accounts SET encrypted_credentials = NULL, updated_at = ? WHERE id = ?").run(nowIso(), id);
    await this.stop();
    this.machine.force("IDLE", "Disconnected");
    this.account = null;
  }

  private async ensureAuthenticated(): Promise<boolean> {
    if (await this.provider.isAuthenticated()) return true;
    const row = this.db.prepare("SELECT encrypted_credentials FROM accounts WHERE id = ?").get(this.ensureAccountRow()) as
      | { encrypted_credentials: string | null }
      | undefined;
    if (!row?.encrypted_credentials) return false;
    try {
      const parsed = JSON.parse(decryptSecret(row.encrypted_credentials, this.encryptionKey)) as {
        username: string;
        password: string;
      };
      await this.provider.login(parsed);
      return await this.provider.isAuthenticated();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn("Authorized login did not complete", { error: message });
      if (message === "MANUAL_VERIFICATION_REQUIRED") throw error;
      return false;
    }
  }

  private async syncAll(): Promise<void> {
    await this.syncAccount();
    await this.syncServers();
    await this.healthCheck();
  }

  private wireScheduler(): void {
    const settings = this.getSettings();
    this.scheduler.register({
      id: "session-check",
      label: "Session Check",
      intervalMs: settings.healthCheckIntervalMs,
      fn: () => this.healthCheck(),
    });
    this.scheduler.register({
      id: "server-status",
      label: "Server Status",
      intervalMs: settings.serverCheckIntervalMs,
      fn: () => this.syncServers(),
    });
    this.scheduler.register({
      id: "account-sync",
      label: "Account Sync",
      intervalMs: settings.accountSyncIntervalMs,
      fn: () => this.syncAccount(),
    });
    this.scheduler.register({
      id: "afk-keep",
      label: "AFK Page Keep-Alive",
      intervalMs: Math.max(settings.healthCheckIntervalMs, 45_000),
      fn: () => this.holdAfkPage(),
    });
  }

  private async holdAfkPage(): Promise<void> {
    if (!this.provider.keepAuthorizedSession) return;
    try {
      await this.provider.keepAuthorizedSession();
      this.lastCheckAt = nowIso();
      this.activity("AFK page verified", this.provider.currentUrl?.() ?? undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "MANUAL_VERIFICATION_REQUIRED") {
        await this.enterChallenge("Complete verification in the browser to continue AFK.");
        return;
      }
      if (message === "LOGIN_REQUIRED") {
        this.machine.force("LOGIN_REQUIRED", "Session expired on AFK page");
        this.scheduler.stop();
        await this.notifications.notify("session_expired", "Session expired", "Sign in again through the normal login flow.");
        return;
      }
      throw error;
    }
  }

  private async enterChallenge(message: string | null): Promise<void> {
    this.scheduler.stop();
    const reason = message ?? "SRNCloud/Cloudflare is requesting verification. Complete it in the browser. Automation will not attempt to solve it.";
    if (this.machine.canTransition("CHALLENGE_REQUIRED")) {
      this.machine.transition("CHALLENGE_REQUIRED", reason);
    } else {
      this.machine.force("CHALLENGE_REQUIRED", reason);
    }
    await this.notifications.notify("security_challenge", "Manual verification required", reason);
  }

  private async handleBrowserCrash(): Promise<void> {
    if (this.recovering) return;
    this.recovering = true;
    this.health.browser = "down";
    this.logger.warn("Browser crash detected");
    if (this.machine.canTransition("BROWSER_ERROR")) this.machine.transition("BROWSER_ERROR", "Browser crashed");
    else this.machine.force("BROWSER_ERROR", "Browser crashed");
    await this.notifications.notify("browser_crashed", "Browser crashed", "Attempting automatic recovery.");
    try {
      const settings = this.getSettings();
      if (settings.browserRestartOnCrash) {
        await withExponentialBackoff(() => this.browser.restart(), {
          maxAttempts: settings.retryCount,
          onAttempt: (attempt, delay) => this.logger.warn("Browser restart retry", { attempt, delay }),
        });
        this.health.browser = "healthy";
        await this.notifications.notify("recovery", "Browser recovered", "The browser session was restored.");
        if (this.machine.canTransition("STARTING")) {
          this.machine.transition("STARTING");
          await this.start();
        }
      }
    } catch (error) {
      this.logger.error("Browser recovery failed", { error: String(error) });
    } finally {
      this.recovering = false;
    }
  }

  private async handleNetworkError(error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.networkBreaker.recordFailure();
    this.health.network = "degraded";
    this.health.srncloud = "degraded";
    this.logger.warn("Network request failed", { error: message });
    if (this.machine.state === "RUNNING" && this.machine.canTransition("NETWORK_ERROR")) {
      this.machine.transition("NETWORK_ERROR", "SRNCloud is temporarily unavailable.");
    }
    try {
      await withExponentialBackoff(async () => {
        await this.provider.getSessionStatus();
      }, {
        maxAttempts: this.getSettings().retryCount,
        onAttempt: (attempt, delay) => this.logger.info("Retrying connection", { attempt, delay }),
      });
      this.networkBreaker.recordSuccess();
      this.health.network = "healthy";
      this.health.srncloud = "healthy";
      if (this.machine.state === "NETWORK_ERROR") this.machine.transition("RUNNING", "Connection recovered");
      this.activity("Connection recovered");
      await this.notifications.notify("recovery", "Connection recovered", "The manager restored the SRNCloud connection.");
    } catch (err) {
      if (err instanceof RetryExhaustedError) {
        await this.notifications.notify(
          "network_failure",
          "SRNCloud is temporarily unavailable",
          "The manager will retry automatically. No further aggressive retries will run until cooldown.",
        );
      }
    }
    this.publishHealth();
  }

  private async handleStartError(error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "MANUAL_VERIFICATION_REQUIRED") {
      await this.enterChallenge(null);
      return;
    }
    if (message === "NETWORK_UNAVAILABLE") {
      this.machine.force("NETWORK_ERROR", message);
      return;
    }
    if (message === "LOGIN_FAILED" || message === "LOGIN_REQUIRED") {
      this.machine.force("LOGIN_REQUIRED", "Normal login did not succeed");
      await this.notifications.notify(
        "session_expired",
        "Login required",
        "The authorized login did not complete. Enter credentials again or complete any on-page verification yourself.",
      );
      return;
    }
    this.logger.error("Failed to start automation", { error: message });
    this.machine.force("ERROR", message);
  }

  private persistAccount(account: AccountInfo): void {
    const id = this.ensureAccountRow();
    this.db
      .prepare("UPDATE accounts SET provider = ?, display_name = ?, updated_at = ? WHERE id = ?")
      .run(account.provider, account.displayName, nowIso(), id);
  }

  private recordCoins(balance: number, source: string): void {
    const accountId = this.ensureAccountRow();
    const last = this.db
      .prepare("SELECT balance FROM coin_snapshots WHERE account_id = ? ORDER BY id DESC LIMIT 1")
      .get(accountId) as { balance: number } | undefined;
    const change = last ? balance - last.balance : null;
    this.db
      .prepare("INSERT INTO coin_snapshots (account_id, balance, change_amount, source, timestamp) VALUES (?, ?, ?, ?, ?)")
      .run(accountId, balance, change, source, nowIso());
  }

  private ensureAccountRow(): string {
    const existing = this.db.prepare("SELECT id FROM accounts WHERE provider = ? LIMIT 1").get(this.provider.name) as
      | { id: string }
      | undefined;
    if (existing) return existing.id;
    const id = this.provider.name === "mock" ? "mock-account-1" : "srncloud-primary";
    this.db
      .prepare("INSERT INTO accounts (id, provider, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, this.provider.name, "SRNCloud Account", nowIso(), nowIso());
    return id;
  }

  private endRun(status: string): void {
    if (!this.runId) return;
    this.db.prepare("UPDATE automation_runs SET ended_at = ?, status = ? WHERE id = ?").run(nowIso(), status, this.runId);
  }

  private activity(title: string, detail?: string | null): void {
    this.db
      .prepare("INSERT INTO activity_logs (account_id, timestamp, title, detail, level) VALUES (?, ?, ?, ?, ?)")
      .run(this.account?.id ?? null, nowIso(), title, detail ?? null, "INFO");
  }

  private publishAutomation(): void {
    this.bus.emit("automation.status", this.snapshot());
  }

  private publishHealth(): void {
    this.bus.emit("health.updated", this.health);
  }

  private updateHealthAutomation(): void {
    const map: Record<string, HealthStatus> = {
      RUNNING: "healthy",
      CONNECTED: "healthy",
      PAUSED: "degraded",
      CHALLENGE_REQUIRED: "degraded",
      NETWORK_ERROR: "degraded",
      BROWSER_ERROR: "down",
      ERROR: "down",
      SESSION_EXPIRED: "down",
      LOGIN_REQUIRED: "degraded",
      STOPPED: "unknown",
      IDLE: "unknown",
    };
    this.health.automation = map[this.machine.state] ?? "unknown";
    this.publishHealth();
  }
}
