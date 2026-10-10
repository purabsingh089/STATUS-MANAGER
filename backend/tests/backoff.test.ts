import { describe, expect, it } from "vitest";
import { CircuitBreaker, RetryExhaustedError, withExponentialBackoff } from "../src/retry/backoff.js";

describe("withExponentialBackoff", () => {
  it("returns on first success", async () => {
    const result = await withExponentialBackoff(async () => 42, { maxAttempts: 3, sleep: async () => undefined });
    expect(result).toBe(42);
  });

  it("retries then succeeds", async () => {
    let n = 0;
    const delays: number[] = [];
    const result = await withExponentialBackoff(
      async () => {
        n += 1;
        if (n < 3) throw new Error("fail");
        return "ok";
      },
      {
        maxAttempts: 5,
        delaysMs: [1, 1, 1, 1],
        sleep: async (ms) => {
          delays.push(ms);
        },
      },
    );
    expect(result).toBe("ok");
    expect(n).toBe(3);
    expect(delays.length).toBe(2);
  });

  it("throws RetryExhaustedError", async () => {
    await expect(
      withExponentialBackoff(
        async () => {
          throw new Error("nope");
        },
        { maxAttempts: 3, sleep: async () => undefined, delaysMs: [0, 0, 0] },
      ),
    ).rejects.toBeInstanceOf(RetryExhaustedError);
  });
});

describe("CircuitBreaker", () => {
  it("opens after threshold failures", () => {
    const cb = new CircuitBreaker(2, 60_000);
    expect(cb.isOpen).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen).toBe(true);
  });

  it("resets on success", () => {
    const cb = new CircuitBreaker(2, 60_000);
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure();
    expect(cb.isOpen).toBe(false);
  });
});
