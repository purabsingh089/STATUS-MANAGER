"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  ArrowUpRight,
  Clock,
  Coins,
  Cpu,
  Eye,
  Radio,
  Server,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import { Card } from "@/components/Card";
import { StatTile } from "@/components/StatTile";
import { StatusDot, statusColor } from "@/components/StatusDot";
import { HealthPills } from "@/components/HealthPills";
import { Sparkline } from "@/components/Sparkline";
import { Empty } from "@/components/Empty";
import { api } from "@/lib/api";
import { formatAgo, formatDuration, metric } from "@/lib/format";
import { useLiveState } from "@/hooks/useLiveState";
import { useNow } from "@/hooks/useNow";
import type { ActivityItem, CoinSnapshot, ServerInfo } from "@/lib/types";

const STATE_TONE: Record<string, { ring: string; text: string; label: string }> = {
  RUNNING: { ring: "#22C55E", text: "text-accent", label: "Live" },
  CONNECTED: { ring: "#38BDF8", text: "text-info", label: "Connected" },
  AUTHENTICATING: { ring: "#38BDF8", text: "text-info", label: "Authenticating" },
  STARTING: { ring: "#38BDF8", text: "text-info", label: "Starting" },
  PAUSED: { ring: "#F59E0B", text: "text-warn", label: "Paused" },
  CHALLENGE_REQUIRED: { ring: "#F59E0B", text: "text-warn", label: "Action needed" },
  LOGIN_REQUIRED: { ring: "#F59E0B", text: "text-warn", label: "Login required" },
  SESSION_EXPIRED: { ring: "#F59E0B", text: "text-warn", label: "Session expired" },
  NETWORK_ERROR: { ring: "#EF4444", text: "text-danger", label: "Network error" },
  BROWSER_ERROR: { ring: "#EF4444", text: "text-danger", label: "Browser error" },
  ERROR: { ring: "#EF4444", text: "text-danger", label: "Error" },
  IDLE: { ring: "#64748B", text: "text-slate-400", label: "Idle" },
  STOPPED: { ring: "#64748B", text: "text-slate-400", label: "Stopped" },
  STOPPING: { ring: "#64748B", text: "text-slate-400", label: "Stopping" },
};

function StateRing({ state, runId }: { state: string; runId?: string | null }) {
  const tone = STATE_TONE[state] ?? STATE_TONE.IDLE!;
  const running = state === "RUNNING" || state === "CONNECTED";
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      {running && (
        <span
          className="absolute h-24 w-24 rounded-full animate-pulse-ring"
          style={{ backgroundColor: `${tone.ring}33` }}
          aria-hidden
        />
      )}
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#1E293B" strokeWidth="6" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={tone.ring}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={running ? `${C * 0.75} ${C}` : `${C * 0.25} ${C}`}
          className={running ? "animate-sweep" : ""}
          style={{ transition: "stroke 300ms ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <Radio className={`h-5 w-5 ${tone.text}`} />
        <div className={`mt-1 text-center text-sm font-semibold tracking-wide ${tone.text}`}>{tone.label}</div>
        {runId ? <div className="font-mono text-[10px] text-slate-500">{runId.slice(0, 8)}</div> : null}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const live = useLiveState();
  const now = useNow(1000);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [snapshots, setSnapshots] = useState<CoinSnapshot[]>([]);
  const [coins, setCoins] = useState<number | null>(null);

  useEffect(() => {
    void Promise.all([api.servers(), api.activity(), api.rewards()]).then(([s, a, r]) => {
      setServers(s.servers);
      setActivity(a.activity.slice(0, 7));
      setCoins(r.coins);
      setSnapshots([...r.snapshots].reverse());
    });
  }, [live.automation?.state, live.account?.lastSyncAt]);

  const account = live.account;
  const auto = live.automation;
  const health = live.health;

  const liveRuntime = useMemo(() => {
    if (!auto?.startedAt) return auto?.runtimeMs ?? null;
    if (auto.state !== "RUNNING" && auto.state !== "CONNECTED") return auto.runtimeMs ?? null;
    return now - new Date(auto.startedAt).getTime();
  }, [auto?.startedAt, auto?.runtimeMs, auto?.state, now]);

  const coinSeries = useMemo(
    () => snapshots.map((s) => s.balance).filter((n) => Number.isFinite(n)),
    [snapshots],
  );

  const changeSinceStart =
    coinSeries.length >= 2 ? coinSeries[coinSeries.length - 1]! - coinSeries[0]! : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Command hero */}
      <section className="glass-raised animate-fade-up relative overflow-hidden rounded-2xl p-6">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <StateRing state={auto?.state ?? "IDLE"} runId={auto?.runId} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                SRNCloud Command Center
              </div>
              <h1 className="mt-1.5 truncate text-2xl font-semibold tracking-tight">
                {account?.displayName?.trim() || "No account connected"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                {account ? (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-accent" />
                      {account.loginState}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      Sync {formatAgo(account.lastSyncAt)}
                    </span>
                  </>
                ) : (
                  <span>Connect an authorized session to begin.</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row lg:items-center">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-slate-900/50 px-4 py-3">
              <span className={`h-2 w-2 rounded-full ${live.connected ? "bg-accent shadow-[0_0_10px_rgba(34,197,94,0.6)]" : "bg-slate-500"}`} />
              <span className="text-sm text-slate-300">{live.connected ? "Live stream" : "Reconnecting"}</span>
            </div>
            <Link
              href="/automation"
              className="group inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-slate-950 shadow-glow transition hover:bg-emerald-400"
            >
              Open AFK Manager
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Observed Coins"
          value={coins == null ? "Unavailable" : coins.toLocaleString()}
          hint={changeSinceStart == null ? "Awaiting more observations" : `${changeSinceStart >= 0 ? "+" : ""}${changeSinceStart} across session`}
          icon={<Coins className="h-4 w-4" />}
          tone={coins == null ? "muted" : "accent"}
        />
        <StatTile
          label="Session Runtime"
          value={formatDuration(liveRuntime)}
          hint={auto?.startedAt ? `Since ${new Date(auto.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not started"}
          icon={<Timer className="h-4 w-4" />}
        />
        <StatTile
          label="Last Verified"
          value={formatAgo(auto?.lastCheckAt)}
          hint="Keep-alive heartbeat"
          icon={<Eye className="h-4 w-4" />}
          tone={auto?.lastCheckAt ? "default" : "muted"}
        />
        <StatTile
          label="Servers Online"
          value={servers.length === 0 ? "Unavailable" : `${servers.filter((s) => s.status === "online").length}/${servers.length}`}
          hint={servers.length === 0 ? "Provider exposes no metrics" : "Fleet from SRNCloud dashboard"}
          icon={<Server className="h-4 w-4" />}
          tone={servers.length === 0 ? "muted" : "default"}
        />
      </div>

      {/* Health + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title="System Health"
          subtitle="Six-point live probe"
          icon={<ActivityIcon className="h-4 w-4 text-accent" />}
          className="lg:col-span-2"
        >
          <HealthPills health={health} />
          <div className="mt-5 grid gap-4 border-t border-line/70 pt-5 sm:grid-cols-2">
            <div className="rounded-xl border border-line/80 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Active Page</span>
                <StatusDot status={auto?.state === "RUNNING" ? "healthy" : "unknown"} label={auto?.state ?? "IDLE"} pulse />
              </div>
              <div className="mt-2 truncate font-mono text-xs text-slate-300">{auto?.pageUrl ?? "—"}</div>
              {auto?.reason && auto.state !== "RUNNING" ? (
                <p className="mt-2 text-xs text-warn">{auto.reason}</p>
              ) : null}
            </div>
            <div className="rounded-xl border border-line/80 bg-slate-900/40 p-4">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Coin Trend</span>
              <div className="mt-3">
                <Sparkline values={coinSeries} />
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Live Activity"
          icon={<Radio className="h-4 w-4 text-accent" />}
          action={<Link href="/activity" className="text-xs text-accent transition hover:text-emerald-300">View all</Link>}
        >
          {activity.length === 0 ? (
            <Empty title="No activity yet" body="Events appear here once automation starts." />
          ) : (
            <ol className="relative space-y-3 before:absolute before:left-[7px] before:top-1 before:h-[calc(100%-8px)] before:w-px before:bg-line/80">
              {activity.map((item) => (
                <li key={item.id} className="relative flex gap-3 pl-6 text-sm">
                  <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-bg bg-accent/70" aria-hidden />
                  <span className="w-14 shrink-0 font-mono text-xs text-slate-500 tabular">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-slate-200">{item.title}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* Servers */}
      <Card
        title="Server Fleet"
        icon={<Server className="h-4 w-4 text-accent" />}
        action={<Link href="/servers" className="text-xs text-accent transition hover:text-emerald-300">View all</Link>}
      >
        {servers.length === 0 ? (
          <Empty
            title="No server metrics available"
            body="The provider does not expose server metrics for this account. Values will appear here if that changes."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((s) => (
              <Link
                key={s.id}
                href={`/servers/detail?id=${encodeURIComponent(s.id)}`}
                className="group rounded-xl border border-line/80 bg-slate-900/40 p-4 transition duration-200 hover:border-slate-600 hover:bg-slate-900/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-medium">{s.name}</div>
                  <StatusDot status={s.status} />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {[s.node, s.serverType].filter(Boolean).join(" · ") || "SRNCloud"}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" />
                    {metric(s.cpuPercent, "%")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {s.players == null ? "No players data" : `${s.players}/${s.maxPlayers ?? "?"}`}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Footer status strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/70 bg-slate-900/30 px-5 py-3 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Values are observed only — nothing is invented.
        </span>
        <span className={`font-mono ${statusColor(health?.automation ?? "unknown")}`}>
          automation: {health?.automation ?? "unknown"}
        </span>
      </div>
    </div>
  );
}