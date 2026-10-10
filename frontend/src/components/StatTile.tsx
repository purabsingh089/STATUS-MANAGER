import type { ReactNode } from "react";

const TONE = {
  default: "text-slate-50",
  accent: "text-accent",
  warn: "text-warn",
  danger: "text-danger",
  info: "text-info",
  muted: "text-slate-400",
} as const;

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof TONE;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-line/80 bg-slate-900/40 p-4 transition-colors duration-200 hover:border-slate-600">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{label}</div>
        {icon ? <div className="text-slate-500 transition-colors group-hover:text-slate-300">{icon}</div> : null}
      </div>
      <div className={`mt-2 truncate font-mono text-2xl tabular ${TONE[tone]}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}