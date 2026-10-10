export const AUTOMATION_STATES = [
  "IDLE",
  "STARTING",
  "AUTHENTICATING",
  "CONNECTED",
  "RUNNING",
  "PAUSED",
  "CHALLENGE_REQUIRED",
  "NETWORK_ERROR",
  "SESSION_EXPIRED",
  "BROWSER_ERROR",
  "STOPPING",
  "STOPPED",
  "ERROR",
  "LOGIN_REQUIRED",
] as const;

export type AutomationState = (typeof AUTOMATION_STATES)[number];

export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface AccountInfo {
  id: string;
  provider: string;
  displayName: string;
  loginState: "authenticated" | "unauthenticated" | "unknown";
  status: string;
  lastSyncAt: string | null;
  lastActivityAt: string | null;
  sessionAgeMs: number | null;
  connectionStatus: HealthStatus;
  capabilities: ProviderCapabilities;
}

export interface ProviderCapabilities {
  account: boolean;
  servers: boolean;
  serverResources: boolean;
  rewards: boolean;
  resourceAllocation: boolean;
  authorizedApi: boolean;
}

export interface ServerInfo {
  id: string;
  name: string;
  status: "online" | "offline" | "unknown";
  cpuPercent: number | null;
  ramUsedMb: number | null;
  ramTotalMb: number | null;
  diskUsedGb: number | null;
  diskTotalGb: number | null;
  players: number | null;
  maxPlayers: number | null;
  uptimeMs: number | null;
  lastCheckAt: string;
  unavailableReason?: string;
  node?: string | null;
  serverType?: string | null;
}

export interface RewardsInfo {
  coins: number | null;
  changeToday: number | null;
  lastObservedAt: string | null;
  source: "api" | "page" | "unavailable";
}

export interface ResourceAllocation {
  ramGb: number | null;
  cpuPercent: number | null;
  diskGb: number | null;
  coins: number | null;
}

export interface HealthSnapshot {
  browser: HealthStatus;
  network: HealthStatus;
  srncloud: HealthStatus;
  authentication: HealthStatus;
  session: HealthStatus;
  automation: HealthStatus;
}

export interface AutomationSnapshot {
  state: AutomationState;
  reason: string | null;
  startedAt: string | null;
  runtimeMs: number | null;
  lastCheckAt: string | null;
  browser: HealthStatus;
  connection: HealthStatus;
  runId: string | null;
  pageUrl: string | null;
}

export interface ActivityItem {
  id: number;
  timestamp: string;
  title: string;
  detail: string | null;
  level: LogLevel;
}

export interface LogItem {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  context: Record<string, unknown> | null;
}

export interface NotificationItem {
  id: number;
  timestamp: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
}

export interface AppSettings {
  autoStart: boolean;
  healthCheckIntervalMs: number;
  serverCheckIntervalMs: number;
  accountSyncIntervalMs: number;
  retryCount: number;
  retryDelayMs: number;
  browserRestartOnCrash: boolean;
  browserNotifications: boolean;
  webhookNotifications: boolean;
  webhookUrl: string | null;
  appearance: "dark" | "light" | "system";
  dailyReportHour: number;
  dailyReportMinute: number;
}

export interface CoinSnapshot {
  id: number;
  balance: number;
  change: number | null;
  timestamp: string;
  source: string;
}

export type WsEventName =
  | "automation.status"
  | "session.status"
  | "browser.status"
  | "server.status"
  | "account.updated"
  | "notification.created"
  | "log.created"
  | "health.updated";

export interface WsEvent<T = unknown> {
  event: WsEventName;
  payload: T;
  at: string;
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}
