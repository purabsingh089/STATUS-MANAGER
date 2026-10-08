import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../shared/config.js';
import { logger } from '../shared/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbPath = config.databaseUrl.replace(/^file:/, '');
  const full = resolve(dbPath);
  mkdirSync(dirname(full), { recursive: true });

  db = new Database(full);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  logger.info('Database opened', { path: full });
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database closed');
  }
}

export async function runMigrations(): Promise<void> {
  const database = getDatabase();
  const migrationsDir = resolve(__dirname, '..', '..', 'migrations');

  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { readFileSync, readdirSync } = await import('node:fs');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const already = database.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(file) as object | undefined;
    if (already) continue;

    logger.info(`Running migration: ${file}`);
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    database.exec(sql);
    database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    logger.info(`Migration applied: ${file}`);
  }
}
