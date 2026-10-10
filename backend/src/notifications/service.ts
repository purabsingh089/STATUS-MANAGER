import type Database from "better-sqlite3";
import { EventBus } from "../events/bus.js";
import { nowIso } from "../db/client.js";
import type { Logger } from "../logging/logger.js";
import type { AppSettings } from "../types.js";

export class NotificationService {
  constructor(
    private readonly db: Database.Database,
    private readonly bus: EventBus,
    private readonly logger: Logger,
    private readonly getSettings: () => AppSettings,
  ) {}

  async notify(kind: string, title: string, body: string): Promise<void> {
    const timestamp = nowIso();
    const result = this.db
      .prepare("INSERT INTO notifications (timestamp, title, body, kind, read) VALUES (?, ?, ?, ?, 0)")
      .run(timestamp, title, body, kind);

    const item = {
      id: Number(result.lastInsertRowid),
      timestamp,
      title,
      body,
      kind,
      read: false,
    };
    this.bus.emit("notification.created", item);
    this.logger.info(`Notification: ${title}`, { kind });

    const settings = this.getSettings();
    if (settings.webhookNotifications && settings.webhookUrl) {
      await this.sendWebhook(settings.webhookUrl, title, body).catch((err) => {
        this.logger.warn("Webhook delivery failed", { error: String(err) });
      });
    }
  }

  list(limit = 50) {
    return this.db
      .prepare("SELECT * FROM notifications ORDER BY id DESC LIMIT ?")
      .all(limit)
      .map((row) => this.map(row as Record<string, unknown>));
  }

  markRead(id: number): void {
    this.db.prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(id);
  }

  private map(row: Record<string, unknown>) {
    return {
      id: row.id as number,
      timestamp: row.timestamp as string,
      title: row.title as string,
      body: row.body as string,
      kind: row.kind as string,
      read: Boolean(row.read),
    };
  }

  private async sendWebhook(url: string, title: string, body: string): Promise<void> {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `**${title}**\n${body}` }),
      signal: AbortSignal.timeout(8_000),
    });
  }
}
