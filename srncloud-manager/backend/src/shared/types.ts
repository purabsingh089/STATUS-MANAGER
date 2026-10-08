// ─── Shared Domain Types ──────────────────────────────────────────────────────
// These types form the contract between backend services and the frontend API.
// Never put secrets (passwords, cookies, tokens) in any type that is sent to the
// frontend.

export type AutomationState =
  | 'IDLE'
  | 'STARTING'
  | 'AUTHENTICATING'
  | 'CONNECTED'
  | 'RUNNING'
  | 'PAUSED'
  | 'CHALLENGE_REQUIRED'
  | 'NETWORK_ERROR'
  | 'SESSION_EXPIRED'
  | 'BROWSER_ERROR'
  | 'STOPPING'
  | 'STOPPED'
  | 'ERROR';

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';
export type LoginState = 'logged_in' | 'logged_out' | 'login_required' | 'unknown';
export type ServerStatus = 'online' | 'offline' | 'starting' | 'stopping' | 'unknown';

export interface Account {
  id: string;
  provider: string;
  displayName: string;
  status: 'connected' | 'disconnected' | 'error';
  loginState: LoginState;
  createdAt: string;
  updatedAt: string;
}

export interface SessionInfo {
  isConnected: boolean;
  sessionAgeSeconds: number;
  lastSyncAt: string | null;
  lastActivity: string | null;
}

export interface ServerInfo {
  id: string;
  accountId: string;
  providerId: string | null;
  name: string;
  status: ServerStatus;
  cpu: number | null;
  ramUsed: number | null;
  ramTotal: number | null;
  diskUsed: number | null;
  diskTotal: number | null;
  players: number | null;
  playersMax: number | null;
  uptimeSeconds: number | null;
  lastChecked: string | null;
}

export interface CoinSnapshot {
  id: string;
  accountId: string;
  balance: number;
  change: number;
  source: string | null;
  timestamp: string;
}

export interface ResourceSnapshot {
  ramMb: number | null;
  cpuPct: number | null;
  diskGb: number | null;
  coins: number | null;
  timestamp: string;
}

export interface AutomationRun {
  id: string;
  accountId: string;
  startedAt: string;
  endedAt: string | null;
  status: AutomationState;
  reason: string | null;
}

export interface ActivityLog {
  id: string;
  accountId: string | null;
  event: string;
  detail: string | null;
  timestamp: string;
}

export interface SystemLog {
  id: number;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  meta: string | null;
  timestamp: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
}

export interface HealthCheck {
  browser: HealthStatus;
  network: HealthStatus;
  srncloud: HealthStatus;
  authentication: HealthStatus;
  session: HealthStatus;
  automation: AutomationState;
}

export interface DashboardStatus {
  account: Account;
  session: SessionInfo;
  automation: {
    state: AutomationState;
    startedAt: string | null;
    runtimeSeconds: number;
    lastCheckSeconds: number | null;
    reason: string | null;
  };
  health: HealthCheck;
  coins: {
    balance: number | null;
    changeToday: number | null;
  };
  serverCount: {
    total: number;
    online: number;
  };
}

export interface WSEvent {
  type: 'automation.status' | 'session.status' | 'browser.status' | 'server.status' | 'account.updated' | 'notification.created' | 'log.created' | 'health.status';
  data: unknown;
  timestamp: string;
}

// ─── Hosting Provider Adapter Interface ────────────────────────────────────────

export interface HostingProviderAdapter {
  readonly name: string;
  login(username: string, password: string): Promise<void>;
  isAuthenticated(): Promise<boolean>;
  getAccount(): Promise<AdapterAccount>;
  get Servers(): Promise<AdapterServer[]>;
  getServerStatus(serverId: string): Promise<AdapterServerStatus>;
  getRewards?(): Promise<AdapterRewards>;
  getSessionStatus?(): Promise<{ connected: boolean; lastActivity: string | null }>;
  detectChallenge?(): Promise<boolean>;
  detectLogout?(): Promise<boolean>;
}

export interface AdapterAccount {
  displayName: string;
  status: 'connected' | 'disconnected';
  loginState: LoginState;
}

export interface AdapterServer {
  id: string;
  name: string;
  status: ServerStatus;
}

export interface AdapterServerStatus {
  cpu: number | null;
  ramUsed: number | null;
  ramTotal: number | null;
  diskUsed: number | null;
  diskTotal: number | null;
  players: number | null;
  playersMax: number | null;
  uptimeSeconds: number | null;
}

export interface AdapterRewards {
  balance: number;
  source: string | null;
}
