import { describe, expect, it, vi } from "vitest";
import { Scheduler } from "../src/automation/scheduler.js";

describe("Scheduler", () => {
  it("registers and lists tasks", () => {
    const s = new Scheduler();
    s.register({ id: "a", label: "Session Check", intervalMs: 1000, fn: async () => undefined });
    expect(s.list()).toEqual([{ id: "a", label: "Session Check", intervalMs: 1000, active: false }]);
  });

  it("runs tasks on an interval", async () => {
    vi.useFakeTimers();
    const s = new Scheduler();
    let n = 0;
    s.register({
      id: "tick",
      label: "Tick",
      intervalMs: 1000,
      fn: async () => {
        n += 1;
      },
    });
    s.start();
    await vi.advanceTimersByTimeAsync(3500);
    s.stop();
    expect(n).toBeGreaterThanOrEqual(3);
    vi.useRealTimers();
  });
});
