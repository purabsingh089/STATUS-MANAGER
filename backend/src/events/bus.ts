import { EventEmitter } from "node:events";
import type { WsEvent, WsEventName } from "../types.js";

export class EventBus {
  private readonly ee = new EventEmitter();

  constructor() {
    this.ee.setMaxListeners(50);
  }

  emit<T>(event: WsEventName, payload: T): void {
    const envelope: WsEvent<T> = { event, payload, at: new Date().toISOString() };
    this.ee.emit(event, envelope);
    this.ee.emit("*", envelope);
  }

  onAll(listener: (event: WsEvent) => void): () => void {
    this.ee.on("*", listener);
    return () => this.ee.off("*", listener);
  }

  on<T>(event: WsEventName, listener: (event: WsEvent<T>) => void): () => void {
    this.ee.on(event, listener);
    return () => this.ee.off(event, listener);
  }
}
