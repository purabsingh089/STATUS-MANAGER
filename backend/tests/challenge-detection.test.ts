import { describe, expect, it } from "vitest";
import { CHALLENGE_INDICATORS, SRNCLOUD_AFK_PATH, SRNCLOUD_DEFAULT_BASE_URL, classifyChallenge } from "../src/providers/srncloud/selectors.js";

describe("challenge indicators", () => {
  it("covers Cloudflare and CAPTCHA pages", () => {
    const haystack = "Just a moment... challenges.cloudflare.com Checking your browser";
    const hit = CHALLENGE_INDICATORS.some((ind) => haystack.toLowerCase().includes(ind.toLowerCase()));
    expect(hit).toBe(true);
  });

  it("does not match ordinary dashboard copy", () => {
    const haystack = "SRNCloud dashboard servers online";
    const hit = CHALLENGE_INDICATORS.some((ind) => haystack.toLowerCase().includes(ind.toLowerCase()));
    expect(hit).toBe(false);
  });

  it("targets the SRNCloud client AFK page", () => {
    expect(SRNCLOUD_DEFAULT_BASE_URL).toBe("https://client.srncloud.in");
    expect(SRNCLOUD_AFK_PATH).toBe("/earn/afk");
  });
});

describe("classifyChallenge", () => {
  it("flags Cloudflare verification pages", () => {
    expect(classifyChallenge("Just a moment while we check your browser")).toBe("cloudflare");
  });

  it("flags ad blocker detection", () => {
    expect(classifyChallenge("Adblock Detected! Please disable your adblocker to continue")).toBe("adblock");
  });

  it("flags VPN/proxy detection", () => {
    expect(classifyChallenge("VPN detected. Disable your VPN or proxy to access this page")).toBe("vpn");
  });

  it("flags alt account detection", () => {
    expect(classifyChallenge("Multiple accounts detected, possible alt account")).toBe("alting");
  });

  it("returns null for normal dashboard pages", () => {
    expect(classifyChallenge("SRNCloud dashboard servers online balance 120 coins")).toBeNull();
  });
});
