/**
 * Mercury API Rate Limiter
 *
 * Implements conservative rate limiting with exponential backoff and retry-after handling
 * Based on research findings: Mercury rate limits not publicly documented
 * Conservative limits: 60 req/min, max 5 concurrent
 */

import Bottleneck from 'bottleneck';

/**
 * Rate limiter for Mercury API calls
 * Conservative settings until Mercury provides official limits
 */
const mercuryLimiter = new Bottleneck({
  maxConcurrent: 5,        // Max 5 concurrent requests
  minTime: 1000,           // Min 1 second between requests (60/min)
  reservoir: 60,           // 60 requests per...
  reservoirRefreshAmount: 60,
  reservoirRefreshInterval: 60 * 1000,  // ...60 seconds
});

/**
 * Handle 429 Rate Limit responses with Retry-After header
 */
mercuryLimiter.on('failed', async (error: any, jobInfo: any) => {
  const status = error?.response?.status || error?.status;

  if (status === 429) {
    // Extract Retry-After header (in seconds)
    const retryAfter = error.response?.headers?.['retry-after'] ||
                       error.retryAfter ||
                       60; // Default to 60 seconds

    const retryAfterMs = parseInt(String(retryAfter)) * 1000;

    console.warn(`[Mercury Rate Limiter] Rate limit hit. Retrying after ${retryAfter}s`);

    // Tell Bottleneck to wait this many ms before retry
    return retryAfterMs;
  }

  // Don't retry for other errors
  return 0;
});

/**
 * Wrap Mercury API call with rate limiting
 *
 * @param fn - Async function to execute (Mercury API call)
 * @returns Promise that resolves with the API call result
 *
 * @example
 * const result = await wrapMercuryCall(async () => {
 *   return client.getTransactions({ limit: 100 });
 * });
 */
export async function wrapMercuryCall<T>(fn: () => Promise<T>): Promise<T> {
  return mercuryLimiter.schedule(fn);
}

/**
 * Get current rate limiter status
 * Useful for monitoring and debugging
 */
export function getRateLimiterStatus() {
  return {
    running: mercuryLimiter.counts().RUNNING,
    queued: mercuryLimiter.counts().QUEUED,
    executing: mercuryLimiter.counts().EXECUTING,
  };
}

/**
 * Clear rate limiter queue (use with caution)
 * Useful for testing or emergency scenarios
 */
export async function clearRateLimiter() {
  await mercuryLimiter.stop({ dropWaitingJobs: true });
}

/**
 * Update rate limiter settings dynamically
 * Call this after getting official limits from Mercury
 *
 * @param settings - New limiter settings
 */
export function updateRateLimiterSettings(settings: {
  maxConcurrent?: number;
  minTime?: number;
  reservoir?: number;
  reservoirRefreshAmount?: number;
  reservoirRefreshInterval?: number;
}) {
  if (settings.maxConcurrent !== undefined) {
    mercuryLimiter.updateSettings({ maxConcurrent: settings.maxConcurrent });
  }
  if (settings.minTime !== undefined) {
    mercuryLimiter.updateSettings({ minTime: settings.minTime });
  }
  if (settings.reservoir !== undefined) {
    mercuryLimiter.updateSettings({
      reservoir: settings.reservoir,
      reservoirRefreshAmount: settings.reservoirRefreshAmount || settings.reservoir,
    });
  }
  if (settings.reservoirRefreshInterval !== undefined) {
    mercuryLimiter.updateSettings({
      reservoirRefreshInterval: settings.reservoirRefreshInterval,
    });
  }

  console.log('[Mercury Rate Limiter] Settings updated:', settings);
}
