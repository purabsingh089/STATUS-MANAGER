async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null;
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  session: () => request<{ authenticated: boolean; passwordRequired: boolean }>("/api/auth/session"),
  login: (password: string) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  status: () =>
    request<{ automation: import("./types").AutomationSnapshot; health: import("./types").HealthSnapshot; account: import("./types").AccountInfo | null }>(
      "/api/status",
    ),
  account: () => request<{ account: import("./types").AccountInfo | null }>("/api/account"),
  connect: (username: string, password: string) =>
    request("/api/account/connect", { method: "POST", body: JSON.stringify({ username, password }) }),
  disconnect: () => request("/api/account/disconnect", { method: "POST" }),
  servers: () => request<{ servers: import("./types").ServerInfo[]; note?: string }>("/api/servers"),
  server: (id: string) => request<{ server: import("./types").ServerInfo }>(`/api/servers/${id}`),
  automation: () => request<import("./types").AutomationSnapshot>("/api/automation"),
  start: () => request("/api/automation/start", { method: "POST" }),
  stop: () => request("/api/automation/stop", { method: "POST" }),
  pause: () => request("/api/automation/pause", { method: "POST" }),
  resume: () => request("/api/automation/resume", { method: "POST" }),
  restartBrowser: () => request("/api/browser/restart", { method: "POST" }),
  reconnect: () => request("/api/session/reconnect", { method: "POST" }),
  logs: (level?: string) => request<{ logs: import("./types").LogItem[] }>(`/api/logs${level ? `?level=${level}` : ""}`),
  activity: () => request<{ activity: import("./types").ActivityItem[] }>("/api/activity"),
  notifications: () => request<{ notifications: import("./types").NotificationItem[] }>("/api/notifications"),
  settings: () => request<{ settings: import("./types").AppSettings }>("/api/settings"),
  saveSettings: (body: Partial<import("./types").AppSettings>) =>
    request("/api/settings", { method: "PUT", body: JSON.stringify(body) }),
  rewards: () =>
    request<{ coins: number | null; change: number | null; lastObservedAt: string | null; snapshots: import("./types").CoinSnapshot[]; note?: string }>(
      "/api/rewards",
    ),
  resources: () => request<{ resources: Record<string, unknown> | null }>("/api/resources"),
  scheduler: () => request<{ tasks: { id: string; label: string; intervalMs: number; active: boolean }[] }>("/api/scheduler"),
  scenario: (scenario: string) => request("/api/dev/scenario", { method: "POST", body: JSON.stringify({ scenario }) }),
};
