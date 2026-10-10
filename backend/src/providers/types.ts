import type {
  AccountInfo,
  ProviderCapabilities,
  ResourceAllocation,
  RewardsInfo,
  ServerInfo,
} from "../types.js";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ChallengeDetection {
  detected: boolean;
  kind:
    | "captcha"
    | "cloudflare"
    | "adblock"
    | "vpn"
    | "alting"
    | "browser_verification"
    | "auth_challenge"
    | "unknown"
    | null;
  message: string | null;
}

export interface HostingProviderAdapter {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  login(credentials: LoginCredentials): Promise<void>;
  isAuthenticated(): Promise<boolean>;
  detectChallenge(): Promise<ChallengeDetection>;
  detectLogout(): Promise<boolean>;
  getAccount(): Promise<AccountInfo>;
  getServers(): Promise<ServerInfo[]>;
  getServerStatus(id: string): Promise<ServerInfo>;
  getRewards(): Promise<RewardsInfo>;
  getResourceAllocation(): Promise<ResourceAllocation>;
  getSessionStatus(): Promise<{ authenticated: boolean; ageMs: number | null }>;
  keepAuthorizedSession?(): Promise<void>;
  currentUrl?(): string | null;
}

export const EMPTY_CAPABILITIES: ProviderCapabilities = {
  account: false,
  servers: false,
  serverResources: false,
  rewards: false,
  resourceAllocation: false,
  authorizedApi: false,
};
