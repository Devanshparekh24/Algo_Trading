// ===========================================================================
// SmartAPI Inter-Request Rate Limiter & Concurrency Pacer
// ===========================================================================
// Angel One enforces strict API rate limits (maximum 3 requests/sec per API key).
// This pacer guarantees a minimum 400ms gap between initiating any two outbound requests (~2.5 req/sec).
// Uses a robust promise-chain FIFO queue to guarantee zero deadlocks and thread-safe serial dispatching.

import axios from "axios";

class SmartApiPacer {
  private minIntervalMs = 400; // Safe spacing under Angel One's 3 req/sec cap
  private lastRequestTime = 0;
  private chain: Promise<void> = Promise.resolve();

  /**
   * Check if an error is an Angel One rate limit error
   */
  public isRateLimit(error: unknown): boolean {
    if (!error) return false;

    if (typeof error === "object" && (error as any).isRateLimitStatus) {
      return true;
    }

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        return true;
      }
      const body = error.response?.data;
      const bodyStr = typeof body === "string" ? body : JSON.stringify(body || "");
      const lower = bodyStr.toLowerCase();
      if (
        lower.includes("exceeding access rate") ||
        lower.includes("rate limit") ||
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
        msg.includes("ag8001") ||
        msg.includes("ab8050")
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Request a pacing slot before firing an HTTP call (FIFO queued)
   */
  public acquire(): Promise<void> {
    const nextSlot = this.chain.then(async () => {
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      const wait = Math.max(0, this.minIntervalMs - elapsed);
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      this.lastRequestTime = Date.now();
    });

    // Keep chain advancing even if a slot fails
    this.chain = nextSlot.catch(() => {});
    return nextSlot;
  }

  /**
   * Pause the pacer queue for ms milliseconds (used for rate limit backoff)
   */
  public pause(ms: number): Promise<void> {
    const pauseSlot = this.chain.then(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      this.lastRequestTime = Date.now();
    });

    this.chain = pauseSlot.catch(() => {});
    return pauseSlot;
  }

  // Compatibility helper
  public triggerCooldown(ms: number): void {
    this.pause(ms);
  }
}

// Global Singleton Pacer
export const smartApiPacer = new SmartApiPacer();

/**
 * Safely execute any SmartAPI call through the rate-limiting pacer with automatic backoff retry.
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
        await smartApiPacer.pause(backoff);
        continue;
      }
      throw error;
    }
  }
}
