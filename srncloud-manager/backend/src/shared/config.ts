import { config as loadEnv } from 'dotenv';
import { randomBytes } from 'node:crypto';

loadEnv();

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

// Generate or retrieve encryption key
function getEncryptionKey(): string {
  const k = process.env.ENCRYPTION_KEY;
  if (k) return k;
  // In dev, generate a transient key; warn in logs
  const generated = randomBytes(32).toString('hex');
  console.warn('[CONFIG] ENCRYPTION_KEY not set — generated a transient key. Set it for production.');
  return generated;
}

export const config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),
  databaseUrl: optional('DATABASE_URL', 'file:./data/srncloud.db'),
  encryptionKey: getEncryptionKey(),
  sessionSecret: optional('SESSION_SECRET', randomBytes(32).toString('hex')),
  dashboardPassword: process.env.DASHBOARD_PASSWORD || null,
  srncloudBaseUrl: optional('SRNCLOUD_BASE_URL', 'https://panel.srncloud.com'),
  autoStart: optional('AUTO_START', 'false') === 'true',
  isDev: process.env.NODE_ENV !== 'production',
  isProd: process.env.NODE_ENV === 'production',
} as const;

export type AppConfig = typeof config;
