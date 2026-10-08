import type { SystemLog } from './types.js';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// Sensitive patterns that must never be logged
const SENSITIVE_KEYS = [
  'password', 'passwd', 'secret', 'token', 'cookie', 'authorization',
  'apiKey', 'api_key', 'sessionToken', 'credentials', 'iv', 'tag',
  'ciphertext', 'sessionSecret', 'encryptionKey',
];

function redactSensitive(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object') return obj;
  if (Buffer.isBuffer(obj)) return '<buffer>';
  if (obj instanceof Date) return obj.toISOString();

  if (Array.isArray(obj)) {
    return obj.map(redactSensitive);
  }

  const record = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some(s => lower.includes(s.toLowerCase()))) {
      out[key] = '<redacted>';
    } else {
      out[key] = redactSensitive(value);
    }
  }
  return out;
}

type LogSink = (entry: SystemLog) => void;

class Logger {
  private sinks: LogSink[] = [];
  private consoleEnabled: boolean = true;

  addSink(sink: LogSink): void {
    this.sinks.push(sink);
  }

  setConsole(enabled: boolean): void {
    this.consoleEnabled = enabled;
  }

  private emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: SystemLog = {
      id: 0,
      level,
      message,
      meta: meta ? JSON.stringify(redactSensitive(meta)) : null,
      timestamp: new Date().toISOString(),
    };

    // Console output
    if (this.consoleEnabled) {
      const ts = entry.timestamp.slice(11, 19);
      const metaStr = entry.meta ? ' ' + entry.meta : '';
      const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
      fn(`${ts}  ${level.padEnd(5)}  ${message}${metaStr}`);
    }

    // DB sinks
    for (const sink of this.sinks) {
      try { sink(entry); } catch { /* never crash on logging */ }
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void { this.emit('DEBUG', message, meta); }
  info(message: string, meta?: Record<string, unknown>): void { this.emit('INFO', message, meta); }
  warn(message: string, meta?: Record<string, unknown>): void { this.emit('WARN', message, meta); }
  error(message: string, meta?: Record<string, unknown>): void { this.emit('ERROR', message, meta); }
}

export const logger = new Logger();
export { redactSensitive };
export type { LogLevel };
