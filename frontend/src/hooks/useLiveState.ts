"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AccountInfo, AutomationSnapshot, HealthSnapshot, NotificationItem } from "@/lib/types";

interface LiveState {
  automation: AutomationSnapshot | null;
  health: HealthSnapshot | null;
  account: AccountInfo | null;
  notifications: NotificationItem[];
  connected: boolean;
}

export function useLiveState() {
  const [state, setState] = useState<LiveState>({
    automation: null,
    health: null,
    account: null,
    notifications: [],
    connected: false,
  });

  const refresh = useCallback(async () => {
    try {
      const [status, notes] = await Promise.all([api.status(), api.notifications()]);
      setState((s) => ({
        ...s,
        automation: status.automation,
        health: status.health,
        account: status.account,
        notifications: notes.notifications,
        connected: true,
      }));
    } catch {
      setState((s) => ({ ...s, connected: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/api/ws`);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { event: string; payload: unknown };
        setState((s) => {
          const next = { ...s, connected: true };
          if (msg.event === "automation.status") next.automation = msg.payload as AutomationSnapshot;
          if (msg.event === "health.updated") next.health = msg.payload as HealthSnapshot;
          if (msg.event === "account.updated") next.account = msg.payload as AccountInfo;
          if (msg.event === "notification.created") {
            next.notifications = [msg.payload as NotificationItem, ...s.notifications].slice(0, 50);
          }
          return next;
        });
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => setState((s) => ({ ...s, connected: false }));
    const poll = window.setInterval(() => void refresh(), 5_000);
    return () => {
      ws.close();
      window.clearInterval(poll);
    };
  }, [refresh]);

  return { ...state, refresh };
}
