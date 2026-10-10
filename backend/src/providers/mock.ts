import type { AccountInfo, ResourceAllocation, RewardsInfo, ServerInfo } from "../types.js";
import type { ChallengeDetection, HostingProviderAdapter, LoginCredentials } from "./types.js";

export type MockScenario =
  | "connected"
  | "disconnected"
  | "session_expired"
  | "server_offline"
  | "network_failure"
  | "security_challenge"
  | "browser_crash";

const BASE_SERVERS: Omit<ServerInfo, "lastCheckAt">[] = [
  {
    id: "srv-survival",
    name: "Survival SMP",
    status: "online",
    cpuPercent: 18,
    ramUsedMb: 2458,
    ramTotalMb: 4096,
    diskUsedGb: 12,
    diskTotalGb: 30,
    players: 3,
    maxPlayers: 20,
    uptimeMs: 18 * 3600_000 + 32 * 60_000,
  },
  {
    id: "srv-creative",
    name: "Creative Hub",
    status: "online",
    cpuPercent: 7,
    ramUsedMb: 1024,
    ramTotalMb: 2048,
    diskUsedGb: 6,
    diskTotalGb: 20,
    players: 1,
    maxPlayers: 10,
    uptimeMs: 4 * 3600_000,
  },
];

export class MockHostingProvider implements HostingProviderAdapter {
  readonly name = "mock";
  readonly capabilities = {
    account: true,
    servers: true,
    serverResources: true,
    rewards: true,
    resourceAllocation: true,
    authorizedApi: false,
  };

  private authenticated = false;
  private scenario: MockScenario = "disconnected";
  private sessionStartedAt: number | null = null;
  private coins = 12450;
  private displayName = "SRNCloud Account";

  setScenario(scenario: MockScenario): void {
    this.scenario = scenario;
    if (scenario === "connected") {
      this.authenticated = true;
      this.sessionStartedAt ??= Date.now() - 14 * 3600_000 - 32 * 60_000;
    }
    if (scenario === "disconnected") {
      this.authenticated = false;
    }
    if (scenario === "session_expired") {
      this.authenticated = false;
    }
  }

  getScenario(): MockScenario {
    return this.scenario;
  }

  async login(credentials: LoginCredentials): Promise<void> {
    if (!credentials.username || !credentials.password) {
      throw new Error("Username and password are required");
    }
    if (this.scenario === "security_challenge") {
      throw new Error("MANUAL_VERIFICATION_REQUIRED");
    }
    if (this.scenario === "network_failure") {
      throw new Error("NETWORK_UNAVAILABLE");
    }
    this.authenticated = true;
    this.displayName = credentials.username;
    this.sessionStartedAt = Date.now();
    this.scenario = "connected";
  }

  async isAuthenticated(): Promise<boolean> {
    if (this.scenario === "session_expired" || this.scenario === "disconnected") return false;
    return this.authenticated;
  }

  async detectChallenge(): Promise<ChallengeDetection> {
    if (this.scenario === "security_challenge") {
      return {
        detected: true,
        kind: "cloudflare",
        message: "Cloudflare is requesting verification.",
      };
    }
    return { detected: false, kind: null, message: null };
  }

  async detectLogout(): Promise<boolean> {
    return this.scenario === "session_expired" || !this.authenticated;
  }

  async getAccount(): Promise<AccountInfo> {
    this.assertNetwork();
    const now = new Date().toISOString();
    return {
      id: "mock-account-1",
      provider: "mock",
      displayName: this.displayName,
      loginState: this.authenticated ? "authenticated" : "unauthenticated",
      status: this.authenticated ? "Connected" : "Disconnected",
      lastSyncAt: this.authenticated ? now : null,
      lastActivityAt: this.authenticated ? now : null,
      sessionAgeMs: this.sessionStartedAt ? Date.now() - this.sessionStartedAt : null,
      connectionStatus: this.authenticated ? "healthy" : "down",
      capabilities: this.capabilities,
    };
  }

  async getServers(): Promise<ServerInfo[]> {
    this.assertNetwork();
    const now = new Date().toISOString();
    return BASE_SERVERS.map((s) => ({
      ...s,
      status: this.scenario === "server_offline" && s.id === "srv-survival" ? "offline" : s.status,
      lastCheckAt: now,
    }));
  }

  async getServerStatus(id: string): Promise<ServerInfo> {
    const servers = await this.getServers();
    const found = servers.find((s) => s.id === id);
    if (!found) throw new Error(`Server not found: ${id}`);
    return found;
  }

  async getRewards(): Promise<RewardsInfo> {
    this.assertNetwork();
    if (!this.authenticated) {
      return { coins: null, changeToday: null, lastObservedAt: null, source: "unavailable" };
    }
    return {
      coins: this.coins,
      changeToday: 350,
      lastObservedAt: new Date().toISOString(),
      source: "page",
    };
  }

  async getResourceAllocation(): Promise<ResourceAllocation> {
    this.assertNetwork();
    if (!this.authenticated) {
      return { ramGb: null, cpuPercent: null, diskGb: null, coins: null };
    }
    return { ramGb: 8, cpuPercent: 250, diskGb: 40, coins: this.coins };
  }

  async getSessionStatus(): Promise<{ authenticated: boolean; ageMs: number | null }> {
    return {
      authenticated: this.authenticated && this.scenario !== "session_expired",
      ageMs: this.sessionStartedAt ? Date.now() - this.sessionStartedAt : null,
    };
  }

  private assertNetwork(): void {
    if (this.scenario === "network_failure") {
      throw new Error("NETWORK_UNAVAILABLE");
    }
  }
}
