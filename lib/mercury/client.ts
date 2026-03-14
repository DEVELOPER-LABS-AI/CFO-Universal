/**
 * Mercury Bank API Client
 * Handles all API communications with Mercury Bank API v1
 * @see https://docs.mercury.com/reference/welcome-to-mercury-api
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { retryWithBackoff } from './retry';
import type {
  MercuryTransaction,
  MercuryTransactionsResponse,
  MercuryAccount,
  MercuryTreasuryAccount,
  MercuryPaginationParams,
  MercuryApiError,
} from '@/types/mercury';

const MERCURY_API_BASE_URL = 'https://api.mercury.com/api/v1';

/**
 * Mercury API Client
 * Provides methods to interact with Mercury Bank API
 */
export class MercuryClient {
  private client: AxiosInstance;
  private apiKey: string;

  /**
   * Create a new Mercury API client
   * @param apiKey - Mercury API key (encrypted in storage, decrypted for use)
   */
  constructor(apiKey: string) {
    this.apiKey = apiKey;

    // Configure proxy agent if QUOTAGUARD_URL is set (for static IP whitelisting)
    const axiosConfig: any = {
      baseURL: MERCURY_API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    };

    // Use QuotaGuard proxy for static IP if configured
    if (process.env.QUOTAGUARD_URL) {
      const proxyAgent = new HttpsProxyAgent(process.env.QUOTAGUARD_URL);
      axiosConfig.httpsAgent = proxyAgent;
      console.log('[Mercury Client] Using QuotaGuard proxy for static IP');
    }

    this.client = axios.create(axiosConfig);

    // Add request interceptor to inject Authorization header
    this.client.interceptors.request.use(
      (config) => {
        // Mercury API requires Bearer token with "secret-token:" prefix
        // Format: "Bearer secret-token:mercury_production_rma_..."
        const apiKey = this.apiKey.startsWith('secret-token:')
          ? this.apiKey
          : `secret-token:${this.apiKey}`;
        config.headers.Authorization = `Bearer ${apiKey}`;

        // Debug logging to diagnose auth issues
        console.log('[Mercury Client] Auth Debug:');
        console.log('[Mercury Client] - Original key starts with "secret-token:"?', this.apiKey.startsWith('secret-token:'));
        console.log('[Mercury Client] - Original key first 40 chars:', this.apiKey.substring(0, 40));
        console.log('[Mercury Client] - Final Authorization header:', config.headers.Authorization?.substring(0, 50) + '...');

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error: AxiosError<MercuryApiError>) => {
        // Handle different error types
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;

          // 401: Unauthorized (invalid API key)
          if (status === 401) {
            throw new MercuryApiClientError(
              'Invalid or expired API key',
              status,
              'UNAUTHORIZED',
              false // Not transient
            );
          }

          // 429: Rate limit exceeded
          if (status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            throw new MercuryApiClientError(
              `Rate limit exceeded. Retry after ${retryAfter || 'unknown'} seconds`,
              status,
              'RATE_LIMIT',
              true, // Transient error
              retryAfter ? parseInt(retryAfter) : undefined
            );
          }

          // 5xx: Server errors (transient)
          if (status >= 500) {
            throw new MercuryApiClientError(
              data?.error?.message || 'Mercury server error',
              status,
              'SERVER_ERROR',
              true // Transient error
            );
          }

          // 4xx: Client errors (not transient except 429)
          throw new MercuryApiClientError(
            data?.error?.message || 'Client error',
            status,
            data?.error?.type || 'CLIENT_ERROR',
            false
          );
        }

        // Network errors (transient)
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new MercuryApiClientError(
            'Request timeout',
            0,
            'TIMEOUT',
            true
          );
        }

        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          throw new MercuryApiClientError(
            'Network error',
            0,
            'NETWORK_ERROR',
            true
          );
        }

        // Unknown error
        throw new MercuryApiClientError(
          error.message || 'Unknown error',
          0,
          'UNKNOWN',
          false
        );
      }
    );
  }

  /**
   * Get transactions from Mercury
   * @param params - Pagination and filter parameters
   * @returns Mercury transactions response
   */
  async getTransactions(
    params: MercuryPaginationParams = {}
  ): Promise<MercuryTransactionsResponse> {
    return retryWithBackoff(
      async () => {
        const response = await this.client.get<MercuryTransactionsResponse>(
          '/transactions',
          { params }
        );
        return response.data;
      },
      3,
      1000,
      'getTransactions'
    );
  }

  /**
   * Get all checking and savings accounts
   * @returns Array of Mercury accounts
   */
  async getAccounts(): Promise<{ accounts: MercuryAccount[] }> {
    return retryWithBackoff(
      async () => {
        const response = await this.client.get<{ accounts: MercuryAccount[] }>(
          '/accounts'
        );
        return response.data;
      },
      3,
      1000,
      'getAccounts'
    );
  }

  /**
   * Get treasury accounts (separate endpoint)
   * @returns Array of Mercury treasury accounts
   */
  async getTreasuryAccounts(): Promise<MercuryTreasuryAccount[]> {
    return retryWithBackoff(
      async () => {
        try {
          const response = await this.client.get<{ accounts: MercuryTreasuryAccount[] }>(
            '/treasury'
          );
          return response.data.accounts || [];
        } catch (error) {
          // Treasury endpoint might not be available for all accounts
          // Return empty array if 404
          if (error instanceof MercuryApiClientError && error.status === 404) {
            return [];
          }
          throw error;
        }
      },
      3,
      1000,
      'getTreasuryAccounts'
    );
  }

  /**
   * Test API key validity by making a simple API call
   * @returns true if API key is valid, throws error otherwise
   */
  async testConnection(): Promise<boolean> {
    return retryWithBackoff(
      async () => {
        try {
          // Try to fetch accounts with limit=1 to minimize data transfer
          await this.client.get('/accounts', { params: { limit: 1 } });
          return true;
        } catch (error) {
          // Re-throw the error so caller can handle it
          throw error;
        }
      },
      3,
      1000,
      'testConnection'
    );
  }

  /**
   * Get account balance by account ID
   * @param accountId - Mercury account ID
   * @returns Account with balance information
   */
  async getAccountBalance(accountId: string): Promise<{ currentBalance: number; availableBalance: number }> {
    return retryWithBackoff(
      async () => {
        const response = await this.client.get<MercuryAccount>(
          `/account/${accountId}`
        );
        return {
          currentBalance: response.data.currentBalance,
          availableBalance: response.data.availableBalance,
        };
      },
      3,
      1000,
      'getAccountBalance'
    );
  }

  /**
   * Get a single transaction by ID
   * @param transactionId - Mercury transaction ID
   * @returns Transaction details
   */
  async getTransaction(transactionId: string): Promise<MercuryTransaction> {
    return retryWithBackoff(
      async () => {
        const response = await this.client.get<MercuryTransaction>(
          `/transaction/${transactionId}`
        );
        return response.data;
      },
      3,
      1000,
      'getTransaction'
    );
  }
}

/**
 * Custom error class for Mercury API errors
 * Includes information about whether the error is transient (retryable)
 */
export class MercuryApiClientError extends Error {
  public readonly status: number;
  public readonly errorType: string;
  public readonly isTransient: boolean;
  public readonly retryAfter?: number; // Seconds

  constructor(
    message: string,
    status: number,
    errorType: string,
    isTransient: boolean,
    retryAfter?: number
  ) {
    super(message);
    this.name = 'MercuryApiClientError';
    this.status = status;
    this.errorType = errorType;
    this.isTransient = isTransient;
    this.retryAfter = retryAfter;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MercuryApiClientError);
    }
  }
}

/**
 * Helper function to check if error is transient (retryable)
 * @param error - Error to check
 * @returns true if error is transient
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof MercuryApiClientError) {
    return error.isTransient;
  }
  return false;
}
