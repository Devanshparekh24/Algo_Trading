// ---------------------------------------------------------------------------
// SmartAPI – User Profile Endpoint
// ---------------------------------------------------------------------------

import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL, DEFAULT_TIMEOUT_MS } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { UserProfile } from "../types.js";
import { handleApiError } from "./errorHandler.js";
import { executeSmartApiRequest } from "../rateLimiter.js";

// In-Memory Profile Cache (Persisted once fetched; static for the session)
let cachedProfile: UserProfile | null = null;
let lastProfileFetchTime = 0;

/**
 * Clear profile cache (invoked upon logout)
 */
export function clearProfileCache(): void {
  cachedProfile = null;
  lastProfileFetchTime = 0;
  console.log("[SmartAPI] Profile cache cleared.");
}

/**
 * Fetch the user profile / account details.
 * Requires a valid JWT token.
 * Fetched ONCE and cached indefinitely for the active session.
 * Supports forceRefresh = true to bypass cache if explicitly demanded.
 */
export async function getUserProfile(forceRefresh = false): Promise<UserProfile> {
  if (!forceRefresh && cachedProfile) {
    return cachedProfile;
  }

  return executeSmartApiRequest(async () => {
    if (!forceRefresh && cachedProfile) {
      return cachedProfile;
    }

    try {
      const jwtToken = await getValidSession();
      const config = getConfig();

      const url = `${BASE_URL}/rest/secure/angelbroking/user/v1/getProfile`;
      const headers = buildHeaders(config.API_KEY, jwtToken);

      const response = await axios.get<{
        status: boolean;
        message: string;
        errorcode?: string;
        data?: UserProfile;
      }>(url, { headers, timeout: DEFAULT_TIMEOUT_MS });

      const { status, message, data, errorcode } = response.data;

      if (!status || !data) {
        if (
          message &&
          (message.toLowerCase().includes("exceeding access rate") ||
            message.toLowerCase().includes("rate limit") ||
            message.toLowerCase().includes("access denied"))
        ) {
          throw { isRateLimitStatus: true, message };
        }

        const errMsg = errorcode
          ? `[${errorcode}] ${message}`
          : message || `Profile fetch failed`;
        console.warn(`[SmartAPI] Profile fetch warning: ${errMsg}`);
        if (cachedProfile) return cachedProfile;
        throw new Error(errMsg);
      }

      cachedProfile = data;
      lastProfileFetchTime = Date.now();
      console.log("[SmartAPI] Profile fetched successfully.");
      return data;
    } catch (error: any) {
      if (error?.isRateLimitStatus) {
        throw error;
      }
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 403 || error.response?.status === 429)
      ) {
        throw error;
      }
      if (cachedProfile) {
        console.warn(`[SmartAPI] Profile fetch returning cached profile due to error: ${error?.message || error}`);
        return cachedProfile;
      }
      handleApiError(error, "profile fetch");
    }
  }, "getUserProfile");
}
