import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL } from "../constants.js";
import { buildHeaders, isRateLimitError } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { FullModeRequest, FullModeResponse } from "../types.js";
import { handleApiError } from "./errorHandler.js";

/**
 * Simple sleep helper.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch Full Mode / Quote data for scrips.
 * Requires a valid JWT token.
 * Retries with exponential backoff on rate limit errors.
 *
 * @param request The parameters for fetching Full Mode data.
 */
export async function getFullModeData(
  request: FullModeRequest
): Promise<FullModeResponse> {
  const maxRetries = 5;
  let attempt = 0;
  let delay = 500; // ms

  while (true) {
    try {
      const jwtToken = await getValidSession();
      const config = getConfig();

      const url = `${BASE_URL}/rest/secure/angelbroking/market/v1/quote/`;
      const headers = buildHeaders(config.API_KEY, jwtToken);

      const response = await axios.post<FullModeResponse>(url, request, { headers });

      const { status, message, data, errorcode } = response.data;

      if (!status || !data) {
        if (
          message &&
          (message.toLowerCase().includes("exceeding access rate") ||
            message.toLowerCase().includes("rate limit"))
        ) {
          throw {
            isRateLimitStatus: true,
            message,
          };
        }

        const errMsg = errorcode
          ? `[${errorcode}] ${message}`
          : message ||
            `Full Mode data fetch failed (status: ${status}, response: ${JSON.stringify(
              response.data
            )})`;
        console.error(
          `[SmartAPI] Full Mode data fetch failed details:`,
          response.data
        );
        throw new Error(errMsg);
      }

      console.log(
        `[SmartAPI] Full Mode data fetched successfully`
      );
      return response.data;
    } catch (error: any) {
      const isRateLimit = isRateLimitError(error) || error?.isRateLimitStatus;

      if (isRateLimit && attempt < maxRetries) {
        attempt++;
        console.warn(
          `[SmartAPI] Rate limit hit for Full Mode data. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`
        );
        await sleep(delay);
        delay *= 2;
        continue;
      }

      if (error?.isRateLimitStatus) {
        throw new Error(`[SmartAPI] Rate limit exceeded: ${error.message}`);
      }

      handleApiError(error, "Full Mode data fetch");
    }
  }
}
