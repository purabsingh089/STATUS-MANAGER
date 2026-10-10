import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDatabase } from "../src/db/client.js";
import { EventBus } from "../src/events/bus.js";
import { Logger } from "../src/logging/logger.js";

describe("Logger redaction", () => {
  it("never persists password or cookie fields", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "srn-log-"));
    const db = openDatabase(path.join(dir, "t.db"));
    const logger = new Logger(db, new EventBus());
    logger.info("login attempt", { password: "hunter2", cookie: "sid=abc", token: "xyz", username: "demo" });
    const row = db.prepare("SELECT context_json FROM system_logs ORDER BY id DESC LIMIT 1").get() as {
      context_json: string;
    };
    expect(row.context_json).not.toContain("hunter2");
    expect(row.context_json).not.toContain("sid=abc");
    expect(row.context_json).toContain("[redacted]");
    expect(row.context_json).toContain("demo");
    db.close();
  });
});
