import type { HostingProviderAdapter, AdapterAccount, AdapterServer, AdapterServerStatus, AdapterRewards } from '../../shared/types.js';
import { SessionExpiredError, NetworkError, ChallengeRequiredError } from '../../shared/errors.js';

export type MockScenario =
  | 'connected'
  | 'disconnected'
  | 'session_expired'
  | 'server_online'
  | 'server_offline'
  | 'network_failure'
  | 'security_challenge'
  | 'browser_crash';

/**
 * MockHostingProvider — simulates SRNCloud behavior for development and testing.
 * Never use this in production against the real service.
 */
export class MockHostingProvider implements HostingProviderAdapter {
  readonly name = 'mock';
  private scenario: MockScenario = 'connected';
  private failCount = 0;

  constructor(scenario: MockScenario = 'connected') {
    this.scenario = scenario;
  }

  setScenario(s: MockScenario): void {
    this.scenario = s;
    this.failCount = 0;
  }

  get currentScenario(): MockScenario {
    return this.scenario;
  }

  /** Simulate transient failures for N calls then succeed. */
  setTransientFailures(n: number): void {
    this.failCount = n;
  }

  async login(username: string, _password: string): Promise<void> {
    if (this.scenario === 'network_failure') throw new NetworkError('Mock network failure');
    if (this.scenario === 'security_challenge') throw new ChallengeRequiredError();
    if (this.scenario === 'session_expired') throw new SessionExpiredError();
    // Success
  }

  async isAuthenticated(): Promise<boolean> {
    if (this.scenario === 'network_failure') throw new NetworkError('Mock network failure');
    if (this.scenario === 'session_expired') return false;
    return this.scenario !== 'disconnected';
  }

  async getAccount(): Promise<AdapterAccount> {
    this.maybeFail();
    return {
      displayName: 'Mock User',
      status: 'connected',
      loginState: this.scenario === 'session_expired' ? 'login_required' : 'logged_in',
    };
  }

  async getServers(): Promise<AdapterServer[]> {
    this.maybeFail();
    if (this.scenario === 'server_offline') {
      return [{ id: 'srv-001', name: 'Survival SMP', status: 'offline' }];
    }
    return [
      { id: 'srv-001', name: 'Survival SMP', status: 'online' },
      { id: 'srv-002', name: 'Creative Build', status: 'online' },
    ];
  }

  async getServerStatus(serverId: string): Promise<AdapterServerStatus> {
    this.maybeFail();
    const offline = this.scenario === 'server_offline';
    return {
      cpu: offline ? null : 18.5,
      ramUsed: offline ? null : 2400,
      ramTotal: 4096,
      diskUsed: 12288,
      diskTotal: 30720,
      players: offline ? null : 3,
      playersMax: 20,
      uptimeSeconds: offline ? null : 66720,
    };
  }

  async getRewards(): Promise<AdapterRewards> {
    this.maybeFail();
    return { balance: 12450, source: 'mock' };
  }

  async detectChallenge(): Promise<boolean> {
    return this.scenario === 'security_challenge';
  }

  async detectLogout(): Promise<boolean> {
    return this.scenario === 'session_expired';
  }

  private maybeFail(): void {
    if (this.failCount > 0) {
      this.failCount--;
      throw new NetworkError('Mock transient failure');
    }
    if (this.scenario === 'network_failure') throw new NetworkError('Mock network failure');
  }
}
