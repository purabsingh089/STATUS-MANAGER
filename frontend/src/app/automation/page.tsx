"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Metric } from "@/components/Metric";
import { StatusDot } from "@/components/StatusDot";
import { api } from "@/lib/api";
import { formatAgo, formatDuration } from "@/lib/format";
import { useLiveState } from "@/hooks/useLiveState";

export default function AutomationPage() {
  const live = useLiveState();
  const auto = live.automation;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(name: string, fn: () => Promise<unknown>) {
    setBusy(name);
    setError(null);
    try {
      await fn();
      await live.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const actions = [
    { id: "start", label: "Start", fn: api.start },
    { id: "pause", label: "Pause", fn: api.pause },
    { id: "resume", label: "Resume", fn: api.resume },
    { id: "stop", label: "Stop", fn: api.stop, danger: true },
    { id: "restart", label: "Restart browser", fn: api.restartBrowser },
    { id: "reconnect", label: "Reconnect session", fn: api.reconnect },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AFK Manager</h1>
        <p className="mt-1 text-sm text-muted">Start, pause, and recover an authorized browser session.</p>
      </div>

      <Card>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Status</div>
            <div className="mt-2 font-mono text-xl text-accent">{auto?.state ?? "IDLE"}</div>
          </div>
          <Metric label="Started" value={auto?.startedAt ? new Date(auto.startedAt).toLocaleString() : "—"} />
          <Metric label="Runtime" value={formatDuration(auto?.runtimeMs)} />
          <Metric label="Last Check" value={formatAgo(auto?.lastCheckAt)} />
          <Metric label="Page" value={auto?.pageUrl ?? "—"} />
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Browser</div>
            <div className="mt-2">
              <StatusDot status={auto?.browser ?? "unknown"} />
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Connection</div>
            <div className="mt-2">
              <StatusDot status={auto?.connection ?? "unknown"} />
            </div>
          </div>
        </div>
        {auto?.reason && <p className="mt-5 text-sm text-slate-400">{auto.reason}</p>}
      </Card>

      {auto?.state === "CHALLENGE_REQUIRED" && (
        <Card>
          <h2 className="text-lg font-medium text-amber-100">Manual verification required</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            SRNCloud/Cloudflare is requesting verification. Complete the verification in the browser. Automation will
            resume after verification. This application will not solve or bypass the challenge.
          </p>
        </Card>
      )}

      <Card title="Controls">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {actions.map((a) => (
            <button
              key={a.id}
              disabled={busy !== null}
              onClick={() => void run(a.id, a.fn)}
              className={`min-h-11 rounded-xl border px-3 text-sm font-medium transition ${
                a.danger
                  ? "border-danger/40 bg-danger/10 text-red-200"
                  : "border-line bg-slate-900/60 text-slate-100 hover:border-slate-500"
              } disabled:opacity-50`}
            >
              {busy === a.id ? "Working…" : a.label}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
