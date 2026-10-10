"use client";

import Link from "next/link";
import { ShieldAlert, ArrowRight } from "lucide-react";
import type { AutomationSnapshot } from "@/lib/types";

export function ChallengeBanner({ automation }: { automation: AutomationSnapshot | null }) {
  if (automation?.state !== "CHALLENGE_REQUIRED") return null;

  const detail =
    automation.reason ??
    "SRNCloud is requesting verification. Complete it in the browser. Automation is paused and will not attempt to solve the challenge.";

  return (
    <div
      role="alert"
      className="animate-fade-up mb-5 flex flex-col gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div>
          <div className="font-medium text-amber-100">Manual verification required</div>
          <p className="mt-1 text-sm leading-6 text-amber-100/80">{detail}</p>
        </div>
      </div>
      <Link
        href="/automation"
        className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
      >
        Open AFK Manager
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}