"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud } from "lucide-react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [srnPassword, setSrnPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.session().then((s) => {
      setPasswordRequired(s.passwordRequired);
      if (s.authenticated && !s.passwordRequired) {
        /* stay to connect account */
      }
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (passwordRequired) await api.login(password);
      if (username && srnPassword) await api.connect(username, srnPassword);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Cloud className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xl font-semibold">SRNCloud</div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted">AFK Manager</div>
          </div>
        </div>
        <div className="glass rounded-3xl p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Connect Account</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Manage your authorized SRNCloud session from one place. This client does not bypass Cloudflare, CAPTCHA, or
            other protections.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {passwordRequired && (
              <label className="block text-sm">
                <span className="mb-1.5 block text-slate-300">Dashboard password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-line bg-slate-950 px-3 text-sm outline-none ring-accent focus:ring-2"
                  autoComplete="current-password"
                />
              </label>
            )}
            <label className="block text-sm">
              <span className="mb-1.5 block text-slate-300">SRNCloud username / email</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-line bg-slate-950 px-3 text-sm outline-none ring-accent focus:ring-2"
                autoComplete="username"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-slate-300">Password</span>
              <input
                type="password"
                value={srnPassword}
                onChange={(e) => setSrnPassword(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-line bg-slate-950 px-3 text-sm outline-none ring-accent focus:ring-2"
                autoComplete="off"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {busy ? "Connecting…" : "Connect Account"}
            </button>
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-line text-sm text-slate-300"
              onClick={() => router.push("/")}
            >
              Continue without login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
