// ---------------------------------------------------------------------------
// Shared Axios & SmartAPI Error Handler with Official Error Code Registry
// ---------------------------------------------------------------------------

import axios from "axios";
import prisma from "../../../config/prisma.js";

/**
 * Official Angel One SmartAPI Error Code Dictionary
 */
export const SMART_API_ERROR_CODES: Record<string, string> = {
  AG8001: "Invalid Token",
  AG8002: "Token Expired",
  AG8003: "Token missing",
  AB8050: "Invalid Refresh Token",
  AB8051: "Refresh Token Expired",
  AB1000: "Invalid Email Or Password",
  AB1001: "Invalid Email",
  AB1002: "Invalid Password Length",
  AB1003: "Client Already Exists",
  AB1004: "Something Went Wrong, Please Try After Sometime",
  AB1005: "User Type Must Be USER",
  AB1006: "Client Is Block For Trading",
  AB1007: "AMX Error",
  AB1008: "Invalid Order Variety",
  AB1009: "Symbol Not Found",
  AB1010: "AMX Session Expired",
  AB1011: "Client not login",
  AB1012: "Invalid Product Type",
  AB1013: "Order not found",
  AB1014: "Trade not found",
  AB1015: "Holding not found",
  AB1016: "Position not found",
  AB1017: "Position conversion failed",
  AB1018: "Failed to get symbol details",
  AB2000: "Error not specified",
  AB2001: "Internal Error, Please try after sometime",
  AB1031: "Old Password Mismatch",
  AB1032: "User Not Found",
  AB2002: "ROBO order is block",
  AB4008: "ordertag length should be less than 20 characters",
  RATE_LIMIT: "Rate Limit Exceeded (HTTP 429 / 403)",
};

/**
 * Custom Exception for Angel One SmartAPI errors
 */
export class SmartApiException extends Error {
  public readonly errorCode: string;
  public readonly description: string;
  public readonly httpStatus?: number | undefined;
  public readonly details?: unknown;

  constructor(
    errorCode: string,
    message?: string,
    httpStatus?: number | undefined,
    details?: unknown
  ) {
    const description = SMART_API_ERROR_CODES[errorCode] || "Unknown SmartAPI Error";
    const fullMsg = `[${errorCode} - ${description}] ${message || description}`;
    super(fullMsg);
    this.name = "SmartApiException";
    this.errorCode = errorCode;
    this.description = description;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

/**
 * Standardised error payload from the Angel One SmartAPI.
 */
export interface SmartApiErrorPayload {
  message?: string;
  errorcode?: string;
  status?: boolean;
  [key: string]: unknown;
}

/**
 * Handler map for custom error logic per HTTP status code.
 * Return `false` to fall through to the default handler.
 */
export type StatusHandler = (body: SmartApiErrorPayload) => { handled: false } | { handled: true; error: Error };

/**
 * Log SmartAPI error directly into PostgreSQL AiErrorLog table
 */
export async function logSmartApiErrorToDb(params: {
  action: string;
  errorCode: string;
  description: string;
  message: string;
  symbol?: string | undefined;
  token?: string | undefined;
  httpStatus?: number | undefined;
  stack?: string | undefined;
  details?: unknown;
}): Promise<void> {
  try {
    await prisma.aiErrorLog.create({
      data: {
        source: "SMART_API",
        action: params.action,
        symbol: params.symbol || null,
        token: params.token || null,
        message: `[${params.errorCode} - ${params.description}]: ${params.message}`,
        stack: params.stack || null,
        details: {
          errorCode: params.errorCode,
          description: params.description,
          httpStatus: params.httpStatus,
          payload: params.details,
        } as any,
      },
    });
    console.log(`[SmartAPI Error Logged to DB] [${params.errorCode}] ${params.description} in ${params.action}`);
  } catch (err: any) {
    console.error("[Database] Failed to write SmartAPI error log to DB:", err?.message || err);
  }
}

/**
 * Centralised handler for Axios and response errors thrown by SmartAPI calls.
 */
export function handleApiError(
  error: unknown,
  context: string,
  statusHandlers?: Record<number, StatusHandler>,
  extraDetails?: { symbol?: string | undefined; token?: string | undefined; payload?: unknown }
): never {
  let errorCode = "AB2000";
  let description = "Error not specified";
  let message = "Unknown error occurred";
  let httpStatus: number | undefined;

  // ── 0. SmartApiException already handled ───────────────────────────
  if (error instanceof SmartApiException) {
    throw error;
  }

  // ── 1. Axios Error ──────────────────────────────────────────────────
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      errorCode = "NETWORK_ERROR";
      description = "Network Connection Failed";
      message = `Network error during ${context}: ${error.message}`;
    } else {
      httpStatus = error.response.status;
      const body = (error.response.data ?? {}) as SmartApiErrorPayload;

      // Extract specific error code if SmartAPI provided one in response body
      if (body.errorcode && SMART_API_ERROR_CODES[body.errorcode]) {
        errorCode = body.errorcode;
        description = SMART_API_ERROR_CODES[body.errorcode] || "API Error";
      } else if (httpStatus === 429) {
        errorCode = "RATE_LIMIT";
        description = SMART_API_ERROR_CODES.RATE_LIMIT || "Rate Limit Exceeded (HTTP 429)";
      } else if (httpStatus === 403) {
        const bodyStr = typeof body === "string" ? body : JSON.stringify(body || "");
        const lower = bodyStr.toLowerCase();
        if (
          lower.includes("rate limit") ||
          lower.includes("exceeding access rate") ||
          lower.includes("throttle")
        ) {
          errorCode = "RATE_LIMIT";
          description = SMART_API_ERROR_CODES.RATE_LIMIT || "Rate Limit Exceeded (HTTP 403)";
        } else {
          errorCode = "ACCESS_DENIED";
          description = "Access Denied / Forbidden (HTTP 403)";
        }
      }

      message = body.message || error.message || `${context} failed with HTTP ${httpStatus}`;

      // Run custom status handler if supplied
      const handler = statusHandlers?.[httpStatus];
      if (handler) {
        const result = handler(body);
        if (result.handled) {
          logSmartApiErrorToDb({
            action: context.toUpperCase(),
            errorCode,
            description,
            message: result.error.message,
            symbol: extraDetails?.symbol,
            token: extraDetails?.token,
            httpStatus,
            stack: result.error.stack,
            details: body,
          }).catch(console.error);
          throw result.error;
        }
      }
    }
  } else if (error instanceof Error) {
    // Check if error message has an error code in brackets like [AB1006]
    const match = error.message.match(/\[([A-Z]{2}\d{4})\]/i);
    if (match && match[1] && SMART_API_ERROR_CODES[match[1].toUpperCase()]) {
      errorCode = match[1].toUpperCase();
      description = SMART_API_ERROR_CODES[errorCode] || "API Error";
    }
    message = error.message;
  } else {
    message = String(error);
  }

  const smartEx = new SmartApiException(errorCode, message, httpStatus, {
    context,
    ...extraDetails,
  });

  // Log to PostgreSQL AiErrorLog asynchronously
  logSmartApiErrorToDb({
    action: context.toUpperCase(),
    errorCode,
    description,
    message,
    symbol: extraDetails?.symbol,
    token: extraDetails?.token,
    httpStatus,
    stack: smartEx.stack,
    details: extraDetails,
  }).catch(console.error);

  console.error(`[SmartAPI] [${errorCode} - ${description}] ${context}: ${message}`);
  throw smartEx;
}
