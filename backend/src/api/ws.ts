import type { FastifyInstance } from "fastify";
import type { EventBus } from "../events/bus.js";
import type { WsEvent } from "../types.js";

export function registerWebsocket(app: FastifyInstance, bus: EventBus): void {
  app.get("/api/ws", { websocket: true }, (socket) => {
    const send = (event: WsEvent) => {
      try {
        socket.send(JSON.stringify(event));
      } catch {
        /* closed */
      }
    };
    const off = bus.onAll(send);
    socket.send(JSON.stringify({ event: "session.status", payload: { connected: true }, at: new Date().toISOString() }));
    socket.on("close", () => off());
  });
}
