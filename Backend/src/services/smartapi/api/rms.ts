// ---------------------------------------------------------------------------
// SmartAPI – RMS Limits / Funds Margin Endpoint
// ---------------------------------------------------------------------------

import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { RMSData } from "../types.js";
import { handleApiError } from "./errorHandler.js";

/**
 * Fetch RMS limits / funds and margin details from Angel One.
 * Endpoint: GET https://apiconnect.angelone.in/rest/secure/angelbroking/user/v1/getRMS
 */
export async function getRMS(): Promise<RMSData> {
  const jwtToken = await getValidSession();
  const config = getConfig();

  const url = `${BASE_URL}/rest/secure/angelbroking/user/v1/getRMS`;
  const headers = buildHeaders(config.API_KEY, jwtToken);

  try {
    const response = await axios.get<{
      status: boolean;
      message: string;
      errorcode?: string;
      data?: RMSData;
    }>(url, { headers });

    const { status, message, data, errorcode } = response.data;

    if (!status || !data) {
      const errMsg = errorcode
        ? `[${errorcode}] ${message}`
        : message || `RMS limit fetch failed (status: ${status}, response: ${JSON.stringify(response.data)})`;
      console.error(`[SmartAPI] RMS limit fetch failed details:`, response.data);
      throw new Error(errMsg);
    }

    console.log("[SmartAPI] RMS limit fetched successfully.");
    return data;
  } catch (error) {
    handleApiError(error, "RMS limit fetch");
  }
}
