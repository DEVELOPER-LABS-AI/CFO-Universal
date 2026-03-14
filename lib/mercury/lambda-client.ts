/**
 * Lambda-based Mercury API Client
 * Routes all Mercury API calls through AWS Lambda with whitelisted static IP (52.1.18.251)
 * Solves IP whitelisting requirement for Mercury API
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { getErrorMessage } from '@/lib/utils/error';
import type {
  MercuryTransaction,
  MercuryTransactionsResponse,
  MercuryAccount,
  MercuryTreasuryAccount,
  MercuryPaginationParams,
  MercuryRecipient,
  RequestSendMoneyPayload,
  SendMoneyResponse,
  CreateRecipientPayload,
} from '@/types/mercury';

/**
 * Mercury API Client using Lambda Proxy
 * All API calls are routed through AWS Lambda with static IP 52.1.18.251
 */
export class LambdaMercuryClient {
  private lambdaClient: LambdaClient;
  private apiKey: string;
  private functionName: string;

  /**
   * Create a new Lambda-based Mercury API client
   * @param apiKey - Mercury API key (can include secret-token: prefix or not)
   */
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.functionName = 'mercury-sync';

    this.lambdaClient = new LambdaClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  /**
   * Invoke Lambda proxy to make Mercury API call
   */
  private async invokeLambdaProxy(
    method: string,
    path: string,
    params?: Record<string, any>
  ): Promise<any> {
    console.log(`[Lambda Mercury Client] Invoking Lambda proxy: ${method} ${path}`);

    const payload = {
      action: 'proxy',
      method,
      path,
      apiKey: this.apiKey,
      params: params || {},
    };

    const command = new InvokeCommand({
      FunctionName: this.functionName,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(payload),
    });

    const lambdaResponse = await this.lambdaClient.send(command);

    if (!lambdaResponse.Payload) {
      throw new Error('No response from Lambda proxy');
    }

    const responsePayload = JSON.parse(new TextDecoder().decode(lambdaResponse.Payload));

    // Lambda returns { statusCode, headers, body }
    const responseBody = typeof responsePayload.body === 'string'
      ? JSON.parse(responsePayload.body)
      : responsePayload.body;

    console.log(`[Lambda Mercury Client] Response status: ${responsePayload.statusCode}`);

    if (responsePayload.statusCode !== 200) {
      const error = new Error(responseBody.error || `Request failed with status ${responsePayload.statusCode}`);
      (error as any).status = responsePayload.statusCode;
      (error as any).errorType = responseBody.errorType || 'MERCURY_API_ERROR';
      throw error;
    }

    return responseBody.data;
  }

  /**
   * Get transactions from Mercury
   */
  async getTransactions(
    params: MercuryPaginationParams = {}
  ): Promise<MercuryTransactionsResponse> {
    return this.invokeLambdaProxy('GET', '/api/v1/transactions', params);
  }

  /**
   * Get all checking and savings accounts
   */
  async getAccounts(): Promise<{ accounts: MercuryAccount[] }> {
    return this.invokeLambdaProxy('GET', '/api/v1/accounts');
  }

  /**
   * Get treasury accounts (separate endpoint)
   */
  async getTreasuryAccounts(): Promise<MercuryTreasuryAccount[]> {
    try {
      const response = await this.invokeLambdaProxy('GET', '/api/v1/treasury');
      return response.accounts || [];
    } catch (error: unknown) {
      // Treasury endpoint might not be available for all accounts
      if (error instanceof Error && (error as any).status === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Test API key validity by making a simple API call
   */
  async testConnection(): Promise<boolean> {
    await this.invokeLambdaProxy('GET', '/api/v1/accounts', { limit: 1 });
    return true;
  }

  /**
   * Get account balance by account ID
   */
  async getAccountBalance(accountId: string): Promise<{ currentBalance: number; availableBalance: number }> {
    const response = await this.invokeLambdaProxy('GET', `/api/v1/account/${accountId}`);
    return {
      currentBalance: response.currentBalance,
      availableBalance: response.availableBalance,
    };
  }

  /**
   * Get a single transaction by ID
   */
  async getTransaction(transactionId: string): Promise<MercuryTransaction> {
    return this.invokeLambdaProxy('GET', `/api/v1/transaction/${transactionId}`);
  }

  // ==========================================================================
  // Feature 6: Contractor Payment Portal — Payment & Recipient Methods
  // ==========================================================================

  /**
   * Request money to be sent (creates approval request in Mercury dashboard)
   * Uses Custom token with RequestSendMoney scope
   * @param accountId - Mercury checking account ID
   * @param payload - Payment request details
   */
  async requestSendMoney(
    accountId: string,
    payload: RequestSendMoneyPayload
  ): Promise<SendMoneyResponse> {
    return this.invokeLambdaProxy('POST', `/api/v1/account/${accountId}/request-send-money`, payload);
  }

  /**
   * Get all recipients from Mercury
   * @param params - Optional filter params
   */
  async getRecipients(params?: Record<string, any>): Promise<{ recipients: MercuryRecipient[] }> {
    return this.invokeLambdaProxy('GET', '/api/v1/recipients', params);
  }

  /**
   * Create a new recipient in Mercury
   * Requires Read & Write token + IP whitelist (routed via Lambda proxy)
   * @param payload - Recipient creation details
   */
  async createRecipient(payload: CreateRecipientPayload): Promise<MercuryRecipient> {
    return this.invokeLambdaProxy('POST', '/api/v1/recipients', payload);
  }
}
