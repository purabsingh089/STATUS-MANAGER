"use client";

import { FormEvent, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api } from "@/lib/api";
import type { AppSettings } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void api.settings().then((r) => setSettings(r.settings));
  }, []);

  async function save(partial: Partial<AppSettings>) {
    const r = await api.saveSettings(partial);
    setSettings((r as { settings: AppSettings }).settings);
    setMsg("Saved");
  }

  async function connect(e: FormEvent) {
    e.preventDefault();
    await api.connect(user, pass);
    setPass("");
    setMsg("Account connected. Credentials stored encrypted.");
  }

  if (!settings) return <div className="text-sm text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Local encryption, intervals, and account controls.</p>
      </div>

      <Card title="Account">
        <form onSubmit={connect} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Username / email</span>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-line bg-slate-950 px-3 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Password</span>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-line bg-slate-950 px-3 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-slate-950">Re-authenticate</button>
            <button
              type="button"
              className="min-h-11 rounded-xl border border-danger/40 px-4 text-sm text-red-200"
              onClick={() => void api.disconnect().then(() => setMsg("Disconnected"))}
            >
              Disconnect
            </button>
          </div>
        </form>
      </Card>

      <Card title="Automation">
        <label className="flex min-h-11 items-center justify-between text-sm">
          Auto-start
          <input
            type="checkbox"
            checked={settings.autoStart}
            onChange={(e) => void save({ autoStart: e.target.checked })}
          />
        </label>
        <label className="mt-3 block text-sm">
          Health-check interval (ms)
          <input
            type="number"
            defaultValue={settings.healthCheckIntervalMs}
            className="mt-1 min-h-11 w-full rounded-xl border border-line bg-slate-950 px-3"
            onBlur={(e) => void save({ healthCheckIntervalMs: Number(e.target.value) })}
          />
        </label>
        <label className="mt-3 block text-sm">
          Retry count
          <input
            type="number"
            defaultValue={settings.retryCount}
            className="mt-1 min-h-11 w-full rounded-xl border border-line bg-slate-950 px-3"
            onBlur={(e) => void save({ retryCount: Number(e.target.value) })}
          />
        </label>
        <label className="mt-3 flex min-h-11 items-center justify-between text-sm">
          Restart browser on crash
          <input
            type="checkbox"
            checked={settings.browserRestartOnCrash}
            onChange={(e) => void save({ browserRestartOnCrash: e.target.checked })}
          />
        </label>
      </Card>

      <Card title="Notifications">
        <label className="flex min-h-11 items-center justify-between text-sm">
          In-app notifications
          <input
            type="checkbox"
            checked={settings.browserNotifications}
            onChange={(e) => void save({ browserNotifications: e.target.checked })}
          />
        </label>
        <label className="mt-3 flex min-h-11 items-center justify-between text-sm">
          Webhook notifications
          <input
            type="checkbox"
            checked={settings.webhookNotifications}
            onChange={(e) => void save({ webhookNotifications: e.target.checked })}
          />
        </label>
        <label className="mt-3 block text-sm">
          Webhook URL
          <input
            defaultValue={settings.webhookUrl ?? ""}
            className="mt-1 min-h-11 w-full rounded-xl border border-line bg-slate-950 px-3"
            onBlur={(e) => void save({ webhookUrl: e.target.value || null })}
          />
        </label>
      </Card>

      <Card title="Security">
        <p className="text-sm text-slate-300">Credentials are encrypted with AES-256-GCM using ENCRYPTION_KEY.</p>
        <p className="mt-2 text-sm text-muted">Encryption status: active. Passwords and cookies are never logged.</p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-xl border border-line px-4 text-sm"
          onClick={() => void api.disconnect()}
        >
          Clear local session
        </button>
      </Card>

      <Card title="Appearance">
        <div className="flex gap-2">
          {(["dark", "light", "system"] as const).map((mode) => (
            <button
              key={mode}
              className={`min-h-11 rounded-xl border px-4 text-sm capitalize ${
                settings.appearance === mode ? "border-accent text-accent" : "border-line"
              }`}
              onClick={() => void save({ appearance: mode })}
            >
              {mode}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Developer (mock provider)">
        <p className="mb-3 text-sm text-muted">Simulate provider states without hitting SRNCloud.</p>
        <div className="flex flex-wrap gap-2">
          {["connected", "disconnected", "session_expired", "server_offline", "network_failure", "security_challenge"].map(
            (s) => (
              <button
                key={s}
                className="min-h-11 rounded-xl border border-line px-3 text-xs"
                onClick={() => void api.scenario(s).then(() => setMsg(`Scenario: ${s}`))}
              >
                {s.replaceAll("_", " ")}
              </button>
            ),
          )}
        </div>
      </Card>
      {msg && <p className="text-sm text-accent">{msg}</p>}
    </div>
  );
}
