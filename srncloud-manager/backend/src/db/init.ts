import { getDatabase } from './database.js';
import { logger } from '../shared/logger.js';

/** Ensure a default account exists so the MVP is wired for a single-account UX. */
export function ensureDefaultAccount(): string {
  const db = getDatabase();
  const existing = db.prepare("SELECT id FROM accounts WHERE provider = 'srncloud' LIMIT 1").get() as { id: string } | undefined;
  if (existing) return existing.id;

  const row = db.prepare(
    "INSERT INTO accounts (display_name, provider, status, login_state) VALUES ('SRNCloud Account', 'srncloud', 'disconnected', 'logged_out') RETURNING id"
  ).get() as { id: string };
  logger.info('Created default SRNCloud account', { id: row.id });
  return row.id;
}
