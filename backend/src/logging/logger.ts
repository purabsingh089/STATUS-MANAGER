import type Database from "better-sqlite3";
import { EventBus } from "../events/bus.js";
import type { LogLevel } from "../types.js";
import { nowIso } from "../db/client.js";

const SENSITIVE = /password|cookie|token|authorization|api[-_]?key|secret|credential|session/i;

function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? "[redacted]" : sanitize(v);
    }
    return out;
  }
  return obj;
}

export class Logger {
  constructor(
    private readonly db: Database.Database,
    private readonly bus: EventBus,
  ) {}

  debug(message: string, context?: Record<string, unknown>): void {
    this.write("DEBUG", message, context);
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.write("INFO", message, context);
  }
  warn(message: string, context?: Record<string, unknown>): void {
    this.write("WARN", message, context);
  }
  error(message: string, context?: Record<string, unknown>): void {
    this.write("ERROR", message, context);
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const timestamp = nowIso();
    const safe = context ? (sanitize(context) as Record<string, unknown>) : null;
    const result = this.db
      .prepare("INSERT INTO system_logs (timestamp, level, message, context_json) VALUES (?, ?, ?, ?)")
      .run(timestamp, level, message, safe ? JSON.stringify(safe) : null);

    this.bus.emit("log.created", {
      id: Number(result.lastInsertRowid),
      timestamp,
      level,
      message,
      context: safe,
    });
  }

  query(opts: { level?: LogLevel; limit?: number; offset?: number }) {
    const limit = Math.min(opts.limit ?? 200, 500);
    const offset = opts.offset ?? 0;
    if (opts.level) {
      return this.db
        .prepare("SELECT * FROM system_logs WHERE level = ? ORDER BY id DESC LIMIT ? OFFSET ?")
        .all(opts.level, limit, offset);
    }
    return this.db.prepare("SELECT * FROM system_logs ORDER BY id DESC LIMIT ? OFFSET ?").all(limit, offset);
  }
}
