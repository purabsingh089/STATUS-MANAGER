"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/Card";
import { Empty } from "@/components/Empty";
import { api } from "@/lib/api";
import type { CoinSnapshot } from "@/lib/types";

export default function RewardsPage() {
  const [coins, setCoins] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<CoinSnapshot[]>([]);
  const [resources, setResources] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void Promise.all([api.rewards(), api.resources()]).then(([r, res]) => {
      setCoins(r.coins);
      setChange(r.change);
      setSnapshots([...r.snapshots].reverse());
      setResources(res.resources);
    });
  }, []);

  const data = useMemo(
    () =>
      snapshots.map((s) => ({
        t: new Date(s.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        balance: s.balance,
      })),
    [snapshots],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coins & Rewards</h1>
        <p className="mt-1 text-sm text-muted">Historical observations stored locally. Values are never manufactured.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Coins">
          <div className="font-mono text-4xl tabular">{coins == null ? "Unavailable" : coins.toLocaleString()}</div>
          <div className="mt-2 text-sm text-slate-400">
            {change == null ? "No delta yet" : `${change >= 0 ? "+" : ""}${change} since last observation`}
          </div>
        </Card>
        <Card title="Available Resources">
          {resources ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">RAM</dt>
                <dd className="font-mono">{resources.ram_gb == null ? "Unavailable" : `${resources.ram_gb} GB`}</dd>
              </div>
              <div>
                <dt className="text-muted">CPU</dt>
                <dd className="font-mono">{resources.cpu_percent == null ? "Unavailable" : `${resources.cpu_percent}%`}</dd>
              </div>
              <div>
                <dt className="text-muted">Disk</dt>
                <dd className="font-mono">{resources.disk_gb == null ? "Unavailable" : `${resources.disk_gb} GB`}</dd>
              </div>
              <div>
                <dt className="text-muted">Coins</dt>
                <dd className="font-mono">{resources.coins == null ? "Unavailable" : Number(resources.coins).toLocaleString()}</dd>
              </div>
            </dl>
          ) : (
            <Empty title="No resource snapshot" body="Unavailable until the provider exposes allocation data." />
          )}
        </Card>
      </div>
      <Card title="Historical balance">
        {data.length < 2 ? (
          <Empty title="Not enough observations" body="Charts appear after multiple balance snapshots are recorded." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="c" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
                <Area type="monotone" dataKey="balance" stroke="#22c55e" fill="url(#c)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
