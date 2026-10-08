import { getDatabase } from './database.js';
import { encrypt, decrypt, type EncryptedPayload } from '../shared/crypto.js';
import type {
  Account, SessionInfo, ServerInfo, CoinSnapshot, ActivityLog,
  SystemLog, Notification, AutomationRun, AutomationState, LoginState,
} from '../shared/types.js';

// ─── Accounts ────────────────────────────────────────────────────────────────

export function createAccount(displayName: string, provider = 'srncloud'): Account {
  const db = getDatabase();
  const row = db.prepare(
    `INSERT INTO accounts (display_name, provider) VALUES (?, ?)
     RETURNING *`
  ).get(displayName, provider) as AccountRow;
  return rowToAccount(row);
}

export function getAccount(id: string): Account | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined;
  return row ? rowToAccount(row) : null;
}

export function getDefaultAccount(): Account | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM accounts ORDER BY created_at ASC LIMIT 1').get() as AccountRow | undefined;
  return row ? rowToAccount(row) : null;
}

export function getAllAccounts(): Account[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM accounts ORDER BY created_at ASC').all() as AccountRow[];
  return rows.map(rowToAccount);
}

export function updateAccountStatus(id: string, status: Account['status'], loginState: LoginState): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE accounts SET status = ?, login_state = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, loginState, id);
}

// ─── Encrypted Secrets ───────────────────────────────────────────────────────

export function storeCredentials(accountId: string, username: string, password: string): void {
  const db = getDatabase();
  const payload = encryptJSON({ username, password });

  // Delete old credentials for this account
  db.prepare('DELETE FROM encrypted_secrets WHERE account_id = ? AND kind = ?')
    .run(accountId, 'login');

  db.prepare(
    `INSERT INTO encrypted_secrets (account_id, kind, ciphertext, iv, tag)
     VALUES (?, ?, ?, ?, ?)`
  ).run(accountId, 'login', payload.ciphertext, payload.iv, payload.tag);
}

export function getCredentials(accountId: string): { username: string; password: string } | null {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT * FROM encrypted_secrets WHERE account_id = ? AND kind = ?'
  ).get(accountId, 'login') as SecretRow | undefined;
  if (!row) return null;
  return decryptJSON<{ username: string; password: string }>({
    ciphertext: Buffer.from(row.ciphertext),
    iv: Buffer.from(row.iv),
    tag: Buffer.from(row.tag),
  });
}

export function clearCredentials(accountId: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM encrypted_secrets WHERE account_id = ?').run(accountId);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function upsertSession(accountId: string, info: Partial<SessionInfo>): void {
  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM sessions WHERE account_id = ?').get(accountId) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE sessions SET
        is_connected = COALESCE(?, is_connected),
        session_age_s = COALESCE(?, session_age_s),
        last_sync_at = COALESCE(?, last_sync_at),
        last_activity = COALESCE(?, last_activity),
        updated_at = datetime('now')
      WHERE account_id = ?`
    ).run(
      info.isConnected ? 1 : 0,
      info.sessionAgeSeconds ?? null,
      info.lastSyncAt ?? null,
      info.lastActivity ?? null,
      accountId,
    );
  } else {
    db.prepare(
      `INSERT INTO sessions (account_id, is_connected, session_age_s, last_sync_at, last_activity)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      accountId,
      info.isConnected ? 1 : 0,
      info.sessionAgeSeconds ?? 0,
      info.lastSyncAt ?? null,
      info.lastActivity ?? null,
    );
  }
}

export function getSession(accountId: string): SessionInfo | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM sessions WHERE account_id = ?').get(accountId) as SessionRow | undefined;
  if (!row) return null;
  return {
    isConnected: row.is_connected === 1,
    sessionAgeSeconds: row.session_age_s,
    lastSyncAt: row.last_sync_at,
    lastActivity: row.last_activity,
  };
}

// ─── Servers ───────────────────────────────────────────────────────────────────

export function upsertServer(accountId: string, server: Partial<ServerInfo> & { name: string; providerId?: string | null }): ServerInfo {
  const db = getDatabase();
  const existing = db.prepare(
    'SELECT id FROM servers WHERE account_id = ? AND (provider_id = ? OR (provider_id IS NULL AND ? IS NULL))'
  ).get(accountId, server.providerId ?? null, server.providerId ?? null) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE servers SET
        name = COALESCE(?, name),
        status = COALESCE(?, status),
        cpu = ?, ram_used = ?, ram_total = ?,
        disk_used = ?, disk_total = ?,
        players = ?, players_max = ?,
        uptime_s = ?, last_checked = COALESCE(?, last_checked),
        updated_at = datetime('now')
      WHERE id = ?`
    ).run(
      server.name,
      server.status ?? null,
      server.cpu ?? null,
      server.ramUsed ?? null,
      server.ramTotal ?? null,
      server.diskUsed ?? null,
      server.diskTotal ?? null,
      server.players ?? null,
      server.playersMax ?? null,
      server.uptimeSeconds ?? null,
      server.lastChecked ?? null,
      existing.id,
    );
    const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(existing.id) as ServerRow;
    return rowToServer(row);
  } else {
    const row = db.prepare(
      `INSERT INTO servers (account_id, provider_id, name, status, cpu, ram_used, ram_total, disk_used, disk_total, players, players_max, uptime_s, last_checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    ).get(
      accountId,
      server.providerId ?? null,
      server.name,
      server.status ?? 'unknown',
      server.cpu ?? null,
      server.ramUsed ?? null,
      server.ramTotal ?? null,
      server.diskUsed ?? null,
      server.diskTotal ?? null,
      server.players ?? null,
      server.playersMax ?? null,
      server.uptimeSeconds ?? null,
      server.lastChecked ?? null,
    ) as ServerRow;
    return rowToServer(row);
  }
}

export function getServersByAccount(accountId: string): ServerInfo[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM servers WHERE account_id = ? ORDER BY name ASC').all(accountId) as ServerRow[];
  return rows.map(rowToServer);
}

export function getServer(id: string): ServerInfo | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as ServerRow | undefined;
  return row ? rowToServer(row) : null;
}

// ─── Coin Snapshots ───────────────────────────────────────────────────────────

export function addCoinSnapshot(accountId: string, balance: number, change: number, source: string | null): void {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO coin_snapshots (account_id, balance, change, source) VALUES (?, ?, ?, ?)'
  ).run(accountId, balance, change, source);
}

export function getCoinSnapshots(accountId: string, limit = 100): CoinSnapshot[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT * FROM coin_snapshots WHERE account_id = ? ORDER BY timestamp DESC LIMIT ?'
  ).all(accountId, limit) as CoinRow[];
  return rows.map(row => ({
    id: row.id,
    accountId: row.account_id,
    balance: row.balance,
    change: row.change,
    source: row.source,
    timestamp: row.timestamp,
  }));
}

export function getLatestCoinSnapshot(accountId: string): CoinSnapshot | null {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT * FROM coin_snapshots WHERE account_id = ? ORDER BY timestamp DESC LIMIT 1'
  ).get(accountId) as CoinRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    accountId: row.account_id,
    balance: row.balance,
    change: row.change,
    source: row.source,
    timestamp: row.timestamp,
  };
}

export function getCoinChangeToday(accountId: string): number | null {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT COALESCE(SUM(change), 0) as total FROM coin_snapshots
     WHERE account_id = ? AND timestamp >= date('now', 'start of day')`
  ).get(accountId) as { total: number };
  return row.total;
}

// ─── Resource Snapshots ────────────────────────────────────────────────────────

export function addResourceSnapshot(accountId: string, ramMb: number | null, cpuPct: number | null, diskGb: number | null, coins: number | null): void {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO resource_snapshots (account_id, ram_mb, cpu_pct, disk_gb, coins) VALUES (?, ?, ?, ?, ?)'
  ).run(accountId, ramMb, cpuPct, diskGb, coins);
}

// ─── Automation Runs ───────────────────────────────────────────────────────────

export function createAutomationRun(accountId: string): string {
  const db = getDatabase();
  const row = db.prepare(
    `INSERT INTO automation_runs (account_id, status) VALUES (?, 'STARTING') RETURNING id`
  ).get(accountId) as { id: string };
  return row.id;
}

export function updateAutomationRun(id: string, status: AutomationState, reason: string | null, ended: boolean): void {
  const db = getDatabase();
  if (ended) {
    db.prepare(
      `UPDATE automation_runs SET status = ?, reason = ?, ended_at = datetime('now') WHERE id = ?`
    ).run(status, reason, id);
  } else {
    db.prepare(
      `UPDATE automation_runs SET status = ?, reason = ? WHERE id = ?`
    ).run(status, reason, id);
  }
}

export function getLatestAutomationRun(accountId: string): AutomationRun | null {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT * FROM automation_runs WHERE account_id = ? ORDER BY started_at DESC LIMIT 1'
  ).get(accountId) as AutoRunRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    accountId: row.account_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status as AutomationState,
    reason: row.reason,
  };
}

// ─── Activity Logs ───────────────────────────────────────────────────────────────

export function addActivityLog(accountId: string | null, event: string, detail: string | null): void {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO activity_logs (account_id, event, detail) VALUES (?, ?, ?)'
  ).run(accountId, event, detail);
}

export function getActivityLogs(limit = 50): ActivityLog[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ?'
  ).all(limit) as ActivityRow[];
  return rows.map(row => ({
    id: row.id,
    accountId: row.account_id,
    event: row.event,
    detail: row.detail,
    timestamp: row.timestamp,
  }));
}

// ─── System Logs ─────────────────────────────────────────────────────────────────

export function addSystemLog(level: string, message: string, meta: string | null): number {
  const db = getDatabase();
  const result = db.prepare(
    'INSERT INTO system_logs (level, message, meta) VALUES (?, ?, ?) RETURNING id'
  ).get(level, message, meta) as { id: number };
  return result.id;
}

export function getSystemLogs(limit = 200, level?: string): SystemLog[] {
  const db = getDatabase();
  let query = 'SELECT * FROM system_logs';
  const params: (string | number)[] = [];
  if (level && level !== 'ALL') {
    query += ' WHERE level = ?';
    params.push(level);
  }
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);
  const rows = db.prepare(query).all(...params) as LogRow[];
  return rows.map(row => ({
    id: row.id,
    level: row.level as SystemLog['level'],
    message: row.message,
    meta: row.meta,
    timestamp: row.timestamp,
  }));
}

// ─── Notifications ─────────────────────────────────────────────────────────────

export function addNotification(type: string, title: string, message: string): void {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO notifications (type, title, message) VALUES (?, ?, ?)'
  ).run(type, title, message);
}

export function getNotifications(limit = 50, unreadOnly = false): Notification[] {
  const db = getDatabase();
  let query = 'SELECT * FROM notifications';
  const params: (string | number)[] = [];
  if (unreadOnly) {
    query += ' WHERE read = 0';
  }
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);
  const rows = db.prepare(query).all(...params) as NotificationRow[];
  return rows.map(row => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.read === 1,
    timestamp: row.timestamp,
  }));
}

export function markNotificationRead(id: string): void {
  const db = getDatabase();
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
}

export function markAllNotificationsRead(): void {
  const db = getDatabase();
  db.prepare('UPDATE notifications SET read = 1 WHERE read = 0').run();
}

// ─── Settings ───────────────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function getSettings(): Record<string, string> {
  const db = getDatabase();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function setSetting(key: string, value: string): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

// ─── Row Types & Mappers ──────────────────────────────────────────────────────

interface AccountRow {
  id: string; provider: string; display_name: string;
  status: string; login_state: string; created_at: string; updated_at: string;
}

interface SessionRow {
  id: string; account_id: string; session_age_s: number;
  last_sync_at: string | null; last_activity: string | null;
  is_connected: number; created_at: string; updated_at: string;
}

interface ServerRow {
  id: string; account_id: string; provider_id: string | null; name: string;
  status: string; cpu: number | null; ram_used: number | null; ram_total: number | null;
  disk_used: number | null; disk_total: number | null; players: number | null; players_max: number | null;
  uptime_s: number | null; last_checked: string | null; created_at: string; updated_at: string;
}

interface CoinRow {
  id: string; account_id: string; balance: number; change: number;
  source: string | null; timestamp: string;
}

interface AutoRunRow {
  id: string; account_id: string; started_at: string; ended_at: string | null;
  status: string; reason: string | null;
}

interface ActivityRow {
  id: string; account_id: string | null; event: string;
  detail: string | null; timestamp: string;
}

interface LogRow {
  id: number; level: string; message: string;
  meta: string | null; timestamp: string;
}

interface NotificationRow {
  id: string; type: string; title: string; message: string;
  read: number; timestamp: string;
}

interface SecretRow {
  id: string; account_id: string; kind: string;
  ciphertext: Buffer; iv: Buffer; tag: Buffer;
}

function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    provider: row.provider,
    displayName: row.display_name,
    status: row.status as Account['status'],
    loginState: row.login_state as LoginState,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToServer(row: ServerRow): ServerInfo {
  return {
    id: row.id,
    accountId: row.account_id,
    providerId: row.provider_id,
    name: row.name,
    status: row.status as ServerInfo['status'],
    cpu: row.cpu,
    ramUsed: row.ram_used,
    ramTotal: row.ram_total,
    diskUsed: row.disk_used,
    diskTotal: row.disk_total,
    players: row.players,
    playersMax: row.players_max,
    uptimeSeconds: row.uptime_s,
    lastChecked: row.last_checked,
  };
}

// Re-export crypto helpers needed by credential functions
function encryptJSON(obj: unknown): EncryptedPayload {
  const { encryptJSON: enc } = require('../shared/crypto.js');
  return enc(obj);
}

function decryptJSON<T>(payload: EncryptedPayload): T {
  const { decryptJSON: dec } = require('../shared/crypto.js');
  return dec<T>(payload);
}
