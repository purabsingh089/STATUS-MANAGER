import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "./config.js";
import { loadSettings, openDatabase } from "./db/client.js";
import { EventBus } from "./events/bus.js";
import { Logger } from "./logging/logger.js";
import { NotificationService } from "./notifications/service.js";
import { BrowserController } from "./browser/controller.js";
import { MockHostingProvider } from "./providers/mock.js";
import { SRNCloudAdapter } from "./providers/srncloud/adapter.js";
import { AutomationEngine } from "./automation/engine.js";
import { registerRoutes } from "./api/routes.js";
import { registerWebsocket } from "./api/ws.js";
import { authGuard, registerDashboardAuth } from "./auth/dashboard.js";
import type { HostingProviderAdapter } from "./providers/types.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDatabase(config.DATABASE_PATH);
  const bus = new EventBus();
  const logger = new Logger(db, bus);
  const getSettings = () => loadSettings(db);
  const notifications = new NotificationService(db, bus, logger, getSettings);

  const browser = new BrowserController(
    {
      userDataDir: config.BROWSER_USER_DATA_DIR,
      headless: config.playwrightHeadless,
      enabled: config.playwrightEnabled,
      executablePath: config.PLAYWRIGHT_EXECUTABLE_PATH,
    },
    logger,
  );

  let mock: MockHostingProvider | undefined;
  let provider: HostingProviderAdapter;
  if (config.PROVIDER === "mock") {
    mock = new MockHostingProvider();
    provider = mock;
    logger.info("Using mock hosting provider");
  } else {
    provider = new SRNCloudAdapter(browser, config.SRNCLOUD_BASE_URL);
    logger.info("Using SRNCloud adapter (browser session). No public API verified.");
  }

  const engine = new AutomationEngine(
    db,
    bus,
    logger,
    notifications,
    provider,
    browser,
    config,
    getSettings,
    config.encryptionKey,
  );

  const app = Fastify({ logger: false });
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });
  await app.register(cors, {
    origin: config.FRONTEND_ORIGIN,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app.register(websocket);
  registerDashboardAuth(app, db, config);
  app.addHook("preHandler", authGuard(db, config));
  registerRoutes(app, { db, engine, logger, notifications, mock });
  registerWebsocket(app, bus);

  const frontendDist = path.resolve(process.cwd(), "../frontend/out");
  if (existsSync(frontendDist)) {
    await app.register(fastifyStatic, { root: frontendDist, prefix: "/" });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api")) return reply.code(404).send({ error: "Not found" });
      return reply.sendFile("index.html");
    });
  }

  const settings = getSettings();
  if (settings.autoStart || config.autoStart) {
    logger.info("Auto-start enabled");
    void engine.start();
  }

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  logger.info(`SRNCloud AFK Manager API listening on :${config.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
