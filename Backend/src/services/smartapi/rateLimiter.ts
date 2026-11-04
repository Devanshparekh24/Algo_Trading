// ===========================================================================
// SmartAPI Central Request Rate Limiter & Concurrency Queue
// ===========================================================================
// Angel One enforces strict API rate limits (maximum 3 requests/sec per API key).
// When multiple controllers/services fire simultaneously (quotes, holdings, F&O, RMS),
// this queue serializes outbound HTTP requests with a minimum 380ms delay (~2.6 req/sec)
// and automatically handles exponential backoff without throwing 403 errors.

import axios from "axios";

interface QueueItem<T> {
  task: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  retries: number;
  label?: string | undefined;
}

class SmartApiRequestQueue {
  private queue: QueueItem<any>[] = [];
  private isProcessing = false;
  private minIntervalMs = 380; // Max ~2.6 req/sec (safely under Angel One's 3 req/sec limit)
  private lastRequestTime = 0;
  private maxRetries = 3;

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

    // 1. Direct rate limit flag
    if (typeof error === "object" && (error as any).isRateLimitStatus) {
      return true;
    }

    // 2. Axios response error
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

    // 3. Wrapped or standard Error message
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

    // 4. Raw string error
    if (typeof error === "string") {
      const lower = error.toLowerCase();
      if (
        lower.includes("exceeding access rate") ||
        lower.includes("rate limit") ||
        lower.includes("access denied") ||
        lower.includes("403")
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Enqueue a SmartAPI request to be executed with rate-limiting & backoff
   */
  public enqueue<T>(task: () => Promise<T>, label?: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject,
        retries: 0,
        label,
      });

      this.processQueue();
    });
  }

  /**
   * Process queue items one at a time with guaranteed pacing
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      // Ensure minimum interval between outbound requests
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      if (elapsed < this.minIntervalMs) {
        await this.sleep(this.minIntervalMs - elapsed);
      }

      this.lastRequestTime = Date.now();

      try {
        const result = await item.task();
        item.resolve(result);
      } catch (error: any) {
        if (this.isRateLimit(error) && item.retries < this.maxRetries) {
          item.retries += 1;
          const backoffDelay = 1500 * item.retries; // 1.5s, 3.0s, 4.5s
          console.warn(
            `[SmartAPI Queue] Rate limit detected for ${item.label || "request"}. Pausing queue for ${backoffDelay}ms (Retry ${item.retries}/${this.maxRetries})...`
          );
          // Wait for Angel One rate limit rolling window to clear
          await this.sleep(backoffDelay);
          // Re-queue at the front of the queue
          this.queue.unshift(item);
        } else {
          item.reject(error);
        }
      }
    }

    this.isProcessing = false;
  }
}

// Global Singleton Queue for the entire backend
export const smartApiQueue = new SmartApiRequestQueue();

/**
 * Execute any SmartAPI async call safely through the rate-limiting queue
 */
export function executeSmartApiRequest<T>(task: () => Promise<T>, label?: string): Promise<T> {
  return smartApiQueue.enqueue(task, label);
}
