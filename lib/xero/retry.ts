/**
 * Xero API Retry Logic with Exponential Backoff
 *
 * Implements intelligent retry strategy for transient errors:
 * - Transient errors (429, 503, 5xx, timeout): Retry with exponential backoff
 * - Permanent errors (401, 404, 400): Fail immediately, no retry
 * - Max 3 retries with jitter to prevent thundering herd
 * - Respects Retry-After header for rate limits (429)
 *
 * Retry delays: ~1s, ~2s, ~4s (capped at 15s)
 */

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 15000; // 15 seconds
const JITTER_MS = 1000; // Random jitter up to 1 second

/**
 * Check if error is transient and should be retried
 *
 * Transient errors:
 * - 429: Rate limit exceeded
 * - 503: Service unavailable
 * - 5xx: Server errors (500, 502, 504, etc.)
 * - Network timeouts
 *
 * Permanent errors (no retry):
 * - 401: Unauthorized
 * - 404: Not found
 * - 400: Bad request
 */
export function isTransientError(error: any): boolean {
  // Check for HTTP status code
  const statusCode = error?.response?.status || error?.statusCode || error?.status;

  if (statusCode) {
    // Rate limit
    if (statusCode === 429) return true;

    // Service unavailable
    if (statusCode === 503) return true;

    // Server errors (5xx)
    if (statusCode >= 500 && statusCode < 600) return true;

    // Permanent errors - do not retry
    if ([400, 401, 403, 404].includes(statusCode)) return false;
  }

  // Network timeout errors
  if (
    error?.code === 'ETIMEDOUT' ||
    error?.code === 'ECONNRESET' ||
    error?.code === 'ECONNREFUSED' ||
    error?.message?.toLowerCase().includes('timeout')
  ) {
    return true;
  }

  // Default: do not retry unknown errors
  return false;
}

/**
 * Sleep utility using Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 *
 * Formula: min(baseDelay * 2^attempt, maxDelay) + random(0, jitter)
 *
 * @param attempt - Retry attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @param jitter - Random jitter in milliseconds
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number = BASE_DELAY_MS,
  maxDelay: number = MAX_DELAY_MS,
  jitter: number = JITTER_MS
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add random jitter to prevent thundering herd
  const randomJitter = Math.random() * jitter;

  return cappedDelay + randomJitter;
}

/**
 * Extract Retry-After header value from rate limit error
 *
 * @param error - Error with response headers
 * @returns Retry-After value in seconds, or null
 */
export function getRetryAfter(error: any): number | null {
  const retryAfter =
    error?.response?.headers?.['retry-after'] ||
    error?.response?.headers?.['Retry-After'];

  if (!retryAfter) return null;

  // Retry-After can be either seconds (number) or HTTP date
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds;
  }

  // Try parsing as date
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    const now = Date.now();
    const delayMs = date.getTime() - now;
    return Math.max(0, Math.ceil(delayMs / 1000));
  }

  return null;
}

/**
 * Retry wrapper with exponential backoff
 *
 * Wraps an async function with retry logic for transient errors.
 *
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @returns Promise resolving to function result
 * @throws Error if all retries exhausted or permanent error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = BASE_DELAY_MS
): Promise<T> {
  let lastError: any;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      // Execute function
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;

      // Check if error is transient
      if (!isTransientError(error)) {
        // Permanent error - fail immediately
        console.error(
          `Permanent error (attempt ${attempt + 1}/${maxRetries + 1}):`,
          error
        );
        throw error;
      }

      // Check if we've exhausted retries
      if (attempt >= maxRetries) {
        console.error(
          `Max retries (${maxRetries}) exhausted for transient error:`,
          error
        );
        throw error;
      }

      // Check for rate limit Retry-After header
      const retryAfter = getRetryAfter(error);
      let delayMs: number;

      if (retryAfter !== null) {
        // Respect Retry-After header (convert to ms)
        delayMs = retryAfter * 1000;
        console.warn(
          `Rate limit (429) - respecting Retry-After: ${retryAfter}s`
        );
      } else {
        // Calculate exponential backoff with jitter
        delayMs = calculateBackoffDelay(attempt, baseDelay);
      }

      console.warn(
        `Transient error (attempt ${attempt + 1}/${maxRetries + 1}) - retrying in ${Math.round(delayMs)}ms:`,
        error instanceof Error ? error.message : error
      );

      // Wait before retry
      await sleep(delayMs);

      attempt++;
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError;
}
