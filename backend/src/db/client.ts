import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema.js";
import type { AppSettings } from "../types.js";

export function openDatabase(filePath: string): Database.Database {
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  return db;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoStart: false,
  healthCheckIntervalMs: 60_000,
  serverCheckIntervalMs: 30_000,
  accountSyncIntervalMs: 300_000,
  retryCount: 5,
  retryDelayMs: 2000,
  browserRestartOnCrash: true,
  browserNotifications: true,
  webhookNotifications: false,
  webhookUrl: null,
  appearance: "dark",
  dailyReportHour: 22,
  dailyReportMinute: 0,
};

export function loadSettings(db: Database.Database): AppSettings {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  if (rows.length === 0) {
    saveSettings(db, DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }
  const map = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value) as unknown]));
  return { ...DEFAULT_SETTINGS, ...(map as Partial<AppSettings>) };
}

export function saveSettings(db: Database.Database, settings: AppSettings): void {
  const stmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, JSON.stringify(value));
    }
  });
  tx();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export { DEFAULT_SETTINGS };
