import type { HostingProviderAdapter, AdapterAccount, AdapterServer, AdapterServerStatus, AdapterRewards } from '../../shared/types.js';
import { SessionExpiredError, NetworkError, ChallengeRequiredError } from '../../shared/errors.js';
import { config } from '../../shared/config.js';
import type { BrowserController } from '../../automation/browser-controller.js';

// ─── SRNCloud Adapter ─────────────────────────────────────────────────────────
// TODO — requires SRNCloud integration verification.
//
// This adapter is intentionally minimal. SRNCloud-specific selectors and
// endpoints are isolated here so they can be updated without rewriting the
// core application.
//
// IMPORTANT: Do NOT add fake endpoints or fake data. If a method cannot be
// verified against the real SRNCloud service, leave it unimplemented and
// return null or throw an error.

export class SRNCloudAdapter implements HostingProviderAdapter {
  readonly name = 'srncloud';
  private browser: BrowserController;

  constructor(browser: BrowserController) {
    this.browser = browser;
  }

  get baseUrl(): string {
    return config.srncloudBaseUrl;
  }

  async login(username: string, _password: string): Promise<void> {
    // The browser controller handles actual login form interaction.
    // This method is a placeholder that simply verifies the browser is on a
    // reachable SRNCloud page.
    const page = this.browser.getPage();
    const url = page.url();
    if (url === 'about:blank' || url === '') {
      await this.browser.navigate(this.baseUrl);
    }
    // Real login requires manual user interaction or credentials via the UI
    // — see the /api/account/connect endpoint.
    throw new ChallengeRequiredError('Automated login is not yet implemented — please log in through the controlled browser.');
  }

  async isAuthenticated(): Promise<boolean> {
    return this.browser.isAuthenticated();
  }

  async getAccount(): Promise<AdapterAccount> {
    // TODO — requires SRNCloud integration verification
    const page = this.browser.getPage();
    const url = page.url();
    return {
      displayName: 'SRNCloud Account',
      status: 'connected',
      loginState: url.includes('login') ? 'logged_out' : 'logged_in',
    };
  }

  async getServers(): Promise<AdapterServer[]> {
    // TODO — requires SRNCloud integration verification
    // Attempt to read server list from the dashboard page if authenticated.
    // These selectors are placeholders — update after inspecting the real site.
    const page = this.browser.getPage();
    if (!(await this.isAuthenticated())) {
      throw new SessionExpiredError();
    }
    return [];
  }

  async getServerStatus(serverId: string): Promise<AdapterServerStatus> {
    // TODO — requires SRNCloud integration verification
    if (!(await this.isAuthenticated())) {
      throw new SessionExpiredError();
    }
    return {
      cpu: null, ramUsed: null, ramTotal: null,
      diskUsed: null, diskTotal: null,
      players: null, playersMax: null, uptimeSeconds: null,
    };
  }

  async getRewards(): Promise<AdapterRewards> {
    // TODO — requires SRNCloud integration verification
    if (!(await this.isAuthenticated())) {
      throw new SessionExpiredError();
    }
    return { balance: 0, source: null };
  }

  async detectChallenge(): Promise<boolean> {
    const result = await this.browser.detectChallenge();
    return result.isChallenge;
  }

  async detectLogout(): Promise<boolean> {
    return this.browser.detectLogout();
  }
}
