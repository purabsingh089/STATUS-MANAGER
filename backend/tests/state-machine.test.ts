import { describe, expect, it } from "vitest";
import { AutomationStateMachine, InvalidTransitionError } from "../src/state/machine.js";

describe("AutomationStateMachine", () => {
  it("starts in IDLE", () => {
    const m = new AutomationStateMachine();
    expect(m.state).toBe("IDLE");
  });

  it("follows the happy path", () => {
    const m = new AutomationStateMachine();
    m.transition("STARTING");
    m.transition("AUTHENTICATING");
    m.transition("CONNECTED");
    m.transition("RUNNING");
    expect(m.state).toBe("RUNNING");
    expect(m.isActive()).toBe(true);
  });

  it("pauses on challenge from RUNNING", () => {
    const m = new AutomationStateMachine("RUNNING");
    m.transition("CHALLENGE_REQUIRED", "MANUAL_VERIFICATION_REQUIRED");
    expect(m.state).toBe("CHALLENGE_REQUIRED");
    expect(m.requiresManualAction()).toBe(true);
    m.transition("PAUSED");
    expect(m.state).toBe("PAUSED");
  });

  it("rejects illegal transitions", () => {
    const m = new AutomationStateMachine("IDLE");
    expect(() => m.transition("RUNNING")).toThrow(InvalidTransitionError);
  });

  it("idempotent same-state transitions", () => {
    const m = new AutomationStateMachine("RUNNING");
    expect(m.transition("RUNNING")).toBe("RUNNING");
  });

  it("emits transition listeners", () => {
    const m = new AutomationStateMachine("IDLE");
    const seen: string[] = [];
    m.onTransition((from, to) => seen.push(`${from}->${to}`));
    m.transition("STARTING");
    expect(seen).toEqual(["IDLE->STARTING"]);
  });
});
