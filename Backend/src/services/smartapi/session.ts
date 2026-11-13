// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

import { TOKEN_LIFETIME_MS, REFRESH_THRESHOLD_MS, DEFAULT_SCHEDULER_INTERVAL_MS } from "./constants.js";
import { getStore } from "./store.js";
import { loginSmartAPI, refreshSmartAPISession } from "./api/auth.js";

/**
 * Check whether the stored JWT token is expired or close to expiring.
 */
function isSessionExpired(): boolean {
  const store = getStore();
  if (!store.jwtToken || !store.issuedAt) {
    return true;
  }
  const elapsed = Date.now() - store.issuedAt.getTime();
  return elapsed >= TOKEN_LIFETIME_MS - REFRESH_THRESHOLD_MS;
}

// In-flight mutex promise to prevent parallel login stampedes
let inFlightSessionPromise: Promise<string> | null = null;

/**
 * Return a valid JWT token, automatically logging in or refreshing if needed.
 *
 * Uses an in-flight promise lock so concurrent requests share one single login operation.
 * - If no token exists → calls `loginSmartAPI()`
 * - If token is expired / close to expiry → calls `refreshSmartAPISession()`
 * - Otherwise returns the cached token
 */
export async function getValidSession(): Promise<string> {
  const store = getStore();

  // If token exists and is still valid, return immediately without locking
  if (store.jwtToken && !isSessionExpired()) {
    return store.jwtToken;
  }

  // If an authentication request is already in-flight, await the existing promise
  if (inFlightSessionPromise) {
    return inFlightSessionPromise;
  }

  inFlightSessionPromise = (async () => {
    try {
      const currentStore = getStore();
      if (currentStore.jwtToken && !isSessionExpired()) {
        return currentStore.jwtToken;
      }

      // No token at all → fresh login
      if (!currentStore.jwtToken) {
        console.log("[SmartAPI] No active session found. Performing initial login...");
        const result = await loginSmartAPI();
        return result.jwtToken;
      }

      // Token exists but expired / near expiry → refresh
      if (isSessionExpired()) {
        if (currentStore.refreshToken) {
          try {
            console.log("[SmartAPI] Session expired or near expiry. Refreshing tokens...");
            const result = await refreshSmartAPISession(currentStore.refreshToken, currentStore.jwtToken);
            return result.jwtToken;
          } catch (err: any) {
            console.warn(
              `[SmartAPI] Token refresh failed (${err?.message || "expired"}), auto-renewing session via full TOTP login...`
            );
            const result = await loginSmartAPI();
            return result.jwtToken;
          }
        } else {
          console.log("[SmartAPI] No refresh token found. Logging in via TOTP...");
          const result = await loginSmartAPI();
          return result.jwtToken;
        }
      }

      return currentStore.jwtToken;
    } finally {
      inFlightSessionPromise = null;
    }
  })();

  return inFlightSessionPromise;
}

/**
 * Start a periodic refresh loop that keeps the session alive.
 * Call this once during server startup.
 *
 * @param intervalMs How often to check & refresh (default: every 30 minutes)
 * @returns A NodeJS.Timeout handle (call clearInterval() to stop)
 */
export function startSessionScheduler(
  intervalMs: number = DEFAULT_SCHEDULER_INTERVAL_MS
): ReturnType<typeof setInterval> {
  console.log(
    `[SmartAPI] Starting session scheduler (interval: ${intervalMs / 60_000} min)`
  );

  // Run immediately on startup
  getValidSession().catch((err) =>
    console.warn("[SmartAPI] Initial session acquisition notice:", err.message)
  );

  // Then repeat on the given interval
  const handle = setInterval(async () => {
    try {
      await getValidSession();
    } catch (err) {
      console.error(
        "[SmartAPI] Scheduled session refresh failed:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }, intervalMs);

  return handle;
}
