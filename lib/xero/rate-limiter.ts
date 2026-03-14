/**
 * Xero API Rate Limiter
 *
 * Uses Bottleneck to enforce rate limits and respect Retry-After headers.
 *
 * Xero API limits:
 * - 60 requests per minute (per app/tenant pair)
 * - Rate limit: 1 request per second (with burst capacity of 5 concurrent)
 *
 * Strategy:
 * - maxConcurrent: 5 (allow up to 5 concurrent requests)
 * - minTime: 1000ms (minimum 1 second between requests)
 * - Automatically pause on 429 responses with Retry-After
 */

import Bottleneck from 'bottleneck';
import { getErrorMessage } from '@/lib/utils/error';

/**
 * Xero API rate limiter
 *
 * Configuration:
 * - maxConcurrent: 5 requests can run simultaneously
 * - minTime: 1000ms minimum time between requests (60 req/min)
 */
export const xeroRateLimiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 1000, // 1 second between requests = 60 req/min
});

/**
 * Wrap Xero API call with rate limiting and retry-after handling
 *
 * @param fn - Async function making Xero API call
 * @returns Promise resolving to function result
 */
export async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  return xeroRateLimiter.schedule(async () => {
    try {
      return await fn();
    } catch (error: unknown) {
      // Check for rate limit error (429)
      const errObj = error as Record<string, any>;
      if (errObj?.response?.status === 429 || errObj?.statusCode === 429) {
        const retryAfter =
          errObj?.response?.headers?.['retry-after'] ||
          errObj?.response?.headers?.['Retry-After'];

        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds) && seconds > 0) {
            console.warn(
              `Rate limit (429) encountered - waiting ${seconds}s before retry`
            );

            // Wait for the specified duration before retrying
            await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

            console.log(`Rate limit wait completed after ${seconds}s`);
          }
        }
      }

      // Re-throw error for retry logic to handle
      throw error;
    }
  });
}

/**
 * Get current rate limiter status
 */
export function getRateLimiterStatus() {
  return {
    running: xeroRateLimiter.counts().RUNNING,
    queued: xeroRateLimiter.counts().QUEUED,
    executing: xeroRateLimiter.counts().EXECUTING,
  };
}

/**
 * Clear rate limiter queue (use with caution)
 */
export async function clearRateLimiter() {
  await xeroRateLimiter.stop({ dropWaitingJobs: true });
  // Note: Bottleneck will resume automatically when stop ends
}
