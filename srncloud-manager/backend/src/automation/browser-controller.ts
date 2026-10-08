import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { resolve } from 'node:path';
import { config } from '../shared/config.js';
import { logger } from '../shared/logger.js';
import { BrowserError, NetworkError, ChallengeRequiredError, SessionExpiredError } from '../shared/errors.js';

export interface BrowserHealth {
  healthy: boolean;
  running: boolean;
  pageReady: boolean;
}

export interface ChallengeDetection {
  isChallenge: boolean;
  type: string | null;
  detail: string | null;
}

/**
 * BrowserController manages a single persistent Playwright Chromium context.
 *
 * Responsibilities:
 *  - launch / close / restart the browser
 *  - navigate to the SRNCloud site
 *  - detect health, authentication state, challenges, logout
 *  - recover from ordinary transient failures with exponential backoff
 *
 * Does NOT attempt to bypass Cloudflare, solve CAPTCHAs, or spoof fingerprints.
 */
export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private userDataDir: string;
  private launching = false;

  constructor(userDataDir?: string) {
    this.userDataDir = userDataDir ?? resolve(process.cwd(), 'browser-data');
  }

  get isRunning(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  get hasPage(): boolean {
    return this.page !== null && !this.page.isClosed();
  }

  async launch(): Promise<void> {
    if (this.launching) return;
    if (this.browser && this.browser.isConnected()) return;
    this.launching = true;

    try {
      logger.info('Launching browser', { userDataDir: this.userDataDir });

      this.browser = await chromium.launchPersistentContext(this.userDataDir, {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
        viewport: { width: 1280, height: 720 },
      });

      // For persistent context, the browser IS the context
      this.context = this.browser as unknown as BrowserContext;
      const pages = this.context.pages();
      this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

      // Set default navigation timeout
      this.page.setDefaultNavigationTimeout(30000);
      this.page.setDefaultTimeout(15000);

      logger.info('Browser launched successfully');
    } catch (err) {
      logger.error('Failed to launch browser', { error: String(err) });
      throw new BrowserError(`Browser launch failed: ${String(err)}`);
    } finally {
      this.launching = false;
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      try {
        await this.context.close();
      } catch { /* ignore */ }
    }
    this.browser = null;
    this.context = null;
    this.page = null;
    logger.info('Browser closed');
  }

  async restart(): Promise<void> {
    logger.info('Restarting browser');
    await this.close();
    await this.launch();
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) throw new BrowserError('Browser not launched');
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch (err) {
      throw new NetworkError(`Navigation failed: ${String(err)}`);
    }
  }

  async isHealthy(): Promise<BrowserHealth> {
    if (!this.browser) {
      return { healthy: false, running: false, pageReady: false };
    }
    const running = this.browser.isConnected();
    const pageReady = this.page !== null && !this.page.isClosed();
    return {
      healthy: running && pageReady,
      running,
      pageReady,
    };
  }

  async isAuthenticated(): Promise<boolean> {
    if (!this.page) return false;
    try {
      // Check URL — if on a login page, not authenticated
      const url = this.page.url();
      if (url.includes('login') || url.includes('signin') || url === 'about:blank') {
        return false;
      }
      // Look for common dashboard elements that indicate logged-in state.
      // These selectors are deliberately generic — actual SRNCloud selectors
      // are in the adapter module.
      const hasDashboard = await this.page.locator('[data-authenticated], .dashboard, nav.user-nav, [class*="sidebar"] nav').count();
      return hasDashboard > 0;
    } catch {
      return false;
    }
  }

  async detectChallenge(): Promise<ChallengeDetection> {
    if (!this.page) return { isChallenge: false, type: null, detail: null };

    try {
      const url = this.page.url();
      const title = await this.page.title().catch(() => '');

      // Cloudflare challenge pages
      if (url.includes('challenge') || title.includes('Just a moment') || title.includes('Attention Required')) {
        return { isChallenge: true, type: 'cloudflare', detail: 'Cloudflare challenge page detected' };
      }

      // CAPTCHA
      const captchaEl = await this.page.locator('iframe[src*="captcha"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, .h-captcha').count();
      if (captchaEl > 0) {
        return { isChallenge: true, type: 'captcha', detail: 'CAPTCHA detected' };
      }

      // Browser verification
      if (title.includes('verify') || url.includes('verify') || url.includes('challenge')) {
        return { isChallenge: true, type: 'verification', detail: 'Browser verification page' };
      }

      return { isChallenge: false, type: null, detail: null };
    } catch {
      return { isChallenge: false, type: null, detail: null };
    }
  }

  async detectLogout(): Promise<boolean> {
    if (!this.page) return true;
    try {
      const url = this.page.url();
      if (url.includes('login') || url.includes('signin') || url.includes('logout')) {
        return true;
      }
      // Check for login form presence
      const loginForm = await this.page.locator('form[action*="login"], input[type="password"]').count();
      return loginForm > 0;
    } catch {
      return true;
    }
  }

  async recover(): Promise<boolean> {
    logger.info('Attempting browser recovery');
    try {
      const health = await this.isHealthy();
      if (!health.running) {
        // Browser crashed — restart
        await this.restart();
        await this.navigate(config.srncloudBaseUrl);
      } else if (!health.pageReady) {
        // Page crashed — open a new one
        if (this.context) {
          this.page = await this.context.newPage();
          await this.navigate(config.srncloudBaseUrl);
        }
      }
      // Verify health after recovery
      const after = await this.isHealthy();
      return after.healthy;
    } catch (err) {
      logger.error('Browser recovery failed', { error: String(err) });
      return false;
    }
  }

  getPage(): Page {
    if (!this.page) throw new BrowserError('Browser not launched');
    return this.page;
  }
}
