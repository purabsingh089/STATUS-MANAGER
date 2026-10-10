import { z } from "zod";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_PATH: z.string().default("./data/srncloud.db"),
  ENCRYPTION_KEY: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  DASHBOARD_PASSWORD: z.string().optional(),
  DASHBOARD_SESSION_HOURS: z.coerce.number().positive().default(12),
  PROVIDER: z.enum(["mock", "srncloud"]).default("mock"),
  SRNCLOUD_BASE_URL: z.string().optional(),
  PLAYWRIGHT_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  PLAYWRIGHT_HEADLESS: z
    .string()
    .optional()
    .transform((v) => v !== "false" && v !== "0"),
  BROWSER_USER_DATA_DIR: z.string().default("./data/browser-profile"),
  PLAYWRIGHT_EXECUTABLE_PATH: z.string().optional(),
  AUTO_START: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  HEALTH_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  SERVER_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  ACCOUNT_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),
  RETRY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  WEBHOOK_URL: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema> & {
  encryptionKey: Buffer;
  sessionSecret: string;
  playwrightEnabled: boolean;
  playwrightHeadless: boolean;
  autoStart: boolean;
};

function deriveOrCreateKey(raw: string | undefined, name: string, persistPath: string): string {
  if (raw && raw.length >= 32) return raw;
  if (raw && raw.length > 0 && raw.length < 32) {
    throw new Error(`${name} must be at least 32 characters`);
  }
  if (existsSync(persistPath)) {
    return readFileSync(persistPath, "utf8").trim();
  }
  const generated = randomBytes(32).toString("hex");
  mkdirSync(path.dirname(persistPath), { recursive: true });
  writeFileSync(persistPath, generated, { mode: 0o600 });
  return generated;
}

export function loadConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);
  const keyDir = path.dirname(path.resolve(parsed.DATABASE_PATH));
  const encryptionKeyRaw = deriveOrCreateKey(
    parsed.ENCRYPTION_KEY,
    "ENCRYPTION_KEY",
    path.join(keyDir, ".encryption-key"),
  );
  const sessionSecret = deriveOrCreateKey(
    parsed.SESSION_SECRET,
    "SESSION_SECRET",
    path.join(keyDir, ".session-secret"),
  );

  const dbDir = path.dirname(path.resolve(parsed.DATABASE_PATH));
  mkdirSync(dbDir, { recursive: true });
  mkdirSync(path.resolve(parsed.BROWSER_USER_DATA_DIR), { recursive: true });

  return {
    ...parsed,
    encryptionKey: Buffer.from(encryptionKeyRaw.slice(0, 64), encryptionKeyRaw.length === 64 ? "hex" : "utf8").subarray(0, 32),
    sessionSecret,
    playwrightEnabled: Boolean(parsed.PLAYWRIGHT_ENABLED),
    playwrightHeadless: parsed.PLAYWRIGHT_HEADLESS !== false,
    autoStart: Boolean(parsed.AUTO_START),
  };
}
