import type { BrowserContext, Page } from "playwright";
import { mkdirSync } from "node:fs";
import type { Logger } from "../logging/logger.js";
import type { HealthStatus } from "../types.js";

export interface BrowserControllerOptions {
  userDataDir: string;
  headless: boolean;
  enabled: boolean;
  baseUrl?: string;
  executablePath?: string;
}

export class BrowserController {
  private context: BrowserContext | null = null;
  private _page: Page | null = null;
  private launchedAt: number | null = null;
  private healthy: HealthStatus = "unknown";
  private crashHandler: (() => void) | null = null;

  constructor(
    private readonly options: BrowserControllerOptions,
    private readonly logger: Logger,
  ) {}

  get page(): Page | null {
    return this._page;
  }

  get status(): HealthStatus {
    return this.healthy;
  }

  sessionAgeMs(): number | null {
    if (!this.launchedAt) return null;
    return Date.now() - this.launchedAt;
  }

  onCrash(handler: () => void): void {
    this.crashHandler = handler;
  }

  async launch(): Promise<void> {
    if (!this.options.enabled) {
      this.healthy = "unknown";
      this.logger.info("Playwright disabled; browser controller is idle");
      return;
    }
    await this.close();
    mkdirSync(this.options.userDataDir, { recursive: true });
    const { chromium } = await import("playwright");
    this.context = await chromium.launchPersistentContext(this.options.userDataDir, {
      headless: this.options.headless,
      executablePath: this.options.executablePath,
      viewport: { width: 1280, height: 800 },
      args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
    });
    this.context.on("close", () => {
      this.healthy = "down";
      this.crashHandler?.();
    });
    this._page = this.context.pages()[0] ?? (await this.context.newPage());
    this._page.on("crash", () => {
      this.healthy = "down";
      this.logger.warn("Browser page crashed");
      this.crashHandler?.();
    });
    this.launchedAt = Date.now();
    this.healthy = "healthy";
    this.logger.info("Browser launched with persistent context");
  }

  async ensurePage(): Promise<Page> {
    if (!this.options.enabled) {
      throw new Error("PLAYWRIGHT_DISABLED");
    }
    if (!this._page || this._page.isClosed()) {
      await this.launch();
    }
    if (!this._page) throw new Error("BROWSER_UNAVAILABLE");
    return this._page;
  }

  async navigate(url: string): Promise<void> {
    const page = await this.ensurePage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  }

  async isHealthy(): Promise<boolean> {
    if (!this.options.enabled) return true;
    if (!this.context || !this._page) return false;
    return !this._page.isClosed();
  }

  async recover(): Promise<void> {
    this.logger.warn("Recovering browser");
    await this.restart();
  }

  async restart(): Promise<void> {
    await this.close();
    await this.launch();
  }

  async close(): Promise<void> {
    try {
      await this.context?.close();
    } catch {
      /* ignore */
    }
    this.context = null;
    this._page = null;
    this.healthy = "unknown";
  }
}
