// ---------------------------------------------------------------------------
// SmartAPI – Authentication Endpoints
// ---------------------------------------------------------------------------

import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL, DEFAULT_TIMEOUT_MS } from "../constants.js";
import { generateTOTP, buildHeaders } from "../helpers.js";
import { getStore, setStore, clearStore } from "../store.js";
import type { LoginResponse } from "../types.js";
import { handleApiError } from "./errorHandler.js";
import { executeSmartApiRequest } from "../rateLimiter.js";

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

  return executeSmartApiRequest(
    async () => {
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
        }>(url, body, { headers, timeout: DEFAULT_TIMEOUT_MS });

        const { status, message, data, errorcode } = response.data;

        if (!status || !data) {
          const errMsg = errorcode
            ? `[${errorcode}] ${message}`
            : message || "Login failed with no error message";
          throw new Error(errMsg);
        }

        // Store tokens in memory
        setStore(data);

        console.log("[SmartAPI] Login successful. Tokens stored in memory.");

        return {
          jwtToken: data.jwtToken,
          refreshToken: data.refreshToken,
          feedToken: data.feedToken,
          message,
        };
      } catch (error) {
        handleApiError(error, "login", {
          401: (body) => ({
            handled: true,
            error: new Error(
              body?.message || "Unauthorized – check credentials, TOTP, or IP whitelist",
            ),
          }),
        });
      }
    },
    "loginByPassword",
    config.CLIENT_CODE
  );
}

/**
 * Refresh the JWT session using a valid refresh token.
 */
export async function refreshSmartAPISession(
  refreshToken: string,
  jwtToken?: string,
): Promise<LoginResponse> {
  const config = getConfig();
  const activeJwt = jwtToken || getStore().jwtToken || undefined;

  const url = `${BASE_URL}/rest/auth/angelbroking/jwt/v1/generateTokens`;
  const headers = buildHeaders(config.API_KEY, activeJwt);
  const body = { refreshToken };

  console.log("[SmartAPI] Refreshing session with generateTokens endpoint...");

  return executeSmartApiRequest(
    async () => {
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
        }>(url, body, { headers, timeout: DEFAULT_TIMEOUT_MS });

        const { status, message, data, errorcode } = response.data;

        if (!status || !data) {
          const errMsg = errorcode
            ? `[${errorcode}] ${message}`
            : message || "Refresh failed with no error message";
          throw new Error(errMsg);
        }

        // Update in-memory store
        setStore(data);

        console.log("[SmartAPI] Session refreshed successfully.");

        return {
          jwtToken: data.jwtToken,
          refreshToken: data.refreshToken,
          feedToken: data.feedToken,
          message,
        };
      } catch (error) {
        // Re-throw so caller (session manager) can fall back to full login without prematurely writing an AB2000 alarm
        throw error;
      }
    },
    "generateTokens",
    config.CLIENT_CODE
  );
}

/**
 * Log out from the Angel One SmartAPI session.
 *
 * Invalidates the session on the server and clears stored tokens in memory.
 * This function swallows API errors intentionally — we always clear local tokens.
 */
export async function logoutSmartAPI(): Promise<boolean> {
  const config = getConfig();
  const store = getStore();
  const jwtToken = store.jwtToken;

  if (!jwtToken) {
    console.log("[SmartAPI] No active session to log out.");
    return false;
  }

  const url = `${BASE_URL}/rest/secure/angelbroking/user/v1/logout`;
  const headers = buildHeaders(config.API_KEY, jwtToken);
  const body = {
    clientcode: config.CLIENT_CODE,
  };

  console.log("[SmartAPI] Attempting logout...");

  return executeSmartApiRequest(
    async () => {
      try {
        const response = await axios.post<{
          status: boolean;
          message: string;
          errorcode?: string;
        }>(url, body, { headers });

        const { status, message, errorcode } = response.data;

        if (!status) {
          const errMsg = errorcode
            ? `[${errorcode}] ${message}`
            : message || "Logout failed with no error message";
          console.error(`[SmartAPI] Logout failed: ${errMsg}`);
        } else {
          console.log("[SmartAPI] Logout successful on server.");
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const bodyData = error.response?.data;
          console.error(
            `[SmartAPI] Logout API call error (HTTP ${status}):`,
            JSON.stringify(bodyData || error.message),
          );
        } else {
          console.error("[SmartAPI] Unexpected error during logout call:", String(error));
        }
      } finally {
        // Always clear the local token store on logout
        clearStore();
        console.log("[SmartAPI] Local session tokens cleared.");
      }

      return true;
    },
    "logout",
    config.CLIENT_CODE
  );
}