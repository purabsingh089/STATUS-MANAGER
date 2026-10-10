import { describe, expect, it } from "vitest";
import { MockHostingProvider } from "../src/providers/mock.js";

describe("MockHostingProvider", () => {
  it("starts disconnected", async () => {
    const p = new MockHostingProvider();
    expect(await p.isAuthenticated()).toBe(false);
  });

  it("logs in and exposes servers", async () => {
    const p = new MockHostingProvider();
    await p.login({ username: "demo", password: "pass" });
    expect(await p.isAuthenticated()).toBe(true);
    const servers = await p.getServers();
    expect(servers.length).toBe(2);
    expect(servers[0]?.cpuPercent).toBe(18);
    const rewards = await p.getRewards();
    expect(rewards.coins).toBe(12450);
  });

  it("detects security challenges without solving them", async () => {
    const p = new MockHostingProvider();
    p.setScenario("security_challenge");
    const c = await p.detectChallenge();
    expect(c.detected).toBe(true);
    expect(c.kind).toBe("cloudflare");
  });

  it("simulates session expiry", async () => {
    const p = new MockHostingProvider();
    await p.login({ username: "demo", password: "pass" });
    p.setScenario("session_expired");
    expect(await p.isAuthenticated()).toBe(false);
    expect(await p.detectLogout()).toBe(true);
  });

  it("throws on network failure", async () => {
    const p = new MockHostingProvider();
    p.setScenario("network_failure");
    await expect(p.getServers()).rejects.toThrow("NETWORK_UNAVAILABLE");
  });
});
