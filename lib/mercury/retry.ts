/**
 * Mercury API Retry Logic
 *
 * Reuses robust retry implementation from Xero integration.
 * Implements exponential backoff for transient errors with Mercury-specific handling.
 */

import {
  isTransientError,
  sleep,
  calculateBackoffDelay,
  getRetryAfter,
  retryWithBackoff as baseRetryWithBackoff,
} from '@/lib/xero/retry';

// Re-export utilities for Mercury use
export { isTransientError, sleep, calculateBackoffDelay, getRetryAfter };

/**
 * Mercury-specific retry wrapper
 *
 * Same as base retry but with Mercury-specific logging context.
 *
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @param context - Optional context for logging (e.g., "fetch transactions")
 * @returns Promise resolving to function result
 * @throws Error if all retries exhausted or permanent error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context?: string
): Promise<T> {
  const contextPrefix = context ? `[Mercury ${context}]` : '[Mercury]';

  let lastError: any;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;

      // Check if error is transient
      if (!isTransientError(error)) {
        console.error(
          `${contextPrefix} Permanent error (attempt ${attempt + 1}/${maxRetries + 1}):`,
          error
        );
        throw error;
      }

      // Check if we've exhausted retries
      if (attempt >= maxRetries) {
        console.error(
          `${contextPrefix} Max retries (${maxRetries}) exhausted:`,
          error
        );
        throw error;
      }

      // Check for rate limit Retry-After header
      const retryAfter = getRetryAfter(error);
      let delayMs: number;

      if (retryAfter !== null) {
        delayMs = retryAfter * 1000;
        console.warn(
          `${contextPrefix} Rate limit (429) - respecting Retry-After: ${retryAfter}s`
        );
      } else {
        delayMs = calculateBackoffDelay(attempt, baseDelay);
      }

      console.warn(
        `${contextPrefix} Transient error (attempt ${attempt + 1}/${maxRetries + 1}) - retrying in ${Math.round(delayMs)}ms:`,
        error instanceof Error ? error.message : error
      );

      await sleep(delayMs);
      attempt++;
    }
  }

  throw lastError;
}

/**
 * Create retry metadata for error logging
 *
 * @param error - Error object
 * @param attempt - Current retry attempt
 * @param maxRetries - Maximum retries allowed
 * @returns Metadata object for logging
 */
export function createRetryMetadata(error: any, attempt: number, maxRetries: number) {
  const statusCode = error?.response?.status || error?.statusCode || error?.status;

  return {
    retry_attempt: attempt,
    max_retries: maxRetries,
    is_transient: isTransientError(error),
    http_status: statusCode,
    error_code: error?.code,
    error_type: error?.name || 'Unknown',
    retry_after: getRetryAfter(error),
  };
}
