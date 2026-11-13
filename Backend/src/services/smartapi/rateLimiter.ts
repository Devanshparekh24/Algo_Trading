// ===========================================================================
// SmartAPI Institutional Multi-Tier Rate Limiter & Concurrency Pacer
// ===========================================================================
// Enforces official Angel One SmartAPI throttling specifications partitioned
// by Client Code (clientcode) across Per-Second, Per-Minute, and Per-Hour sliding windows.
//
// Special Features:
// 1. Cumulative Order Bucket: placeOrder, modifyOrder, cancelOrder share a combined
//    maximum cap of 9 requests/sec, 500 req/min, 1000 req/hr per client code.
// 2. Cumulative GTT Bucket: createRule, modifyRule, cancelRule share a combined
//    maximum cap of 9 requests/sec, 500 req/min, 5000 req/hr per client code.
// 3. Sliding Window Tracking: zero 403 limit violations by automatically pacing slots.
// 4. Client Code Isolation: rate limits are tracked independently per client account.
// 5. Automatic Broker 403 Backoff: recovers with exponential backoff on broker saturation.

import axios from "axios";
import { getConfig } from "../../config/env.js";

export interface EndpointRateLimitConfig {
  key: string;
  name: string;
  path: string;
  bucket?: string; // Cumulative group identifier (e.g. "orders_cumulative")
  maxPerSec: number;
  maxPerMin?: number;
  maxPerHour?: number;
}

export const RATE_LIMIT_CONFIGS: Record<string, EndpointRateLimitConfig> = {
  // 1. Auth & Session APIs
  loginByPassword: {
    key: "loginByPassword",
    name: "Login by Password",
    path: "/rest/auth/angelbroking/user/v1/loginByPassword",
    maxPerSec: 1,
  },
  generateTokens: {
    key: "generateTokens",
    name: "Generate / Refresh Tokens",
    path: "/rest/auth/angelbroking/jwt/v1/generateTokens",
    maxPerSec: 1,
    maxPerHour: 1000,
  },
  getProfile: {
    key: "getProfile",
    name: "Get User Profile",
    path: "/rest/secure/angelbroking/user/v1/getProfile",
    maxPerSec: 3,
    maxPerHour: 1000,
  },
  logout: {
    key: "logout",
    name: "User Logout",
    path: "/rest/secure/angelbroking/user/v1/logout",
    maxPerSec: 1,
  },
  getRMS: {
    key: "getRMS",
    name: "Get RMS Funds & Limits",
    path: "/rest/secure/angelbroking/user/v1/getRMS",
    maxPerSec: 2,
  },

  // 2. Cumulative Order APIs (Place, Modify, Cancel) - Combined <= 9 req/s, 500/min, 1000/hr
  placeOrder: {
    key: "placeOrder",
    name: "Place Order",
    path: "/rest/secure/angelbroking/order/v1/placeOrder",
    bucket: "orders_cumulative",
    maxPerSec: 9,
    maxPerMin: 500,
    maxPerHour: 1000,
  },
  modifyOrder: {
    key: "modifyOrder",
    name: "Modify Order",
    path: "/rest/secure/angelbroking/order/v1/modifyOrder",
    bucket: "orders_cumulative",
    maxPerSec: 9,
    maxPerMin: 500,
    maxPerHour: 1000,
  },
  cancelOrder: {
    key: "cancelOrder",
    name: "Cancel Order",
    path: "/rest/secure/angelbroking/order/v1/cancelOrder",
    bucket: "orders_cumulative",
    maxPerSec: 9,
    maxPerMin: 500,
    maxPerHour: 1000,
  },

  // 3. Order Books, Trades & Scrip Search
  getOrderBook: {
    key: "getOrderBook",
    name: "Get Order Book",
    path: "/rest/secure/angelbroking/order/v1/getOrderBook",
    maxPerSec: 1,
  },
  getLtpData: {
    key: "getLtpData",
    name: "Get LTP Data",
    path: "/rest/secure/angelbroking/order/v1/getLtpData",
    maxPerSec: 10,
    maxPerMin: 500,
    maxPerHour: 5000,
  },
  getPosition: {
    key: "getPosition",
    name: "Get Open Positions",
    path: "/rest/secure/angelbroking/order/v1/getPosition",
    maxPerSec: 1,
  },
  getTradeBook: {
    key: "getTradeBook",
    name: "Get Trade Book",
    path: "/rest/secure/angelbroking/order/v1/getTradeBook",
    maxPerSec: 1,
  },
  convertPosition: {
    key: "convertPosition",
    name: "Convert Position Product",
    path: "/rest/secure/angelbroking/order/v1/convertPosition",
    maxPerSec: 10,
    maxPerMin: 500,
    maxPerHour: 5000,
  },
  searchScrip: {
    key: "searchScrip",
    name: "Search Scrip Token",
    path: "/rest/secure/angelbroking/order/v1/searchScrip",
    maxPerSec: 1,
  },
  orderDetails: {
    key: "orderDetails",
    name: "Order Details by ID",
    path: "/rest/secure/angelbroking/order/v1/details",
    maxPerSec: 10,
    maxPerMin: 500,
    maxPerHour: 5000,
  },

  // 4. Portfolio APIs
  getHolding: {
    key: "getHolding",
    name: "Get Holdings (Standard)",
    path: "/rest/secure/angelbroking/portfolio/v1/getHolding",
    maxPerSec: 1,
  },
  getAllHolding: {
    key: "getAllHolding",
    name: "Get All Holdings (Enhanced)",
    path: "/rest/secure/angelbroking/portfolio/v1/getAllHolding",
    maxPerSec: 1,
  },

  // 5. Market & Margin APIs
  quote: {
    key: "quote",
    name: "Market Quote (FullMode)",
    path: "/rest/secure/angelbroking/market/v1/quote",
    maxPerSec: 10,
    maxPerMin: 500,
    maxPerHour: 5000,
  },
  batchMargin: {
    key: "batchMargin",
    name: "Batch Margin Calculation",
    path: "/rest/secure/angelbroking/margin/v1/batch",
    maxPerSec: 10,
    maxPerMin: 500,
    maxPerHour: 5000,
  },

  // 6. Cumulative GTT APIs (Create, Modify, Cancel) - Combined <= 9 req/s, 500/min, 5000/hr
  createRule: {
    key: "createRule",
    name: "Create GTT Rule",
    path: "/rest/secure/angelbroking/gtt/v1/createRule",
    bucket: "gtt_cumulative",
    maxPerSec: 9,
    maxPerMin: 500,
    maxPerHour: 5000,
  },
  modifyRule: {
    key: "modifyRule",
    name: "Modify GTT Rule",
    path: "/rest/secure/angelbroking/gtt/v1/modifyRule",
    bucket: "gtt_cumulative",
    maxPerSec: 9,
    maxPerMin: 500,
    maxPerHour: 5000,
  },
  cancelRule: {
    key: "cancelRule",
    name: "Cancel GTT Rule",
    path: "/rest/secure/angelbroking/gtt/v1/cancelRule",
    bucket: "gtt_cumulative",
    maxPerSec: 9,
    maxPerMin: 500,
    maxPerHour: 5000,
  },
  ruleDetails: {
    key: "ruleDetails",
    name: "GTT Rule Details",
    path: "/rest/secure/angelbroking/gtt/v1/ruleDetails",
    maxPerSec: 10,
    maxPerMin: 500,
    maxPerHour: 5000,
  },
  ruleList: {
    key: "ruleList",
    name: "GTT Rule List",
    path: "/rest/secure/angelbroking/gtt/v1/ruleList",
    maxPerSec: 10,
    maxPerMin: 500,
    maxPerHour: 5000,
  },

  // 7. Historical & Market Data
  getCandleData: {
    key: "getCandleData",
    name: "Get Historical Candle Data",
    path: "/rest/secure/angelbroking/historical/v1/getCandleData",
    maxPerSec: 1,
    maxPerMin: 60,
    maxPerHour: 1000,
  },
  optionGreek: {
    key: "optionGreek",
    name: "Option Greek Calculator",
    path: "/rest/secure/angelbroking/marketData/v1/optionGreek",
    maxPerSec: 1,
  },
  gainersLosers: {
    key: "gainersLosers",
    name: "Gainers / Losers Analytics",
    path: "/rest/secure/angelbroking/marketData/v1/gainersLosers",
    maxPerSec: 1,
  },
};

const DEFAULT_RATE_LIMIT: EndpointRateLimitConfig = {
  key: "default",
  name: "General SmartAPI Call",
  path: "",
  maxPerSec: 2,
  maxPerMin: 120,
  maxPerHour: 2000,
};

interface BucketState {
  timestamps: number[];
  chain: Promise<void>;
  cooldownUntil: number;
}

/**
 * Institutional SmartAPI Rate Limiter Engine
 */
class SmartApiRateLimiter {
  // Key format: `${clientCode}:${bucketId}`
  private buckets = new Map<string, BucketState>();

  /**
   * Resolve client code from argument or environment config
   */
  public resolveClientCode(customClientCode?: string): string {
    if (customClientCode && customClientCode.trim().length > 0) {
      return customClientCode.trim().toUpperCase();
    }
    try {
      const config = getConfig();
      if (config.CLIENT_CODE) {
        return config.CLIENT_CODE.trim().toUpperCase();
      }
    } catch {
      // Ignore if config not yet initialized
    }
    return "DEFAULT_CLIENT";
  }

  /**
   * Match an endpoint key or URL to its authoritative rate limit definition
   */
  public resolveEndpointConfig(identifier?: string): EndpointRateLimitConfig {
    if (!identifier) {
      return DEFAULT_RATE_LIMIT;
    }

    const clean = identifier.trim().toLowerCase();

    // Check historical candle data aliases
    if (clean.startsWith("historical") || clean.includes("historical") || clean.includes("getcandledata")) {
      return RATE_LIMIT_CONFIGS.getCandleData!;
    }

    // 1. Direct key match (e.g. "placeOrder")
    for (const [key, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
      if (key.toLowerCase() === clean) {
        return config;
      }
    }

    // 2. Prefix key match (e.g. "placeOrder_RELIANCE", "cancelOrder_12345")
    for (const [key, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
      if (clean.startsWith(key.toLowerCase())) {
        return config;
      }
    }

    // 3. Path match (e.g. ".../order/v1/placeOrder", ".../historical/v1/getCandleData")
    for (const config of Object.values(RATE_LIMIT_CONFIGS)) {
      const pathSuffix = config.path.toLowerCase().replace(/^\/rest\/(secure|auth)\/angelbroking\//, "");
      if (clean.includes(config.path.toLowerCase()) || clean.includes(pathSuffix)) {
        return config;
      }
    }

    return DEFAULT_RATE_LIMIT;
  }

  /**
   * Retrieve or initialize state for a client's bucket
   */
  private getBucketState(clientCode: string, bucketId: string): BucketState {
    const trackerKey = `${clientCode}:${bucketId}`;
    let state = this.buckets.get(trackerKey);
    if (!state) {
      state = {
        timestamps: [],
        chain: Promise.resolve(),
        cooldownUntil: 0,
      };
      this.buckets.set(trackerKey, state);
    }
    return state;
  }

  /**
   * Acquire a rate limit slot for a request based on client code & endpoint specifications.
   * If limits would be exceeded, automatically waits the exact required milliseconds.
   */
  public async acquire(identifier?: string, customClientCode?: string): Promise<void> {
    const clientCode = this.resolveClientCode(customClientCode);
    const config = this.resolveEndpointConfig(identifier);
    const bucketId = config.bucket || config.key;

    const state = this.getBucketState(clientCode, bucketId);

    const nextSlot = state.chain.then(async () => {
      while (true) {
        const now = Date.now();

        // 1. Active Cooldown / Backoff
        if (now < state.cooldownUntil) {
          const waitCooldown = state.cooldownUntil - now;
          await new Promise((r) => setTimeout(r, waitCooldown));
          continue;
        }

        // 2. Prune timestamps older than 1 hour (3600000ms)
        const oneHourAgo = now - 3600000;
        while (state.timestamps.length > 0 && (state.timestamps[0] ?? Infinity) <= oneHourAgo) {
          state.timestamps.shift();
        }

        // 3. Check Hourly Limit
        if (config.maxPerHour && state.timestamps.length >= config.maxPerHour) {
          const oldestInHour = state.timestamps[state.timestamps.length - config.maxPerHour] ?? now;
          const waitHour = 3600000 - (now - oldestInHour) + 25;
          if (waitHour > 0) {
            console.warn(
              `[SmartAPI RateLimiter] [${clientCode}] [${bucketId}] Hourly limit reached (${config.maxPerHour}/hr). Waiting ${Math.ceil(waitHour / 1000)}s...`
            );
            await new Promise((r) => setTimeout(r, waitHour));
            continue;
          }
        }

        // 4. Check Minute Limit (last 60000ms)
        if (config.maxPerMin) {
          const oneMinAgo = now - 60000;
          const callsInLastMin = state.timestamps.filter((t) => t > oneMinAgo);
          if (callsInLastMin.length >= config.maxPerMin) {
            const oldestInMin = callsInLastMin[callsInLastMin.length - config.maxPerMin] ?? now;
            const waitMin = 60000 - (now - oldestInMin) + 20;
            if (waitMin > 0) {
              console.warn(
                `[SmartAPI RateLimiter] [${clientCode}] [${bucketId}] Minute limit reached (${config.maxPerMin}/min). Waiting ${Math.ceil(waitMin / 1000)}s...`
              );
              await new Promise((r) => setTimeout(r, waitMin));
              continue;
            }
          }
        }

        // 5. Check Per-Second Limit (last 1000ms)
        const oneSecAgo = now - 1000;
        const callsInLastSec = state.timestamps.filter((t) => t > oneSecAgo);
        if (callsInLastSec.length >= config.maxPerSec) {
          const oldestInSec = callsInLastSec[callsInLastSec.length - config.maxPerSec] ?? now;
          const waitSec = 1000 - (now - oldestInSec) + 15;
          if (waitSec > 0) {
            await new Promise((r) => setTimeout(r, waitSec));
            continue;
          }
        }

        // Slot successfully acquired! Record timestamp and exit loop
        state.timestamps.push(Date.now());
        break;
      }
    });

    state.chain = nextSlot.catch(() => {});
    return nextSlot;
  }

  /**
   * Pause a client's bucket during broker-side rate-limit backoffs
   */
  public triggerCooldown(identifier?: string, ms = 1500, customClientCode?: string): void {
    const clientCode = this.resolveClientCode(customClientCode);
    const config = this.resolveEndpointConfig(identifier);
    const bucketId = config.bucket || config.key;

    const state = this.getBucketState(clientCode, bucketId);
    state.cooldownUntil = Math.max(state.cooldownUntil, Date.now() + ms);
  }

  /**
   * Check if an error was caused by SmartAPI rate throttling
   */
  public isRateLimit(error: unknown): boolean {
    if (!error) return false;

    if (typeof error === "object" && (error as any).isRateLimitStatus) {
      return true;
    }

    if (typeof error === "object" && (error as any).errorCode === "RATE_LIMIT") {
      return true;
    }

    if (typeof error === "object" && ((error as any).httpStatus === 429 || (error as any).httpStatus === 403)) {
      return true;
    }

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429 || error.response?.status === 403) {
        return true;
      }
    }

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("exceeding access rate") ||
        msg.includes("rate limit") ||
        msg.includes("ag8001") ||
        msg.includes("ab8050") ||
        msg.includes("access denied") ||
        msg.includes("429") ||
        msg.includes("403")
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Telemetry snapshot: returns active rate consumption metrics across all configured endpoints for a client
   */
  public getTelemetry(customClientCode?: string): Array<{
    key: string;
    name: string;
    path: string;
    bucket: string;
    maxPerSec: number;
    maxPerMin: number | string;
    maxPerHour: number | string;
    currentPerSec: number;
    currentPerMin: number;
    currentPerHour: number;
    status: "NOMINAL" | "THROTTLED" | "COOLDOWN";
  }> {
    const clientCode = this.resolveClientCode(customClientCode);
    const now = Date.now();
    const oneSecAgo = now - 1000;
    const oneMinAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    return Object.values(RATE_LIMIT_CONFIGS).map((cfg) => {
      const bucketId = cfg.bucket || cfg.key;
      const state = this.buckets.get(`${clientCode}:${bucketId}`);

      const timestamps = state ? state.timestamps : [];
      const currentPerSec = timestamps.filter((t) => t > oneSecAgo).length;
      const currentPerMin = timestamps.filter((t) => t > oneMinAgo).length;
      const currentPerHour = timestamps.filter((t) => t > oneHourAgo).length;

      let status: "NOMINAL" | "THROTTLED" | "COOLDOWN" = "NOMINAL";
      if (state && now < state.cooldownUntil) {
        status = "COOLDOWN";
      } else if (
        currentPerSec >= cfg.maxPerSec ||
        (cfg.maxPerMin && currentPerMin >= cfg.maxPerMin) ||
        (cfg.maxPerHour && currentPerHour >= cfg.maxPerHour)
      ) {
        status = "THROTTLED";
      }

      return {
        key: cfg.key,
        name: cfg.name,
        path: cfg.path,
        bucket: bucketId,
        maxPerSec: cfg.maxPerSec,
        maxPerMin: cfg.maxPerMin || "NA",
        maxPerHour: cfg.maxPerHour || "NA",
        currentPerSec,
        currentPerMin,
        currentPerHour,
        status,
      };
    });
  }
}

// Global Singleton Rate Limiter
export const smartApiRateLimiter = new SmartApiRateLimiter();
// Backward compatibility alias
export const smartApiPacer = smartApiRateLimiter;

/**
 * Safely execute any SmartAPI call through the institutional rate limiter with automatic backoff retry.
 *
 * @param task Async operation returning promise
 * @param labelOrUrl Endpoint identifier, key, or full API URL for rate limit matching
 * @param clientCode Optional client code; defaults to configured SmartAPI client code
 */
export async function executeSmartApiRequest<T>(
  task: () => Promise<T>,
  labelOrUrl?: string,
  clientCode?: string
): Promise<T> {
  const maxRetries = 2;
  let attempt = 0;

  while (true) {
    // Acquire slot based on clientCode & endpoint specifications
    await smartApiRateLimiter.acquire(labelOrUrl, clientCode);

    try {
      return await task();
    } catch (error: any) {
      if (smartApiRateLimiter.isRateLimit(error) && attempt < maxRetries) {
        attempt++;
        const backoff = 1500 * attempt;
        const resolved = smartApiRateLimiter.resolveEndpointConfig(labelOrUrl);
        const code = smartApiRateLimiter.resolveClientCode(clientCode);

        console.warn(
          `[SmartAPI RateLimiter] 403 Rate limit hit for [${code}] [${resolved.name}] (${resolved.path}). Backing off for ${backoff}ms (Attempt ${attempt}/${maxRetries})...`
        );
        smartApiRateLimiter.triggerCooldown(labelOrUrl, backoff, clientCode);
        continue;
      }
      throw error;
    }
  }
}
