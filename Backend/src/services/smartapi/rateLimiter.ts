// ===========================================================================
// SmartAPI Inter-Request Rate Limiter & Concurrency Pacer
// ===========================================================================
// Angel One enforces strict API rate limits (maximum 3 requests/sec per API key).
// This pacer guarantees a minimum 380ms gap between initiating any two outbound requests (~2.6 req/sec).
// Uses a non-blocking ticket/pacer model to completely eliminate queue deadlocks
// and handles exponential backoff if Angel One returns a rate limit status.

import axios from "axios";

class SmartApiPacer {
  private minIntervalMs = 380; // Safe spacing under Angel One's 3 req/sec cap
  private lastRequestTime = 0;
  private queue: (() => void)[] = [];
  private isScheduling = false;
  private cooldownUntil = 0;

  /**
   * Helper to sleep for ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if an error is an Angel One rate limit error
   */
  public isRateLimit(error: unknown): boolean {
    if (!error) return false;

    if (typeof error === "object" && (error as any).isRateLimitStatus) {
      return true;
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const body = error.response?.data;
      if (status === 429 || status === 403) {
        return true;
      }
      const bodyStr = typeof body === "string" ? body : JSON.stringify(body || "");
      const lower = bodyStr.toLowerCase();
      if (
        lower.includes("exceeding access rate") ||
        lower.includes("rate limit") ||
        lower.includes("access denied") ||
        lower.includes("ag8001") ||
        lower.includes("ab8050")
      ) {
        return true;
      }
    }

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("exceeding access rate") ||
        msg.includes("rate limit") ||
        msg.includes("access denied") ||
        msg.includes("http 403") ||
        msg.includes("http 429") ||
        msg.includes("ag8001") ||
        msg.includes("ab8050")
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Request a pacing slot before firing an HTTP call
   */
  public acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.dispatchNext();
    });
  }

  /**
   * Trigger backoff cooldown across all queued requests
   */
  public triggerCooldown(ms: number): void {
    const until = Date.now() + ms;
    if (until > this.cooldownUntil) {
      this.cooldownUntil = until;
    }
  }

  private dispatchNext(): void {
    if (this.isScheduling || this.queue.length === 0) return;
    this.isScheduling = true;

    const now = Date.now();
    const waitCooldown = Math.max(0, this.cooldownUntil - now);
    const elapsedSinceLast = now - this.lastRequestTime;
    const waitSpacing = Math.max(0, this.minIntervalMs - elapsedSinceLast);
    const delay = Math.max(waitCooldown, waitSpacing);

    setTimeout(() => {
      this.lastRequestTime = Date.now();
      const nextResolve = this.queue.shift();
      this.isScheduling = false;

      if (nextResolve) {
        nextResolve();
      }

      if (this.queue.length > 0) {
        this.dispatchNext();
      }
    }, delay);
  }
}

// Global Singleton Pacer
export const smartApiPacer = new SmartApiPacer();

/**
 * Safely execute any SmartAPI call through the rate-limiting pacer with automatic backoff retry.
 * Eliminates deadlocks because nested calls (e.g. getHoldings calling getFullModeData) simply acquire
 * their own pacing slot without blocking parent tasks.
 */
export async function executeSmartApiRequest<T>(
  task: () => Promise<T>,
  label?: string
): Promise<T> {
  const maxRetries = 2;
  let attempt = 0;

  while (true) {
    await smartApiPacer.acquire();

    try {
      return await task();
    } catch (error: any) {
      if (smartApiPacer.isRateLimit(error) && attempt < maxRetries) {
        attempt++;
        const backoff = 1200 * attempt;
        console.warn(
          `[SmartAPI Pacer] Rate limit hit for ${label || "request"}. Backing off for ${backoff}ms (Attempt ${attempt}/${maxRetries})...`
        );
        smartApiPacer.triggerCooldown(backoff);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw error;
    }
  }
}
