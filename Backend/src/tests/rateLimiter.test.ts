import { describe, it, expect } from "vitest";
import { smartApiRateLimiter } from "../services/smartapi/rateLimiter.js";

describe("SmartAPI Multi-Tier Rate Limiter Tests", () => {
  it("resolves endpoint configs correctly", () => {
    const loginCfg = smartApiRateLimiter.resolveEndpointConfig("loginByPassword");
    expect(loginCfg.maxPerSec).toBe(1);

    const orderCfg = smartApiRateLimiter.resolveEndpointConfig("placeOrder");
    expect(orderCfg.maxPerSec).toBe(9);
    expect(orderCfg.bucket).toBe("orders_cumulative");
  });

  it("detects SmartAPI rate limit error signatures", () => {
    const error1 = new Error("exceeding access rate limit");
    expect(smartApiRateLimiter.isRateLimit(error1)).toBe(true);

    const error2 = { errorCode: "RATE_LIMIT" };
    expect(smartApiRateLimiter.isRateLimit(error2)).toBe(true);

    const error3 = { httpStatus: 429 };
    expect(smartApiRateLimiter.isRateLimit(error3)).toBe(true);

    const error4 = new Error("Random database timeout");
    expect(smartApiRateLimiter.isRateLimit(error4)).toBe(false);
  });

  it("tracks telemetry metrics accurately", () => {
    const metrics = smartApiRateLimiter.getTelemetry("TEST_CLIENT");
    expect(Array.isArray(metrics)).toBe(true);
    expect(metrics.length).toBeGreaterThan(5);
    const loginMetric = metrics.find((m) => m.key === "loginByPassword");
    expect(loginMetric?.maxPerSec).toBe(1);
  });
});
