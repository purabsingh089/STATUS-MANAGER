"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LogItem } from "@/lib/types";

const COLORS: Record<string, string> = {
  DEBUG: "text-slate-500",
  INFO: "text-sky-300",
  WARN: "text-amber-300",
  ERROR: "text-red-300",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [level, setLevel] = useState("");

  useEffect(() => {
    void api.logs(level || undefined).then((r) => setLogs(r.logs));
  }, [level]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
          <p className="mt-1 text-sm text-muted">Secrets, cookies, and tokens are never written here.</p>
        </div>
        <label className="text-sm">
          <span className="sr-only">Level</span>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="min-h-11 rounded-xl border border-line bg-slate-950 px-3 text-sm"
          >
            <option value="">All</option>
            <option>DEBUG</option>
            <option>INFO</option>
            <option>WARN</option>
            <option>ERROR</option>
          </select>
        </label>
      </div>
      <div className="overflow-auto rounded-2xl border border-line bg-slate-950/80 p-4 font-mono text-[13px] leading-7">
        {logs.length === 0 && <div className="text-muted">No logs yet.</div>}
        {logs.map((log) => (
          <div key={log.id} className="grid grid-cols-[88px_64px_1fr] gap-3">
            <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span className={COLORS[log.level]}>{log.level.padEnd(5, " ")}</span>
            <span className="text-slate-200">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
