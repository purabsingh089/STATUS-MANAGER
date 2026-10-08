-- SRNCloud AFK Manager - Initial Schema

CREATE TABLE IF NOT EXISTS accounts (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  provider      TEXT NOT NULL DEFAULT 'srncloud',
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'disconnected',
  login_state   TEXT NOT NULL DEFAULT 'logged_out',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  session_age_s INTEGER NOT NULL DEFAULT 0,
  last_sync_at  TEXT,
  last_activity TEXT,
  is_connected  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS encrypted_secrets (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  ciphertext    BLOB NOT NULL,
  iv            BLOB NOT NULL,
  tag           BLOB NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS servers (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider_id   TEXT,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'unknown',
  cpu           REAL,
  ram_used      REAL,
  ram_total     REAL,
  disk_used     REAL,
  disk_total    REAL,
  players       INTEGER,
  players_max   INTEGER,
  uptime_s      INTEGER,
  last_checked  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resource_snapshots (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ram_mb        REAL,
  cpu_pct       REAL,
  disk_gb       REAL,
  coins         INTEGER,
  timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coin_snapshots (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  balance       INTEGER NOT NULL DEFAULT 0,
  change        INTEGER NOT NULL DEFAULT 0,
  source        TEXT,
  timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at      TEXT,
  status        TEXT NOT NULL DEFAULT 'idle',
  reason        TEXT
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  account_id    TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  event         TEXT NOT NULL,
  detail        TEXT,
  timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS system_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  level         TEXT NOT NULL DEFAULT 'INFO',
  message       TEXT NOT NULL,
  meta           TEXT,
  timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  read          INTEGER NOT NULL DEFAULT 0,
  timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('auto_start', 'false'),
  ('health_check_interval', '60'),
  ('server_status_interval', '30'),
  ('account_sync_interval', '300'),
  ('retry_count', '5'),
  ('retry_delay', '2'),
  ('browser_restart_on_crash', 'true'),
  ('notifications_browser', 'true'),
  ('notifications_webhook', 'false'),
  ('webhook_url', ''),
  ('theme', 'dark');

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_coin_timestamp ON coin_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_servers_account ON servers(account_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
