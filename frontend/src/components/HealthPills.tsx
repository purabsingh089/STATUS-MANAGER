import type { HealthSnapshot } from "@/lib/types";

const LABELS: Record<keyof HealthSnapshot, string> = {
  browser: "Browser",
  network: "Network",
  srncloud: "SRNCloud",
  authentication: "Auth",
  session: "Session",
  automation: "Automation",
};

const TONE: Record<string, string> = {
  healthy: "border-accent/30 bg-accent/10 text-emerald-200",
  degraded: "border-warn/30 bg-warn/10 text-amber-200",
  down: "border-danger/30 bg-danger/10 text-red-200",
  unknown: "border-line bg-slate-800/60 text-slate-400",
};

const DOT: Record<string, string> = {
  healthy: "bg-accent shadow-[0_0_8px_rgba(34,197,94,0.6)]",
  degraded: "bg-warn",
  down: "bg-danger",
  unknown: "bg-slate-500",
};

export function HealthPills({ health }: { health: HealthSnapshot | null }) {
  if (!health) {
    return <div className="text-sm text-muted">Waiting for health snapshot...</div>;
  }
  return (
    <div className="flex flex-wrap gap-2.5">
      {(Object.keys(LABELS) as (keyof HealthSnapshot)[]).map((k) => {
        const value = health[k];
        return (
          <div
            key={k}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${TONE[value] ?? TONE.unknown}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${DOT[value] ?? DOT.unknown}`} aria-hidden />
            <span className="text-muted">{LABELS[k]}</span>
            <span className="capitalize">{value}</span>
          </div>
        );
      })}
    </div>
  );
}