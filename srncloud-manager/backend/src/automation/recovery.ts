import { BrowserController } from './browser-controller.js';
import { ExponentialBackoff, StateMachine } from './state-machine.js';
import { logger } from '../shared/logger.js';
import { addActivityLog, addNotification, addSystemLog } from '../db/repositories.js';
import type { WSEvent } from '../shared/types.js';

type EventBroadcaster = (event: WSEvent) => void;

export type RecoveryResult = 'recovered' | 'failed' | 'challenge_required' | 'session_expired';

/**
 * RecoveryEngine handles automatic recovery for ordinary failures.
 *
 *  - Browser crash  → detect → save state → restart browser → restore session → verify auth → resume
 *  - Network failure → wait → retry → verify → resume
 *  - Session expired → pause → notify user → request login
 *  - Security challenge → pause → notify → wait for manual completion → verify → resume
 *
 * Never attempts to bypass a security challenge.
 */
export class RecoveryEngine {
  private browser: BrowserController;
  private stateMachine: StateMachine;
  private broadcaster: EventBroadcaster | null = null;
  private backoff = new ExponentialBackoff();
  private onRecover: (() => Promise<void>) | null = null;

  constructor(browser: BrowserController, stateMachine: StateMachine) {
    this.browser = browser;
    this.stateMachine = stateMachine;
  }

  setBroadcaster(fn: EventBroadcaster): void {
    this.broadcaster = fn;
  }

  /** Called when a normal recovery completes and automation should resume. */
  setOnRecover(fn: () => Promise<void>): void {
    this.onRecover = fn;
  }

  private broadcast(event: WSEvent): void {
    this.broadcaster?.(event);
  }

  private async logRecovery(step: string, detail: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): Promise<void> {
    logger.info(`[Recovery] ${step}`, { detail });
    addSystemLog(level, `[Recovery] ${step}`, JSON.stringify({ detail }));
    addActivityLog(null, `recovery_${step.toLowerCase().replace(/\s+/g, '_')}`, detail);
    this.broadcast({
      type: 'log.created',
      data: { level, message: `[Recovery] ${step}`, timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Attempt recovery from a browser crash.
   */
  async recoverBrowser(): Promise<RecoveryResult> {
    await this.logRecovery('browser_crash', 'Browser crash detected, initiating recovery');

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const delay = this.backoff.nextDelay();
        await this.logRecovery('restart_browser', `Attempt ${attempt}/${maxAttempts}, waiting ${delay}ms`);
        await this.sleep(delay);

        const recovered = await this.browser.recover();
        if (recovered) {
          await this.logRecovery('restore_session', 'Browser recovered, verifying authentication');
          const authed = await this.browser.isAuthenticated();
          if (authed) {
            this.backoff.reset();
            await this.logRecovery('resume', 'Session verified, resuming automation');
            await this.onRecover?.();
            return 'recovered';
          } else {
            await this.logRecovery('session_expired', 'Session expired after browser recovery');
            return 'session_expired';
          }
        }
      } catch (err) {
        await this.logRecovery('retry', `Attempt ${attempt} failed: ${String(err)}`, 'WARN');
      }
    }

    await this.logRecovery('failed', 'Browser recovery exhausted all attempts', 'ERROR');
    return 'failed';
  }

  /**
   * Attempt recovery from a network failure.
   */
  async recoverNetwork(): Promise<RecoveryResult> {
    await this.logRecovery('network_failure', 'Network failure detected, waiting before retry');

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const delay = this.backoff.nextDelay();
      await this.logRecovery('wait', `Attempt ${attempt}/${maxAttempts}, waiting ${delay}ms`);
      await this.sleep(delay);

      try {
        const health = await this.browser.isHealthy();
        if (health.healthy) {
          this.backoff.reset();
          await this.logRecovery('resume', 'Network recovered, resuming automation');
          await this.onRecover?.();
          return 'recovered';
        }
      } catch (err) {
        await this.logRecovery('retry', `Attempt ${attempt} failed: ${String(err)}`, 'WARN');
      }
    }

    await this.logRecovery('failed', 'Network recovery exhausted all attempts', 'ERROR');
    return 'failed';
  }

  /**
   * Handle a detected security challenge — PAUSE, notify, wait for manual completion.
   */
  async handleChallenge(): Promise<RecoveryResult> {
    await this.logRecovery('challenge', 'Security challenge detected — pausing automation', 'WARN');

    addNotification('challenge', 'Manual verification required',
      'SRNCloud/Cloudflare is requesting verification. Complete it in the browser. Automation will resume after verification.');

    this.broadcast({
      type: 'notification.created',
      data: { type: 'challenge', title: 'Manual verification required', message: 'Complete the security challenge in the browser.' },
      timestamp: new Date().toISOString(),
    });

    // Transition to PAUSED via CHALLENGE_REQUIRED
    this.stateMachine.transition('PAUSED', 'challenge_detected');

    return 'challenge_required';
  }

  /**
   * Handle session expiration — pause and notify user.
   */
  async handleSessionExpired(): Promise<RecoveryResult> {
    await this.logRecovery('session_expired', 'Session expired, pausing automation');

    addNotification('session_expired', 'Session expired',
      'The SRNCloud session has expired. Please log in again to resume automation.');

    this.broadcast({
      type: 'notification.created',
      data: { type: 'session_expired', title: 'Session expired', message: 'Please log in again.' },
      timestamp: new Date().toISOString(),
    });

    return 'session_expired';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
