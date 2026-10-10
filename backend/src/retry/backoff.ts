export const DEFAULT_BACKOFF_MS = [2000, 5000, 15000, 30000];

export interface RetryOptions {
  maxAttempts: number;
  delaysMs?: number[];
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onAttempt?: (attempt: number, delayMs: number, error: unknown) => void;
  sleep?: (ms: number) => Promise<void>;
}

export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: unknown,
  ) {
    super(message);
    this.name = "RetryExhaustedError";
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withExponentialBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const delays = options.delaysMs ?? DEFAULT_BACKOFF_MS;
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const canRetry = options.shouldRetry ? options.shouldRetry(error, attempt) : true;
      if (!canRetry || attempt >= options.maxAttempts) {
        break;
      }
      const delay = delays[Math.min(attempt - 1, delays.length - 1)] ?? 30_000;
      options.onAttempt?.(attempt, delay, error);
      await sleep(delay);
    }
  }

  throw new RetryExhaustedError(
    `Retry exhausted after ${options.maxAttempts} attempts`,
    options.maxAttempts,
    lastError,
  );
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly threshold = 5,
    private readonly cooldownMs = 60_000,
  ) {}

  get isOpen(): boolean {
    if (this.openedAt === null) return false;
    if (Date.now() - this.openedAt >= this.cooldownMs) {
      this.openedAt = null;
      this.failures = 0;
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.openedAt = Date.now();
    }
  }
}
