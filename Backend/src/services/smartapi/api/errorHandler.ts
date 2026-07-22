// ---------------------------------------------------------------------------
// Shared Axios Error Handler for SmartAPI Endpoints
// ---------------------------------------------------------------------------

import axios from "axios";

/**
 * Standardised error payload from the Angel One SmartAPI.
 */
interface SmartApiErrorPayload {
  message?: string;
  errorcode?: string;
  [key: string]: unknown;
}

/**
 * Handler map for custom error logic per HTTP status code.
 * Return `false` to fall through to the default handler.
 */
type StatusHandler = (body: SmartApiErrorPayload) => { handled: false } | { handled: true; error: Error };

/**
 * Centralised handler for Axios errors thrown by SmartAPI calls.
 *
 * Usage inside a `catch` block:
 * ```ts
 * catch (error) {
 *   handleApiError(error, "login", { 401: () => ({ handled: true, error: new Error("...") }) });
 * }
 * ```
 *
 * @param error          The caught value (any)
 * @param context        Human-readable action name for log messages (e.g. "login", "profile fetch")
 * @param statusHandlers Optional map of HTTP status → custom handler
 * @throws Error Always throws a descriptive Error.
 */
export function handleApiError(
  error: unknown,
  context: string,
  statusHandlers?: Record<number, StatusHandler>,
): never {
  // ── Axios error ──────────────────────────────────────────────────────
  if (axios.isAxiosError(error)) {
    // Network error (no response received)
    if (!error.response) {
      const msg = `Network error during ${context}: ${error.message}`;
      console.error(`[SmartAPI] ${msg}`);
      throw new Error(msg);
    }

    const status = error.response.status;
    const body = (error.response.data ?? {}) as SmartApiErrorPayload;

    // Run a custom status handler if one was provided
    const handler = statusHandlers?.[status];
    if (handler) {
      const result = handler(body);
      if (result.handled) {
        console.error(`[SmartAPI] ${context} failed (${status}): ${result.error.message}`);
        throw result.error;
      }
      // handled: false → fall through to default
    }

    // Default behaviour: log & throw with the API's message
    const msg = `${context} failed (HTTP ${status}): ${JSON.stringify(body)}`;
    console.error(`[SmartAPI] ${msg}`);
    throw new Error(msg);
  }

  // ── Already an Error instance (e.g. our own "!status" guard) ─────────
  if (error instanceof Error) {
    throw error;
  }

  // ── Unexpected / non-Error thrown value ──────────────────────────────
  throw new Error(`Unexpected error during ${context}: ${String(error)}`);
}