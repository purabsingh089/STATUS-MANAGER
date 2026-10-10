"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Boxes } from "lucide-react";
import { Card } from "@/components/Card";
import { Metric } from "@/components/Metric";
import { StatusDot } from "@/components/StatusDot";
import { Empty } from "@/components/Empty";
import { api } from "@/lib/api";
import { formatAgo, formatDuration, metric } from "@/lib/format";
import type { ServerInfo } from "@/lib/types";

function gb(mb: number | null): string {
  return mb == null ? "Unavailable" : `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
}

export default function ServerDetailPage() {
  const params = useParams<{ id: string }>();
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .server(params.id)
      .then((r) => setServer(r.server))
      .catch((e: Error) => setError(e.message));
  }, [params.id]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/servers" className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Servers
        </Link>
        <Empty title="Server not found" body={error} />
      </div>
    );
  }
  if (!server) return <div className="text-sm text-muted">Loading...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/servers" className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Servers
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{server.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {server.node ? (
              <span className="inline-flex items-center gap-1">
                <Boxes className="h-3.5 w-3.5" /> {server.node}
              </span>
            ) : null}
            {server.serverType ? <span className="rounded-full border border-line px-2 py-0.5">{server.serverType}</span> : null}
          </div>
        </div>
        <StatusDot status={server.status} label={server.status.toUpperCase()} />
      </div>
      <Card>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          <Metric label="CPU allocation" value={metric(server.cpuPercent, "%")} />
          <Metric label="RAM allocation" value={gb(server.ramTotalMb)} />
          <Metric label="Disk allocation" value={server.diskTotalGb == null ? "Unavailable" : `${server.diskTotalGb} GB`} />
          <Metric label="RAM used" value={server.ramUsedMb == null ? "Unavailable" : gb(server.ramUsedMb)} />
          <Metric label="Players" value={server.players == null ? "Unavailable" : `${server.players} / ${server.maxPlayers ?? "?"}`} />
          <Metric label="Uptime" value={formatDuration(server.uptimeMs)} />
          <Metric label="Last Check" value={formatAgo(server.lastCheckAt)} />
        </div>
        <p className="mt-5 border-t border-line/70 pt-4 text-xs text-slate-500">
          {server.unavailableReason ?? "Only values exposed by SRNCloud are shown; unavailable fields are reported as Unavailable."}
        </p>
      </Card>
    </div>
  );
}
