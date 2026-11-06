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

/**
 * Return a valid JWT token, automatically logging in or refreshing if needed.
 *
 * - If no token exists → calls `loginSmartAPI()`
 * - If token is expired / close to expiry → calls `refreshSmartAPISession()`
 * - Otherwise returns the cached token
 */
export async function getValidSession(): Promise<string> {
  const store = getStore();

  // No token at all → fresh login
  if (!store.jwtToken) {
    const result = await loginSmartAPI();
    return result.jwtToken;
  }

  // Token exists but expired / near expiry → refresh
  if (isSessionExpired()) {
    if (store.refreshToken) {
      try {
        const result = await refreshSmartAPISession(store.refreshToken, store.jwtToken);
        return result.jwtToken;
      } catch (err: any) {
        // Refresh token expired or rejected → fallback to seamless auto-login with TOTP
        console.warn(
          `[SmartAPI] Token refresh failed (${err?.message || "expired"}), auto-renewing session via full TOTP login...`
        );
        const result = await loginSmartAPI();
        return result.jwtToken;
      }
    } else {
      // No refresh token available → full login
      const result = await loginSmartAPI();
      return result.jwtToken;
    }
  }

  // Token is still valid
  return store.jwtToken;
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
    console.error("[SmartAPI] Initial session acquisition failed:", err.message)
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