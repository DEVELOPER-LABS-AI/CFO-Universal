/**
 * Mercury Integration Utility Functions
 * Shared utilities for merchant name normalization and data processing
 */

/**
 * Normalize merchant name for fuzzy matching
 * Removes special characters, converts to lowercase, trims whitespace
 *
 * @param name - Raw merchant name from Mercury API
 * @returns Normalized merchant name for comparison
 *
 * @example
 * normalizeName("AWS, Inc.") // "aws"
 * normalizeName("  Google Cloud  ") // "google cloud"
 * normalizeName("Acme Corp., LLC") // "acme corp"
 */
export function normalizeName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase() // Convert to lowercase
    .trim() // Remove leading/trailing whitespace
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[,\.]/g, '') // Remove commas and periods
    .replace(/\b(inc|llc|corp|ltd|co|corporation|limited|company)\b/gi, '') // Remove business suffixes
    .trim() // Trim again after removals
    .replace(/\s+/g, ' '); // Clean up any double spaces created
}

/**
 * Extract the base vendor name from a Mercury merchant name.
 * Strips invoice numbers, transaction-specific suffixes, special chars, and noise
 * so that all variants of the same vendor match.
 *
 * @example
 * extractBaseVendorName("Apify* Inv#20250816007") // "apify"
 * extractBaseVendorName("GOOGLE*GSUITE GETDEVEL") // "google gsuite getdevel"
 * extractBaseVendorName("Google Workspace_devel") // "google workspace"
 * extractBaseVendorName("Xro Xero Custom Conne") // "xro xero custom conne"
 * extractBaseVendorName("Smartlead-521 Products") // "smartlead products"
 */
export function extractBaseVendorName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .trim()
    .replace(/\*/g, ' ')               // Replace * with space (e.g. "GOOGLE*GSUITE..." → "google gsuite...")
    .replace(/\binv[#\s]*\S+/gi, '')    // Remove invoice references (Inv#20250816007)
    .replace(/_\S+$/g, '')              // Remove trailing _suffixes (Workspace_devel)
    .replace(/[*#_@!]/g, '')            // Remove special chars
    .replace(/[,\.]/g, '')              // Remove commas and periods
    .replace(/\b\d{3,}\b/g, '')         // Remove numbers with 3+ digits (IDs, invoice nums)
    .replace(/-\d+\b/g, '')            // Remove dash-number suffixes (e.g. "-521")
    .replace(/\b(inc|llc|corp|ltd|co|corporation|limited|company)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity score between two strings using Jaro-Winkler algorithm
 * This is a wrapper around the string-similarity package for type safety
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Similarity score between 0.0 and 1.0
 */
export function calculateSimilarity(str1: string, str2: string): number {
  // Lazy load to avoid bundling if not used
  const { compareTwoStrings } = require('string-similarity');
  return compareTwoStrings(str1, str2);
}

/**
 * Format currency amount for display
 *
 * @param amount - Amount in dollars (decimal)
 * @param currency - Currency code (default: USD)
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1234.56) // "$1,234.56"
 * formatCurrency(-100.00) // "-$100.00"
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Parse Mercury transaction amount to decimal
 * Mercury API returns amounts in dollars as numbers
 *
 * @param amount - Amount from Mercury API
 * @returns Decimal amount rounded to 2 decimal places
 */
export function parseTransactionAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Validate Mercury API key format
 * Mercury API keys can be in format:
 * - secret-token:mercury_production_rma_...
 * - mercury_production_rma_...
 *
 * @param apiKey - API key to validate
 * @returns true if valid, false otherwise
 */
export function validateApiKey(apiKey: string | undefined): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // Remove "secret-token:" prefix if present for validation
  const keyWithoutPrefix = apiKey.startsWith('secret-token:')
    ? apiKey.substring('secret-token:'.length)
    : apiKey;

  // Mercury API keys start with "mercury_" and should be at least 20 characters
  if (keyWithoutPrefix.length < 20) {
    return false;
  }

  // API key should not contain whitespace
  if (/\s/.test(apiKey)) {
    return false;
  }

  // Should start with "mercury_"
  if (!keyWithoutPrefix.startsWith('mercury_')) {
    return false;
  }

  return true;
}

/**
 * Extract error message from various error types
 *
 * @param error - Error object from API call or exception
 * @returns Human-readable error message
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return 'An unknown error occurred';
}
