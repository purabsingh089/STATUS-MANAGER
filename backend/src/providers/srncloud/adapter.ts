import type { Page } from "playwright";
import type { AccountInfo, ResourceAllocation, RewardsInfo, ServerInfo } from "../../types.js";
import type { ChallengeDetection, HostingProviderAdapter, LoginCredentials } from "../types.js";
import { EMPTY_CAPABILITIES } from "../types.js";
import {
  ACCOUNT_SELECTORS,
  AUTH_INDICATORS,
  CHALLENGE_SELECTORS,
  COIN_TEXT_PATTERN,
  LOGIN_SELECTORS,
  LOGOUT_INDICATORS,
  SRNCLOUD_AFK_PATH,
  SRNCLOUD_DASHBOARD_PATH,
  SRNCLOUD_DEFAULT_BASE_URL,
  SRNCLOUD_LOGIN_PATH,
  SERVER_STATUS_MAP,
  classifyChallenge,
  type ChallengeKind,
} from "./selectors.js";
import type { BrowserController } from "../../browser/controller.js";

export class SRNCloudAdapter implements HostingProviderAdapter {
  readonly name = "srncloud";
  readonly capabilities = {
    ...EMPTY_CAPABILITIES,
    account: true,
    servers: true,
    serverResources: false,
    rewards: true,
    resourceAllocation: true,
    authorizedApi: false,
  };

  private lastKnownUrl: string | null = null;
  private sessionStartedAt: number | null = null;
  private displayName = "SRNCloud Account";

  constructor(
    private readonly browser: BrowserController,
    private readonly baseUrl: string = SRNCLOUD_DEFAULT_BASE_URL,
  ) {}

  loginUrl(): string {
    return new URL(SRNCLOUD_LOGIN_PATH, this.baseUrl).toString();
  }

  afkUrl(): string {
    return new URL(SRNCLOUD_AFK_PATH, this.baseUrl).toString();
  }

  currentUrl(): string | null {
    return this.browser.page?.url() ?? this.lastKnownUrl;
  }

  async login(credentials: LoginCredentials): Promise<void> {
    const page = await this.browser.ensurePage();
    await page.goto(this.loginUrl(), { waitUntil: "domcontentloaded", timeout: 45_000 });
    this.lastKnownUrl = page.url();

    const challenge = await this.detectChallenge();
    if (challenge.detected) {
      throw new Error("MANUAL_VERIFICATION_REQUIRED");
    }

    if (await this.isAuthenticated()) {
      await this.keepAuthorizedSession();
      return;
    }

    const user = page.locator(LOGIN_SELECTORS.email).first();
    const pass = page.locator(LOGIN_SELECTORS.password).first();
    await user.waitFor({ state: "visible", timeout: 15_000 });
    await user.fill(credentials.username);
    await pass.fill(credentials.password);

    const submit = page.locator(LOGIN_SELECTORS.submit).first();
    await submit.click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    this.lastKnownUrl = page.url();

    const after = await this.detectChallenge();
    if (after.detected) {
      throw new Error("MANUAL_VERIFICATION_REQUIRED");
    }

    if (!(await this.isAuthenticated())) {
      throw new Error("LOGIN_FAILED");
    }

    this.sessionStartedAt = Date.now();
    await this.keepAuthorizedSession();
  }

  async isAuthenticated(): Promise<boolean> {
    const page = this.browser.page;
    if (!page) return false;
    if (await this.pageLooksLikeChallenge(page)) return false;
    const url = page.url().toLowerCase();
    this.lastKnownUrl = page.url();
    if (url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/signin")) {
      return false;
    }
    for (const sel of AUTH_INDICATORS) {
      if ((await page.locator(sel).count()) > 0) return true;
    }
    if (url.includes("/earn/") || url.includes("/dashboard") || url.includes("/server")) {
      return true;
    }
    return false;
  }

  async detectChallenge(): Promise<ChallengeDetection> {
    const page = this.browser.page;
    if (!page) return { detected: false, kind: null, message: null };
    const kind = await this.classifyPage(page);
    if (!kind) return { detected: false, kind: null, message: null };
    return { detected: true, kind, message: challengeMessage(kind) };
  }

  async detectLogout(): Promise<boolean> {
    const page = this.browser.page;
    if (!page) return true;
    if (await this.isAuthenticated()) return false;
    for (const sel of LOGOUT_INDICATORS) {
      if ((await page.locator(sel).count()) > 0) return true;
    }
    return page.url().toLowerCase().includes("/auth/login");
  }

  async getAccount(): Promise<AccountInfo> {
    const authenticated = await this.isAuthenticated();
    const session = await this.getSessionStatus();
    if (authenticated) {
      const name = await this.readFirstText(ACCOUNT_SELECTORS.displayName);
      if (name) this.displayName = normalizeDisplayName(name);
    }
    return {
      id: "srncloud-primary",
      provider: "srncloud",
      displayName: this.displayName,
      loginState: authenticated ? "authenticated" : "unauthenticated",
      status: authenticated ? "Connected" : "Disconnected",
      lastSyncAt: authenticated ? new Date().toISOString() : null,
      lastActivityAt: authenticated ? new Date().toISOString() : null,
      sessionAgeMs: session.ageMs,
      connectionStatus: authenticated ? "healthy" : "down",
      capabilities: this.capabilities,
    };
  }

  async getServers(): Promise<ServerInfo[]> {
    const page = this.browser.page;
    if (!page || !(await this.isAuthenticated())) return [];
    let html: string;
    try {
      html = await fetchInPage(page, SRNCLOUD_DASHBOARD_PATH);
    } catch {
      return [];
    }
    return parseServerTable(html);
  }

  async getServerStatus(id: string): Promise<ServerInfo> {
    const servers = await this.getServers();
    const found = servers.find((s) => s.id === id);
    if (!found) throw new Error(`Server metrics are unavailable: ${id}`);
    return found;
  }

  async getRewards(): Promise<RewardsInfo> {
    const page = this.browser.page;
    if (!page || !(await this.isAuthenticated())) {
      return { coins: null, changeToday: null, lastObservedAt: null, source: "unavailable" };
    }

    // Prefer the AFK page coin counter if we are already there.
    let coins: number | null = null;
    const onAfk = page.url().toLowerCase().includes("/earn/afk");
    if (onAfk) {
      const body = await page.locator("body").innerText().catch(() => "");
      coins = parseBalance(body);
    }
    if (coins == null) {
      const html = await fetchInPage(page, SRNCLOUD_DASHBOARD_PATH).catch(() => "");
      coins = parseBalance(html);
    }

    return {
      coins,
      changeToday: null,
      lastObservedAt: coins == null ? null : new Date().toISOString(),
      source: coins == null ? "unavailable" : "page",
    };
  }

  async getResourceAllocation(): Promise<ResourceAllocation> {
    const page = this.browser.page;
    if (!page || !(await this.isAuthenticated())) {
      return { ramGb: null, cpuPercent: null, diskGb: null, coins: null };
    }
    const html = await fetchInPage(page, SRNCLOUD_DASHBOARD_PATH).catch(() => "");
    const text = stripHtml(html);
    const stat = (label: string) => {
      const m = text.match(new RegExp(`${label}\\s*([\\d.]+)\\s*(gb|mb|%)`, "i"));
      if (!m) return null;
      const value = Number(m[1]);
      if (!Number.isFinite(value)) return null;
      const unit = m[2]!.toLowerCase();
      if (unit === "%") return value;
      return unit === "gb" ? value : value / 1024;
    };
    return {
      ramGb: stat("ram"),
      cpuPercent: stat("cpu"),
      diskGb: stat("disk"),
      coins: parseBalance(html),
    };
  }

  async getSessionStatus(): Promise<{ authenticated: boolean; ageMs: number | null }> {
    const authenticated = await this.isAuthenticated();
    return {
      authenticated,
      ageMs: this.sessionStartedAt ? Date.now() - this.sessionStartedAt : this.browser.sessionAgeMs(),
    };
  }

  async keepAuthorizedSession(): Promise<void> {
    const page = await this.browser.ensurePage();
    const challenge = await this.detectChallenge();
    if (challenge.detected) {
      throw new Error("MANUAL_VERIFICATION_REQUIRED");
    }
    if (!(await this.isAuthenticated())) {
      throw new Error("LOGIN_REQUIRED");
    }
    const url = page.url();
    this.lastKnownUrl = url;
    if (!url.toLowerCase().includes("/earn/afk")) {
      await page.goto(this.afkUrl(), { waitUntil: "domcontentloaded", timeout: 45_000 });
      this.lastKnownUrl = page.url();
    }
    const after = await this.detectChallenge();
    if (after.detected) {
      throw new Error("MANUAL_VERIFICATION_REQUIRED");
    }
    if (!(await this.isAuthenticated())) {
      throw new Error("LOGIN_REQUIRED");
    }
  }

  private async readFirstText(selectors: string[]): Promise<string | null> {
    const page = this.browser.page;
    if (!page) return null;
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      if ((await loc.count()) > 0) {
        const text = (await loc.innerText().catch(() => "")).trim();
        if (text) return text;
      }
    }
    return null;
  }

  private async classifyPage(page: Page): Promise<ChallengeKind | null> {
    const url = page.url().toLowerCase();
    const title = (await page.title().catch(() => "")).toLowerCase();
    const body = await page.locator("body").innerText().catch(() => "");
    const kind = classifyChallenge(`${url}\n${title}\n${body}`);
    if (kind) return kind;
    for (const sel of CHALLENGE_SELECTORS) {
      if ((await page.locator(sel).count()) > 0) return "cloudflare";
    }
    return null;
  }

  private async pageLooksLikeChallenge(page: Page): Promise<boolean> {
    return (await this.classifyPage(page)) !== null;
  }
}

function challengeMessage(kind: ChallengeKind): string {
  switch (kind) {
    case "adblock":
      return "SRNCloud detected an ad blocker. Disable it yourself in the browser. Automation will not bypass it.";
    case "vpn":
      return "SRNCloud detected a VPN/proxy. Change your connection yourself. Automation will not bypass it.";
    case "alting":
      return "SRNCloud flagged a possible alt account. Resolve it yourself. Automation will not bypass it.";
    case "captcha":
      return "A CAPTCHA is present. Solve it yourself. Automation will not solve it.";
    default:
      return "SRNCloud/Cloudflare is requesting verification. Complete it yourself. Automation will not solve it.";
  }
}

function normalizeDisplayName(raw: string): string {
  const firstLine = raw
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ?? raw.trim();
}

function parseBalance(raw: string): number | null {
  const text = stripHtml(raw);
  const match = text.match(COIN_TEXT_PATTERN);
  if (match?.[1]) {
    const n = Number(match[1].replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  const standalone = text.match(/([\d,]+)\s+coin/i);
  if (standalone?.[1]) {
    const n = Number(standalone[1].replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

function fetchInPage(page: Page, path: string): Promise<string> {
  return page.evaluate(async (p) => {
    const res = await fetch(p, { credentials: "include" });
    return res.text();
  }, path);
}

function parseSizeMb(raw: string): number | null {
  const m = raw.replace(/,/g, "").match(/([\d.]+)\s*(g|m)?b/i);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return null;
  return (m[2] ?? "m").toLowerCase() === "g" ? value * 1024 : value;
}

function normalizeStatus(raw: string): "online" | "offline" | "unknown" {
  return SERVER_STATUS_MAP[raw.trim().toLowerCase()] ?? "unknown";
}

function parseServerTable(html: string): ServerInfo[] {
  const lower = html.toLowerCase();
  if (!lower.includes("your servers")) return [];
  const servers: ServerInfo[] = [];
  const now = new Date().toISOString();

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html)) !== null) {
    const rowHtml = row[1] ?? "";
    const cells = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((c) => c[1] ?? "");
    if (cells.length < 6) continue;

    const name = stripHtml(cells[0]!).trim();
    const node = stripHtml(cells[1]!).trim();
    const statusRaw = stripHtml(cells[2]!).trim();
    const serverType = stripHtml(cells[3]!).trim();
    const cpuRaw = stripHtml(cells[4]!).trim();
    const ramRaw = stripHtml(cells[5]!).trim();
    const diskRaw = cells[6] ? stripHtml(cells[6]!).trim() : "";
    if (!name) continue;

    const editHref = rowHtml.match(/\/server\/edit\?id=(\d+)/i);
    const id = editHref?.[1] ? `srn-server-${editHref[1]}` : `srn-server-${slug(name)}`;

    const cpu = Number(cpuRaw.replace(/[^\d.]/g, ""));
    const ramMb = parseSizeMb(ramRaw);
    const diskMb = parseSizeMb(diskRaw);

    servers.push({
      id,
      name,
      status: normalizeStatus(statusRaw),
      cpuPercent: Number.isFinite(cpu) ? cpu : null,
      ramUsedMb: null,
      ramTotalMb: ramMb,
      diskUsedGb: diskMb == null ? null : Number((diskMb / 1024).toFixed(2)),
      diskTotalGb: diskMb == null ? null : Number((diskMb / 1024).toFixed(2)),
      players: null,
      maxPlayers: null,
      uptimeMs: null,
      lastCheckAt: now,
      node: node || null,
      serverType: serverType || null,
      unavailableReason: "Live usage, players, and uptime are not exposed by SRNCloud.",
    });
  }

  return servers;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
