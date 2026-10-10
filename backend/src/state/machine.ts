import type { AutomationState } from "../types.js";

const TRANSITIONS: Record<AutomationState, AutomationState[]> = {
  IDLE: ["STARTING", "STOPPED"],
  STARTING: ["AUTHENTICATING", "BROWSER_ERROR", "NETWORK_ERROR", "STOPPING", "ERROR"],
  AUTHENTICATING: ["CONNECTED", "LOGIN_REQUIRED", "CHALLENGE_REQUIRED", "SESSION_EXPIRED", "NETWORK_ERROR", "STOPPING", "ERROR"],
  CONNECTED: ["RUNNING", "PAUSED", "STOPPING", "SESSION_EXPIRED", "CHALLENGE_REQUIRED"],
  RUNNING: [
    "PAUSED",
    "CHALLENGE_REQUIRED",
    "NETWORK_ERROR",
    "SESSION_EXPIRED",
    "BROWSER_ERROR",
    "STOPPING",
    "ERROR",
  ],
  PAUSED: ["RUNNING", "STOPPING", "CHALLENGE_REQUIRED", "SESSION_EXPIRED", "LOGIN_REQUIRED"],
  CHALLENGE_REQUIRED: ["PAUSED", "RUNNING", "STOPPING", "SESSION_EXPIRED"],
  NETWORK_ERROR: ["RUNNING", "CONNECTED", "STARTING", "STOPPING", "ERROR", "PAUSED"],
  SESSION_EXPIRED: ["LOGIN_REQUIRED", "AUTHENTICATING", "STOPPING", "STOPPED"],
  BROWSER_ERROR: ["STARTING", "STOPPING", "ERROR", "PAUSED"],
  STOPPING: ["STOPPED", "ERROR"],
  STOPPED: ["IDLE", "STARTING"],
  ERROR: ["IDLE", "STARTING", "STOPPED", "STOPPING"],
  LOGIN_REQUIRED: ["AUTHENTICATING", "STARTING", "STOPPED", "IDLE"],
};

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: AutomationState,
    public readonly to: AutomationState,
  ) {
    super(`Invalid automation transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export class AutomationStateMachine {
  private current: AutomationState;
  private reason: string | null = null;
  private readonly listeners = new Set<(from: AutomationState, to: AutomationState, reason: string | null) => void>();

  constructor(initial: AutomationState = "IDLE") {
    this.current = initial;
  }

  get state(): AutomationState {
    return this.current;
  }

  get lastReason(): string | null {
    return this.reason;
  }

  canTransition(to: AutomationState): boolean {
    if (this.current === to) return true;
    return TRANSITIONS[this.current].includes(to);
  }

  transition(to: AutomationState, reason?: string | null): AutomationState {
    if (this.current === to) {
      if (reason !== undefined) this.reason = reason;
      return this.current;
    }
    if (!this.canTransition(to)) {
      throw new InvalidTransitionError(this.current, to);
    }
    const from = this.current;
    this.current = to;
    this.reason = reason ?? null;
    for (const listener of this.listeners) listener(from, to, this.reason);
    return this.current;
  }

  force(to: AutomationState, reason?: string | null): AutomationState {
    const from = this.current;
    this.current = to;
    this.reason = reason ?? null;
    for (const listener of this.listeners) listener(from, to, this.reason);
    return this.current;
  }

  onTransition(listener: (from: AutomationState, to: AutomationState, reason: string | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isTerminal(): boolean {
    return this.current === "STOPPED" || this.current === "IDLE";
  }

  isActive(): boolean {
    return ["STARTING", "AUTHENTICATING", "CONNECTED", "RUNNING"].includes(this.current);
  }

  requiresManualAction(): boolean {
    return ["CHALLENGE_REQUIRED", "SESSION_EXPIRED", "LOGIN_REQUIRED"].includes(this.current);
  }
}

export { TRANSITIONS };
