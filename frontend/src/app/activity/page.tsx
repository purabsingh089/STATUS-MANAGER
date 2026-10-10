"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { Empty } from "@/components/Empty";
import { api } from "@/lib/api";
import type { ActivityItem } from "@/lib/types";

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    void api.activity().then((r) => setItems(r.activity));
  }, []);

  const groups = items.reduce<Record<string, ActivityItem[]>>((acc, item) => {
    const day = new Date(item.timestamp).toLocaleDateString();
    acc[day] ??= [];
    acc[day].push(item);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-muted">Timeline of session, recovery, and sync events.</p>
      </div>
      {items.length === 0 ? (
        <Empty title="No activity" body="Start automation to record events." />
      ) : (
        Object.entries(groups).map(([day, list]) => (
          <Card key={day} title={day}>
            <ol className="space-y-4">
              {list.map((item) => (
                <li key={item.id} className="flex gap-4">
                  <span className="w-14 shrink-0 font-mono text-sm text-slate-500">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div>
                    <div className="text-sm text-slate-100">{item.title}</div>
                    {item.detail && <div className="text-xs text-muted">{item.detail}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        ))
      )}
    </div>
  );
}
