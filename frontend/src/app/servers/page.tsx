"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cpu, HardDrive, MemoryStick, Boxes, Radio } from "lucide-react";
import { Card } from "@/components/Card";
import { Empty } from "@/components/Empty";
import { StatusDot } from "@/components/StatusDot";
import { api } from "@/lib/api";
import { formatAgo, metric } from "@/lib/format";
import type { ServerInfo } from "@/lib/types";

function gb(mb: number | null): string {
  return mb == null ? "Unavailable" : `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
}

export default function ServersPage() {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [note, setNote] = useState<string | undefined>();

  useEffect(() => {
    const load = () =>
      api.servers().then((r) => {
        setServers(r.servers);
        setNote(r.note);
      });
    void load();
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Servers</h1>
        <p className="mt-1 text-sm text-muted">Only metrics actually exposed by SRNCloud are shown.</p>
      </div>
      {servers.length === 0 ? (
        <Empty
          title="No servers available"
          body={note ?? "Unavailable. Connect an account and start automation, or enable mock mode."}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {servers.map((s) => (
            <Link key={s.id} href={`/servers/detail?id=${encodeURIComponent(s.id)}`}>
              <Card className="transition duration-200 hover:border-slate-600">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-medium">{s.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      {s.node ? (
                        <span className="inline-flex items-center gap-1">
                          <Boxes className="h-3.5 w-3.5" />
                          {s.node}
                        </span>
                      ) : null}
                      {s.serverType ? <span className="rounded-full border border-line px-2 py-0.5">{s.serverType}</span> : null}
                    </div>
                  </div>
                  <StatusDot status={s.status} label={s.status.toUpperCase()} />
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="flex items-center gap-1.5 text-muted">
                      <Cpu className="h-3.5 w-3.5" /> CPU
                    </dt>
                    <dd className="mt-1 font-mono tabular">{metric(s.cpuPercent, "%")}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-muted">
                      <MemoryStick className="h-3.5 w-3.5" /> RAM
                    </dt>
                    <dd className="mt-1 font-mono tabular">
                      {s.ramUsedMb == null
                        ? gb(s.ramTotalMb)
                        : `${(s.ramUsedMb / 1024).toFixed(1)} / ${gb(s.ramTotalMb)}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-muted">
                      <HardDrive className="h-3.5 w-3.5" /> Disk
                    </dt>
                    <dd className="mt-1 font-mono tabular">{s.diskTotalGb == null ? "Unavailable" : `${s.diskTotalGb} GB`}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5" />
                    {s.players == null ? "Players unavailable" : `${s.players} / ${s.maxPlayers ?? "?"}`}
                  </span>
                  <span>{formatAgo(s.lastCheckAt)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {servers.length > 0 ? (
        <p className="text-xs text-slate-500">
          Live usage, players, and uptime are not exposed by SRNCloud; allocation limits are shown where available.
        </p>
      ) : null}
    </div>
  );
}