import type { AutomationState } from '../shared/types.js';

interface TransitionResult {
  ok: boolean;
  from: AutomationState;
  to: AutomationState;
}

// ─── Valid State Transitions ────────────────────────────────────────────────────
// Only allow transitions that make logical sense per the PROMPT.md state diagram.

const VALID_TRANSITIONS: Record<AutomationState, AutomationState[]> = {
  IDLE:              ['STARTING', 'STOPPED'],
  STARTING:          ['AUTHENTICATING', 'BROWSER_ERROR', 'NETWORK_ERROR', 'ERROR', 'STOPPING'],
  AUTHENTICATING:    ['CONNECTED', 'SESSION_EXPIRED', 'CHALLENGE_REQUIRED', 'BROWSER_ERROR', 'NETWORK_ERROR', 'ERROR', 'STOPPING'],
  CONNECTED:         ['RUNNING', 'CHALLENGE_REQUIRED', 'NETWORK_ERROR', 'SESSION_EXPIRED', 'BROWSER_ERROR', 'PAUSED', 'STOPPING'],
  RUNNING:           ['PAUSED', 'CHALLENGE_REQUIRED', 'NETWORK_ERROR', 'SESSION_EXPIRED', 'BROWSER_ERROR', 'CONNECTED', 'STOPPING', 'ERROR'],
  PAUSED:            ['RUNNING', 'STOPPING', 'CHALLENGE_REQUIRED'],
  CHALLENGE_REQUIRED:['PAUSED', 'RUNNING', 'STOPPING'],
  NETWORK_ERROR:     ['RUNNING', 'BROWSER_ERROR', 'ERROR', 'STOPPING', 'CONNECTED'],
  SESSION_EXPIRED:   ['AUTHENTICATING', 'STOPPING', 'IDLE', 'ERROR'],
  BROWSER_ERROR:     ['STARTING', 'STOPPING', 'ERROR'],
  STOPPING:          ['STOPPED', 'IDLE'],
  STOPPED:           ['IDLE', 'STARTING'],
  ERROR:             ['STARTING', 'STOPPING', 'IDLE'],
};

export class StateMachine {
  private current: AutomationState = 'IDLE';
  private history: { state: AutomationState; at: Date; reason?: string }[] = [];
  private listeners: Array<(from: AutomationState, to: AutomationState, reason?: string) => void> = [];

  get state(): AutomationState {
    return this.current;
  }

  getHistory(): { state: AutomationState; at: string; reason?: string }[] {
    return this.history.map(h => ({ state: h.state, at: h.at.toISOString(), reason: h.reason }));
  }

  onTransition(cb: (from: AutomationState, to: AutomationState, reason?: string) => void): void {
    this.listeners.push(cb);
  }

  canTransition(to: AutomationState): boolean {
    const allowed = VALID_TRANSITIONS[this.current] ?? [];
    return allowed.includes(to);
  }

  transition(to: AutomationState, reason?: string): TransitionResult {
    const from = this.current;
    if (from === to) {
      return { ok: true, from, to };
    }
    if (!this.canTransition(to)) {
      return { ok: false, from, to };
    }
    this.current = to;
    const entry = { state: to, at: new Date(), reason };
    this.history.push(entry);
    for (const cb of this.listeners) {
      cb(from, to, reason);
    }
    return { ok: true, from, to };
  }

  forceTransition(to: AutomationState, reason?: string): void {
    // Used for error recovery where we must override normal flow
    const from = this.current;
    this.current = to;
    this.history.push({ state: to, at: new Date(), reason });
    for (const cb of this.listeners) {
      cb(from, to, reason);
    }
  }

  reset(): void {
    this.current = 'IDLE';
    this.history = [];
  }
}

// ─── Backoff Helper ────────────────────────────────────────────────────────────

export class ExponentialBackoff {
  private attempt = 0;
  private readonly schedule = [2, 5, 15, 30];

  nextDelay(): number {
    const delay = this.schedule[Math.min(this.attempt, this.schedule.length - 1)];
    this.attempt++;
    return delay * 1000; // ms
  }

  get currentAttempt(): number {
    return this.attempt;
  }

  reset(): void {
    this.attempt = 0;
  }

  get maxReached(): boolean {
    return this.attempt >= this.schedule.length;
  }
}
