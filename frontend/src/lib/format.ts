export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms) || ms < 0) return "—";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatAgo(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 5_000) return "just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return new Date(iso).toLocaleString();
}

export function formatBytesMb(used: number | null, total: number | null): string {
  if (used == null || total == null) return "Unavailable";
  return `${(used / 1024).toFixed(1)} / ${(total / 1024).toFixed(0)} GB`;
}

export function metric(value: number | string | null | undefined, suffix = ""): string {
  if (value == null || value === "") return "Unavailable";
  return `${value}${suffix}`;
}
