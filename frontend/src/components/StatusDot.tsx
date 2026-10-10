import type { HealthStatus } from "@/lib/types";

const MAP: Record<string, { color: string; glow: string; label: string }> = {
  healthy: { color: "bg-accent", glow: "shadow-[0_0_10px_rgba(34,197,94,0.6)]", label: "Healthy" },
  running: { color: "bg-accent", glow: "shadow-[0_0_10px_rgba(34,197,94,0.6)]", label: "Running" },
  degraded: { color: "bg-warn", glow: "shadow-[0_0_10px_rgba(245,158,11,0.55)]", label: "Attention" },
  down: { color: "bg-danger", glow: "shadow-[0_0_10px_rgba(239,68,68,0.55)]", label: "Down" },
  unknown: { color: "bg-slate-500", glow: "", label: "Unknown" },
  online: { color: "bg-accent", glow: "shadow-[0_0_10px_rgba(34,197,94,0.6)]", label: "Online" },
  offline: { color: "bg-danger", glow: "shadow-[0_0_10px_rgba(239,68,68,0.55)]", label: "Offline" },
};

export function StatusDot({
  status,
  label,
  pulse = false,
}: {
  status: HealthStatus | string;
  label?: string;
  pulse?: boolean;
}) {
  const key = status.toLowerCase();
  const m = MAP[key] ?? MAP.unknown!;
  const live = pulse && (key === "healthy" || key === "running" || key === "online");
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="relative inline-flex h-2.5 w-2.5 items-center justify-center" aria-hidden>
        {live && <span className={`absolute inline-flex h-2.5 w-2.5 rounded-full ${m.color} animate-pulse-ring`} />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${m.color} ${m.glow}`} />
      </span>
      <span className="text-slate-200">{label ?? m.label}</span>
    </span>
  );
}

export function statusColor(status: string): string {
  const key = status.toLowerCase();
  if (key === "healthy" || key === "running" || key === "online") return "text-accent";
  if (key === "degraded") return "text-warn";
  if (key === "down" || key === "offline") return "text-danger";
  return "text-slate-400";
}