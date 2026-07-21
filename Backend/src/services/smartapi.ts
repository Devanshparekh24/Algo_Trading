import axios, { AxiosError } from "axios";
import speakeasy from "speakeasy";
import { getConfig } from "../config/env.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoginResponse {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
  /** Human-readable message from the API */
  message?: string;
}

export interface UserProfile {
  clientcode: string;
  name: string;
  email: string;
  mobileno: string;
  exg: string[];
  lastaccesstime: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// In-memory token store
// ---------------------------------------------------------------------------

interface TokenStore {
  jwtToken: string | null;
  refreshToken: string | null;
  feedToken: string | null;
  issuedAt: Date | null;
}

const store: TokenStore = {
  jwtToken: null,
  refreshToken: null,
  feedToken: null,
  issuedAt: null,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "https://apiconnect.angelone.in";
const TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000; // 2 hours
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refresh if < 5 min remaining

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a TOTP (6-digit code) from a base32-encoded secret.
 */
function generateTOTP(secret: string): string {
  const token = speakeasy.totp({
    secret,
    encoding: "base32",
  });
  if (!token) {
    throw new Error("Failed to generate TOTP – check your TOTP_SECRET");
  }
  return token;
}

/**
 * Build the common headers required by every SmartAPI call.
 */
function buildHeaders(apiKey: string, jwtToken?: string): Record<string, string> {
  const config = getConfig();
  const headers: Record<string, string> = {
    "X-PrivateKey": apiKey,
    "X-ClientLocalIP": config.STATIC_IP,
    "X-ClientPublicIP": config.STATIC_IP,
    "X-MACAddress": config.MAC_ADDRESS,
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (jwtToken) {
    headers["Authorization"] = `Bearer ${jwtToken}`;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Core API functions
// ---------------------------------------------------------------------------

/**
 * Log in to Angel One SmartAPI using client code, password, and TOTP.
 *
 * On success the tokens are stored in memory and the response is returned.
 */
export async function loginSmartAPI(): Promise<LoginResponse> {
  const config = getConfig();
  const totp = generateTOTP(config.TOTP_SECRET);

  const url = `${BASE_URL}/rest/auth/angelbroking/user/v1/loginByPassword`;
  const headers = buildHeaders(config.API_KEY);
  const body = {
    clientcode: config.CLIENT_CODE,
    password: config.PASSWORD,
    totp,
  };

  console.log("[SmartAPI] Attempting login...");

  try {
    const response = await axios.post<{
      status: boolean;
      message: string;
      errorcode?: string;
      data?: {
        jwtToken: string;
        refreshToken: string;
        feedToken: string;
      };
    }>(url, body, { headers });

    const { status, message, data, errorcode } = response.data;

    if (!status || !data) {
      const errMsg = errorcode
        ? `[${errorcode}] ${message}`
        : message || "Login failed with no error message";
      throw new Error(errMsg);
    }

    // Store tokens in memory
    store.jwtToken = data.jwtToken;
    store.refreshToken = data.refreshToken;
    store.feedToken = data.feedToken;
    store.issuedAt = new Date();

    console.log("[SmartAPI] Login successful. Tokens stored in memory.");

    return {
      jwtToken: data.jwtToken,
      refreshToken: data.refreshToken,
      feedToken: data.feedToken,
      message,
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const body = error.response?.data;

      if (status === 401) {
        const errMsg =
          body?.message || "Unauthorized – check credentials, TOTP, or IP whitelist";
        console.error(`[SmartAPI] Login failed (401): ${errMsg}`);
        throw new Error(`Login failed: ${errMsg}`);
      }

      if (error.code === "ECONNABORTED" || error.code === "ERR_NETWORK") {
        console.error("[SmartAPI] Network error during login:", error.message);
        throw new Error(`Network error: ${error.message}`);
      }

      console.error(
        `[SmartAPI] Login failed (HTTP ${status}):`,
        JSON.stringify(body)
      );
      throw new Error(
        `Login failed (HTTP ${status}): ${JSON.stringify(body)}`
      );
    }

    // Re-throw if it's already one of our errors
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`Unexpected login error: ${String(error)}`);
  }
}

/**
 * Refresh the JWT session using a valid refresh token.
 */
export async function refreshSmartAPISession(
  refreshToken: string
): Promise<LoginResponse> {
  const config = getConfig();

  const url = `${BASE_URL}/rest/auth/angelbroking/user/v1/refresh`;
  const headers = buildHeaders(config.API_KEY);
  const body = { refreshToken };

  console.log("[SmartAPI] Refreshing session...");

  try {
    const response = await axios.post<{
      status: boolean;
      message: string;
      errorcode?: string;
      data?: {
        jwtToken: string;
        refreshToken: string;
        feedToken: string;
      };
    }>(url, body, { headers });

    const { status, message, data, errorcode } = response.data;

    if (!status || !data) {
      const errMsg = errorcode
        ? `[${errorcode}] ${message}`
        : message || "Refresh failed with no error message";
      throw new Error(errMsg);
    }

    // Update in-memory store
    store.jwtToken = data.jwtToken;
    store.refreshToken = data.refreshToken;
    store.feedToken = data.feedToken;
    store.issuedAt = new Date();

    console.log("[SmartAPI] Session refreshed successfully.");

    return {
      jwtToken: data.jwtToken,
      refreshToken: data.refreshToken,
      feedToken: data.feedToken,
      message,
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const body = error.response?.data;
      console.error(
        `[SmartAPI] Refresh failed (HTTP ${status}):`,
        JSON.stringify(body)
      );
      throw new Error(
        `Session refresh failed (HTTP ${status}): ${JSON.stringify(body)}`
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`Unexpected refresh error: ${String(error)}`);
  }
}

/**
 * Fetch the user profile / account details.
 * Requires a valid JWT token.
 */
export async function getUserProfile(): Promise<UserProfile> {
  const jwtToken = await getValidSession();
  const config = getConfig();

  const url = `${BASE_URL}/rest/secure/angelbroking/user/v1/getProfile`;
  const headers = buildHeaders(config.API_KEY, jwtToken);

  try {
    const response = await axios.get<{
      status: boolean;
      message: string;
      errorcode?: string;
      data?: UserProfile;
    }>(url, { headers });

    const { status, message, data, errorcode } = response.data;

    if (!status || !data) {
      const errMsg = errorcode
        ? `[${errorcode}] ${message}`
        : message || `Profile fetch failed (status: ${status}, response: ${JSON.stringify(response.data)})`;
      console.error(`[SmartAPI] Profile fetch failed details:`, response.data);
      throw new Error(errMsg);
    }

    console.log("[SmartAPI] Profile fetched successfully.");
    return data;
  } catch (error) {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const body = error.response?.data;
      console.error(
        `[SmartAPI] Profile fetch failed (HTTP ${status}):`,
        JSON.stringify(body)
      );
      throw new Error(
        `Profile fetch failed (HTTP ${status}): ${JSON.stringify(body)}`
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`Unexpected profile error: ${String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/**
 * Check whether the stored JWT token is expired or close to expiring.
 */
function isSessionExpired(): boolean {
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
  // No token at all → fresh login
  if (!store.jwtToken) {
    const result = await loginSmartAPI();
    return result.jwtToken;
  }

  // Token exists but expired / near expiry → refresh
  if (isSessionExpired()) {
    if (store.refreshToken) {
      try {
        const result = await refreshSmartAPISession(store.refreshToken);
        return result.jwtToken;
      } catch {
        // Refresh failed (e.g. refresh token also expired) → full re-login
        console.warn(
          "[SmartAPI] Refresh failed, falling back to full login..."
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
 * Get the current token store snapshot (useful for debugging / monitoring).
 */
export function getTokenStore(): Readonly<TokenStore> {
  return { ...store };
}

/**
 * Start a periodic refresh loop that keeps the session alive.
 * Call this once during server startup.
 *
 * @param intervalMs How often to check & refresh (default: every 30 minutes)
 * @returns A NodeJS.Timeout handle (call clearInterval() to stop)
 */
export function startSessionScheduler(
  intervalMs: number = 30 * 60 * 1000
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