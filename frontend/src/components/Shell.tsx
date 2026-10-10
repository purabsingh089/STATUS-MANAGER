"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Cloud,
  Gauge,
  LayoutDashboard,
  ScrollText,
  Server,
  Settings,
  Coins,
} from "lucide-react";
import { ChallengeBanner } from "./ChallengeBanner";
import { useLiveState } from "@/hooks/useLiveState";
import type { AutomationState } from "@/lib/types";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/automation", label: "Automation", icon: Gauge },
  { href: "/servers", label: "Servers", icon: Server },
  { href: "/rewards", label: "Rewards", icon: Coins },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE = NAV.filter((n) =>
  ["/", "/automation", "/servers", "/activity", "/settings"].includes(n.href),
);

const TITLE: Record<string, string> = {
  "/": "Dashboard",
  "/automation": "AFK Manager",
  "/servers": "Servers",
  "/rewards": "Rewards",
  "/activity": "Activity",
  "/logs": "Logs",
  "/settings": "Settings",
};

function stateTone(state: AutomationState | undefined) {
  if (!state) return "text-slate-400";
  if (state === "RUNNING" || state === "CONNECTED") return "text-accent";
  if (state === "CHALLENGE_REQUIRED" || state === "PAUSED" || state === "LOGIN_REQUIRED") return "text-warn";
  if (state === "ERROR" || state === "BROWSER_ERROR" || state === "SESSION_EXPIRED") return "text-danger";
  return "text-slate-400";
}

function initial(name?: string | null) {
  const c = name?.trim()?.[0];
  return c ? c.toUpperCase() : "S";
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const live = useLiveState();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const title =
    TITLE[pathname] ?? NAV.find((n) => n.href !== "/" && pathname.startsWith(n.href))?.label ?? "Dashboard";

  return (
    <div className="relative z-10 min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-line/80 bg-surface/70 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 to-info/20 text-accent shadow-glow-sm">
            <Cloud className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">SRNCloud</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted">AFK Manager</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-200 ${
                  active
                    ? "bg-white/[0.07] text-white"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
                }`}
              >
                {active && (
                  <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent shadow-glow-sm" aria-hidden />
                )}
                <Icon className={`h-4 w-4 transition-colors ${active ? "text-accent" : "group-hover:text-slate-200"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mx-3 mb-4 rounded-xl border border-line/80 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">Automation</span>
            <span className={`h-1.5 w-1.5 rounded-full ${live.connected ? "bg-accent shadow-glow-sm" : "bg-slate-500"}`} />
          </div>
          <div className={`mt-1.5 font-mono text-sm ${stateTone(live.automation?.state)}`}>
            {live.automation?.state ?? "IDLE"}
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line/80 bg-bg/70 px-4 py-3 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium tracking-tight text-slate-100">{title}</h1>
            <span className="hidden items-center gap-1.5 rounded-full border border-line/80 bg-slate-900/50 px-2.5 py-1 text-[11px] text-muted sm:inline-flex">
              <span className={`h-1.5 w-1.5 rounded-full ${live.connected ? "bg-accent" : "bg-slate-500"}`} />
              {live.connected ? "Live" : "Reconnecting"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="max-w-[220px] truncate text-xs font-medium text-slate-200">
                {live.account?.displayName?.trim() || "No account"}
              </div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                {live.account?.loginState ?? "disconnected"}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-gradient-to-br from-accent/20 to-info/10 text-sm font-semibold text-accent">
              {initial(live.account?.displayName)}
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 pb-24 lg:px-8 lg:pb-10">
          <ChallengeBanner automation={live.automation} />
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line/80 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {MOBILE.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
                active ? "text-accent" : "text-slate-500"
              }`}
            >
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" aria-hidden />}
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}