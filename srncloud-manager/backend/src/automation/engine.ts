import { BrowserController } from './browser-controller.js';
import { StateMachine } from './state-machine.js';
import { RecoveryEngine, type RecoveryResult } from './recovery.js';
import { MockHostingProvider } from '../providers/mock/mock-adapter.js';
import { SRNCloudAdapter } from '../providers/srncloud/adapter.js';
import { config } from '../shared/config.js';
import { logger } from '../shared/logger.js';
import type { HostingProviderAdapter, WSEvent, DashboardStatus, HealthCheck, AutomationState } from '../shared/types.js';
import {
  getDefaultAccount, getSession, getSettings, getLatestCoinSnapshot,
  getCoinChangeToday, getServersByAccount, upsertServer, upsertSession,
  addActivityLog, addSystemLog, createAutomationRun, updateAutomationRun,
  getLatestAutomationRun, storeCredentials, getCredentials, clearCredentials,
  addCoinSnapshot,
} from '../db/repositories.js';
import { SessionExpiredError, ChallengeRequiredError, NetworkError, BrowserError } from '../shared/errors.js';

type EventBroadcaster = (event: WSEvent) => void;

/**
 * AutomationEngine — the core orchestrator.
 *
 * Manages the state machine, browser controller, provider adapter, scheduler,
 * and recovery engine. Exposes a single high-level API for the REST layer.
 */
export class AutomationEngine {
  private browser: BrowserController;
  private stateMachine: StateMachine;
  private recovery: RecoveryEngine;
  private adapter: HostingProviderAdapter;
  private broadcaster: EventBroadcaster | null = null;
  private accountId: string | null = null;
  private runId: string | null = null;
  private lastCheckAt: string | null = null;
  private startedAt: string | null = null;
  private checkIntervalMs: number;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(browser: BrowserController, stateMachine: StateMachine, useMock = false) {
    this.browser = browser;
    this.stateMachine = stateMachine;
    this.recovery = new RecoveryEngine(browser, stateMachine);
    this.adapter = useMock ? new MockHostingProvider() : new SRNCloudAdapter(browser);
    this.checkIntervalMs = 60000;

    // Wire recovery → resume automation
    this.recovery.setOnRecover(async () => {
      this.stateMachine.transition('RUNNING', 'recovered');
    });
  }

  setBroadcaster(fn: EventBroadcaster): void {
    this.broadcaster = fn;
    this.recovery.setBroadcaster(fn);
  }

  private broadcast(event: WSEvent): void {
    this.broadcaster?.(event);
  }

  setAccount(id: string): void {
    this.accountId = id;
  }

  get state(): AutomationState {
    return this.stateMachine.state;
  }

  getStateMachine(): StateMachine {
    return this.stateMachine;
  }

  getBrowser(): BrowserController {
    return this.browser;
  }

  getAdapter(): HostingProviderAdapter {
    return this.adapter;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.stateMachine.state !== 'IDLE' && this.stateMachine.state !== 'STOPPED') {
      logger.warn('Automation already running or in invalid state', { state: this.stateMachine.state });
      return;
    }

    this.stateMachine.transition('STARTING', 'user_initiated');
    this.startedAt = new Date().toISOString();

    if (this.accountId) {
      this.runId = createAutomationRun(this.accountId);
    }

    this.broadcastStatus();

    try {
      // Launch browser
      await this.browser.launch();
      this.stateMachine.transition('AUTHENTICATING', 'browser_launched');
      this.broadcastStatus();

      // Navigate to SRNCloud
      await this.browser.navigate(config.srncloudBaseUrl);
      await this.sleep(2000);

      // Check authentication
      const authed = await this.browser.isAuthenticated();
      if (!authed) {
        this.stateMachine.transition('SESSION_EXPIRED', 'not_authenticated');
        this.broadcastStatus();
        await this.recovery.handleSessionExpired();
        return;
      }

      this.stateMachine.transition('CONNECTED', 'authenticated');
      this.broadcastStatus();

      // Start periodic checks
      this.startPeriodicChecks();

      this.stateMachine.transition('RUNNING', 'connected_and_ready');
      this.broadcastStatus();

      await this.logActivity('automation_started', 'Automation started successfully');
      this.broadcast({ type: 'automation.status', data: { state: 'RUNNING' }, timestamp: new Date().toISOString() });

    } catch (err) {
      logger.error('Automation start failed', { error: String(err) });
      this.stateMachine.transition('ERROR', String(err));
      this.broadcastStatus();
    }
  }

  async stop(): Promise<void> {
    this.stateMachine.transition('STOPPING', 'user_initiated');
    this.stopPeriodicChecks();

    if (this.runId) {
      updateAutomationRun(this.runId, 'STOPPED', 'user_initiated', true);
      this.runId = null;
    }

    await this.browser.close();
    this.stateMachine.transition('STOPPED', 'stopped');
    this.startedAt = null;
    this.lastCheckAt = null;

    await this.logActivity('automation_stopped', 'Automation stopped by user');
    this.broadcastStatus();
    this.broadcast({ type: 'automation.status', data: { state: 'STOPPED' }, timestamp: new Date().toISOString() });
  }

  async pause(): Promise<void> {
    if (this.stateMachine.state === 'RUNNING' || this.stateMachine.state === 'CONNECTED') {
      this.stateMachine.transition('PAUSED', 'user_paused');
      await this.logActivity('automation_paused', 'Automation paused');
      this.broadcastStatus();
    }
  }

  async resume(): Promise<void> {
    if (this.stateMachine.state === 'PAUSED') {
      this.stateMachine.transition('RUNNING', 'user_resumed');
      await this.logActivity('automation_resumed', 'Automation resumed');
      this.broadcastStatus();
    }
  }

  async restartBrowser(): Promise<void> {
    await this.logActivity('browser_restart', 'User requested browser restart');
    const result = await this.recovery.recoverBrowser();
    if (result === 'recovered') {
      this.stateMachine.transition('RUNNING', 'browser_restarted');
    } else {
      this.stateMachine.transition('BROWSER_ERROR', 'restart_failed');
    }
    this.broadcastStatus();
  }

  async reconnect(): Promise<void> {
    await this.logActivity('session_reconnect', 'User requested session reconnect');
    try {
      await this.browser.navigate(config.srncloudBaseUrl);
      await this.sleep(2000);
      const authed = await this.browser.isAuthenticated();
      if (authed) {
        this.stateMachine.transition('CONNECTED', 'reconnected');
        this.stateMachine.transition('RUNNING', 'reconnected');
        await this.logActivity('session_reconnected', 'Session reconnected successfully');
      } else {
        this.stateMachine.transition('SESSION_EXPIRED', 'reconnect_failed');
        await this.recovery.handleSessionExpired();
      }
    } catch (err) {
      logger.error('Reconnect failed', { error: String(err) });
      this.stateMachine.transition('ERROR', String(err));
    }
    this.broadcastStatus();
  }

  // ─── Account ───────────────────────────────────────────────────────────────

  async connectAccount(username: string, password: string): Promise<void> {
    if (!this.accountId) throw new Error('No account configured');
    storeCredentials(this.accountId, username, password);

    if (this.stateMachine.state === 'IDLE' || this.stateMachine.state === 'STOPPED') {
      await this.start();
    } else if (this.stateMachine.state === 'SESSION_EXPIRED') {
      // Retry authentication
      this.stateMachine.transition('AUTHENTICATING', 'retry_login');
      try {
        await this.browser.navigate(config.srncloudBaseUrl);
        await this.sleep(2000);
        const authed = await this.browser.isAuthenticated();
        if (authed) {
          this.stateMachine.transition('CONNECTED', 'login_successful');
          this.stateMachine.transition('RUNNING', 'login_successful');
          await this.logActivity('login_success', 'Logged in successfully');
        } else {
          this.stateMachine.transition('SESSION_EXPIRED', 'login_failed');
          await this.logActivity('login_failed', 'Login attempt failed — session still expired');
        }
      } catch (err) {
        this.stateMachine.transition('ERROR', String(err));
      }
      this.broadcastStatus();
    }
  }

  async disconnectAccount(): Promise<void> {
    await this.stop();
    if (this.accountId) {
      clearCredentials(this.accountId);
    }
    await this.logActivity('account_disconnected', 'Account disconnected and credentials cleared');
  }

  // ─── Monitoring ────────────────────────────────────────────────────────────

  private startPeriodicChecks(): void {
    const settings = getSettings();
    const healthInterval = parseInt(settings['health_check_interval'] || '60', 10) * 1000;
    const serverInterval = parseInt(settings['server_status_interval'] || '30', 10) * 1000;

    this.checkIntervalMs = healthInterval;

    this.checkTimer = setInterval(() => {
      this.runHealthCheck().catch(err => {
        logger.error('Health check error', { error: String(err) });
      });
    }, healthInterval);

    this.pollTimer = setInterval(() => {
      this.syncServers().catch(err => {
        logger.error('Server sync error', { error: String(err) });
      });
    }, serverInterval);

    logger.info('Periodic checks started', { healthInterval, serverInterval });
  }

  private stopPeriodicChecks(): void {
    if (this.checkTimer) { clearInterval(this.checkTimer); this.checkTimer = null; }
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    logger.info('Periodic checks stopped');
  }

  async runHealthCheck(): Promise<void> {
    const state = this.stateMachine.state;
    if (state === 'IDLE' || state === 'STOPPED' || state === 'STOPPING') return;

    this.lastCheckAt = new Date().toISOString();

    try {
      // Check browser health
      const health = await this.browser.isHealthy();
      if (!health.healthy) {
        logger.warn('Browser unhealthy', health);
        this.stateMachine.transition('BROWSER_ERROR', 'health_check_failed');
        this.broadcastStatus();
        const result = await this.recovery.recoverBrowser();
        this.handleRecoveryResult(result);
        return;
      }

      // Check for challenge
      const challenge = await this.browser.detectChallenge();
      if (challenge.isChallenge) {
        logger.warn('Challenge detected', challenge);
        this.stateMachine.transition('CHALLENGE_REQUIRED', challenge.detail ?? 'challenge_detected');
        this.broadcastStatus();
        await this.recovery.handleChallenge();
        return;
      }

      // Check authentication
      const authed = await this.browser.isAuthenticated();
      if (!authed) {
        this.stateMachine.transition('SESSION_EXPIRED', 'health_check_not_authenticated');
        this.broadcastStatus();
        await this.recovery.handleSessionExpired();
        return;
      }

      // Update session
      if (this.accountId) {
        upsertSession(this.accountId, {
          isConnected: true,
          lastSyncAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        });
      }

      this.broadcast({
        type: 'health.status',
        data: { browser: 'healthy', session: 'healthy', srncloud: 'healthy' },
        timestamp: new Date().toISOString(),
      });
      this.broadcastStatus();

    } catch (err) {
      if (err instanceof NetworkError) {
        this.stateMachine.transition('NETWORK_ERROR', String(err));
        this.broadcastStatus();
        const result = await this.recovery.recoverNetwork();
        this.handleRecoveryResult(result);
      } else if (err instanceof SessionExpiredError) {
        this.stateMachine.transition('SESSION_EXPIRED', 'auth_check_failed');
        this.broadcastStatus();
        await this.recovery.handleSessionExpired();
      } else {
        logger.error('Health check unexpected error', { error: String(err) });
      }
    }
  }

  async syncServers(): Promise<void> {
    const state = this.stateMachine.state;
    if (state !== 'RUNNING' && state !== 'CONNECTED') return;
    if (!this.accountId) return;

    try {
      const servers = await this.adapter.getServers();
      for (const srv of servers) {
        const status = await this.adapter.getServerStatus(srv.id).catch(() => null);
        upsertServer(this.accountId, {
          providerId: srv.id,
          name: srv.name,
          status: srv.status,
          cpu: status?.cpu ?? null,
          ramUsed: status?.ramUsed ?? null,
          ramTotal: status?.ramTotal ?? null,
          diskUsed: status?.diskUsed ?? null,
          diskTotal: status?.diskTotal ?? null,
          players: status?.players ?? null,
          playersMax: status?.playersMax ?? null,
          uptimeSeconds: status?.uptimeSeconds ?? null,
          lastChecked: new Date().toISOString(),
        });
      }
      logger.debug('Server sync completed', { count: servers.length });
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        this.stateMachine.transition('SESSION_EXPIRED', 'server_sync_auth_failed');
        this.broadcastStatus();
        await this.recovery.handleSessionExpired();
      } else {
        logger.warn('Server sync failed', { error: String(err) });
      }
    }
  }

  private handleRecoveryResult(result: RecoveryResult): void {
    switch (result) {
      case 'recovered':
        this.stateMachine.transition('RUNNING', 'recovered');
        break;
      case 'failed':
        this.stateMachine.transition('ERROR', 'recovery_failed');
        break;
      case 'challenge_required':
        // Already in PAUSED
        break;
      case 'session_expired':
        this.stateMachine.transition('SESSION_EXPIRED', 'recovery_session_expired');
        break;
    }
    this.broadcastStatus();
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  getStatus(): DashboardStatus {
    const account = this.accountId ? getDefaultAccount() : null;
    const session = this.accountId ? getSession(this.accountId) : null;
    const coinSnapshot = this.accountId ? getLatestCoinSnapshot(this.accountId) : null;
    const coinToday = this.accountId ? getCoinChangeToday(this.accountId) : null;
    const servers = this.accountId ? getServersByAccount(this.accountId) : [];
    const lastRun = this.accountId ? getLatestAutomationRun(this.accountId) : null;

    const health: HealthCheck = {
      browser: this.browser.isRunning ? 'healthy' : 'down',
      network: this.stateMachine.state === 'NETWORK_ERROR' ? 'down' : 'healthy',
      srncloud: this.stateMachine.state === 'NETWORK_ERROR' ? 'degraded' : 'healthy',
      authentication: account?.loginState === 'logged_in' ? 'healthy' : 'unknown',
      session: session?.isConnected ? 'healthy' : 'unknown',
      automation: this.stateMachine.state,
    };

    return {
      account: account ?? {
        id: '', provider: 'srncloud', displayName: 'Not connected',
        status: 'disconnected', loginState: 'logged_out',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
      session: session ?? { isConnected: false, sessionAgeSeconds: 0, lastSyncAt: null, lastActivity: null },
      automation: {
        state: this.stateMachine.state,
        startedAt: this.startedAt,
        runtimeSeconds: this.startedAt ? Math.floor((Date.now() - new Date(this.startedAt).getTime()) / 1000) : 0,
        lastCheckSeconds: this.lastCheckAt ? Math.floor((Date.now() - new Date(this.lastCheckAt).getTime()) / 1000) : null,
        reason: lastRun?.reason ?? null,
      },
      health,
      coins: {
        balance: coinSnapshot?.balance ?? null,
        changeToday: coinToday,
      },
      serverCount: {
        total: servers.length,
        online: servers.filter(s => s.status === 'online').length,
      },
    };
  }

  private broadcastStatus(): void {
    this.broadcast({
      type: 'automation.status',
      data: this.getStatus(),
      timestamp: new Date().toISOString(),
    });
  }

  private async logActivity(event: string, detail: string): Promise<void> {
    addActivityLog(this.accountId, event, detail);
    addSystemLog('INFO', `[Automation] ${detail}`, JSON.stringify({ event }));
    this.broadcast({
      type: 'log.created',
      data: { level: 'INFO', message: detail, timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
