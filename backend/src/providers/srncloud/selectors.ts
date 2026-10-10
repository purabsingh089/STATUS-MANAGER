/**
 * SRNCloud (client.srncloud.in) selectors and URL patterns.
 * Verified against the public login page. Authenticated AFK DOM may still change.
 */

export const SRNCLOUD_DEFAULT_BASE_URL = "https://client.srncloud.in";
export const SRNCLOUD_LOGIN_PATH = "/auth/login";
export const SRNCLOUD_AFK_PATH = "/earn/afk";
export const SRNCLOUD_DASHBOARD_PATH = "/dashboard";

/**
 * Regular expression matching the AFK page coin counter, e.g.
 * "You currently have 205 Coin(s)!".
 */
export const COIN_TEXT_PATTERN = /you currently have\s+([\d,]+)\s+coin/i;

/**
 * Status labels used by the SRNCloud dashboard server table, mapped to the
 * normalized status values used by this app.
 */
export const SERVER_STATUS_MAP: Record<string, "online" | "offline" | "unknown"> = {
  installed: "online",
  running: "online",
  online: "online",
  active: "online",
  suspended: "offline",
  offline: "offline",
  stopped: "offline",
  installing: "unknown",
  pending: "unknown",
};

export const LOGIN_SELECTORS = {
  email: '#email, input[name="email"]',
  password: '#password, input[name="password"]',
  submit: 'button[name="login"], button[type="submit"]',
};

export const CHALLENGE_INDICATORS = [
  "cf-challenge",
  "cf-turnstile",
  "challenges.cloudflare.com",
  "captcha",
  "hcaptcha",
  "recaptcha",
  "Just a moment",
  "Checking your browser",
  "Verify you are human",
  "Attention Required",
  "cf-browser-verification",
];

export const CHALLENGE_SELECTORS = [
  "iframe[src*='challenges.cloudflare.com']",
  "iframe[src*='turnstile']",
  ".cf-turnstile",
  "[data-sitekey]",
];

/**
 * SRNCloud security-module messages (anti-adblocker, anti-VPN, anti-alting).
 * When any of these appear, automation must pause for the operator instead of
 * attempting to bypass the provider's detection.
 */
export const ADBLOCK_INDICATORS = [
  "adblock detected",
  "ad blocker detected",
  "adblocker detected",
  "disable your adblocker",
  "disable your ad blocker",
  "disable adblock",
  "please disable adblock",
  "we detected an ad blocker",
  "turn off your ad blocker",
];

export const VPN_INDICATORS = [
  "vpn detected",
  "proxy detected",
  "vpn or proxy",
  "disable your vpn",
  "disable your proxy",
  "please disable your vpn",
  "you are using a vpn",
  "connection via vpn",
];

export const ALTING_INDICATORS = [
  "alt account detected",
  "alt-account detected",
  "multiple accounts detected",
  "disable your alt account",
  "anti-alting",
];

export const BLOCK_INDICATORS = [...ADBLOCK_INDICATORS, ...VPN_INDICATORS, ...ALTING_INDICATORS];

export type ChallengeKind = "cloudflare" | "captcha" | "adblock" | "vpn" | "alting";

export function classifyChallenge(haystack: string): ChallengeKind | null {
  const value = haystack.toLowerCase();
  if (ADBLOCK_INDICATORS.some((ind) => value.includes(ind))) return "adblock";
  if (VPN_INDICATORS.some((ind) => value.includes(ind))) return "vpn";
  if (ALTING_INDICATORS.some((ind) => value.includes(ind))) return "alting";
  if (CHALLENGE_INDICATORS.some((ind) => value.includes(ind.toLowerCase()))) return "cloudflare";
  return null;
}

export const LOGOUT_INDICATORS = [
  'input[type="password"]',
  'form[action*="login"]',
  'a[href*="/auth/login"]',
];

export const AUTH_INDICATORS = [
  'a[href*="/auth/logout"]',
  'a[href*="logout"]',
  'a[href*="/earn/afk"]',
  'a[href*="/dashboard"]',
  ".navbar-dropdown",
  ".user-dropdown",
];

export const ACCOUNT_SELECTORS = {
  displayName: [".user-name", ".fw-semibold", "[data-account-name]", ".avatar-initial"],
};

export const REWARD_SELECTORS = {
  coins: [".coin-balance", "[data-coins]", ".coins", ".balance", "#coins"],
};

/**
 * Authenticated dashboard server table (verified against client.srncloud.in/dashboard).
 * Columns: Server name | Node | Status | Server type | Cpu | Ram | Disk | Actions
 * The table is wrapped in a `.table-responsive` container under a "Your servers:" heading.
 */
export const DASHBOARD_SERVER_TABLE_HEADER = "server name";
export const DASHBOARD_SERVER_ROW_SELECTOR = "table tbody tr";

export const RESOURCE_SELECTORS = {
  ram: ["[data-ram]", ".resource-ram"],
  cpu: ["[data-cpu]", ".resource-cpu"],
  disk: ["[data-disk]", ".resource-disk"],
};
