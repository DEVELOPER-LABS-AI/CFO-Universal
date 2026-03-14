/**
 * Mercury Banking Integration Type Definitions
 * Based on Mercury API v1 documentation
 */

// ============================================================================
// Mercury API Response Types
// ============================================================================

/**
 * Mercury Transaction from API
 * @see https://docs.mercury.com/reference/transactions-1
 */
export interface MercuryTransaction {
  id: string;
  amount: number; // In dollars (USD)
  bankDescription: string | null;
  counterpartyId: string;
  counterpartyName: string;
  counterpartyNickname: string | null;
  createdAt: string; // ISO 8601 timestamp
  dashboardLink: string;
  details: MercuryTransactionDetails;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  kind: 'externalTransfer' | 'internalTransfer' | 'debitCardTransaction' | 'fee' | 'other';
}

export interface MercuryTransactionDetails {
  address?: Address;
  domesticWireRoutingInfo?: DomesticWireInfo;
  electronicRoutingInfo?: ACHInfo;
  internationalWireRoutingInfo?: InternationalWireInfo;
}

export interface Address {
  address1: string;
  address2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface DomesticWireInfo {
  routingNumber: string;
  accountNumber: string;
}

export interface ACHInfo {
  routingNumber: string;
  accountNumber: string;
}

export interface InternationalWireInfo {
  swiftCode: string;
  accountNumber: string;
}

/**
 * Mercury Transactions API Response
 */
export interface MercuryTransactionsResponse {
  total: number;
  transactions: MercuryTransaction[];
}

/**
 * Mercury Account from API
 */
export interface MercuryAccount {
  id: string;
  name: string;
  type: 'checking' | 'savings';
  availableBalance: number; // In dollars
  currentBalance: number; // In dollars
  createdAt: string;
  status: 'active' | 'deleted' | 'pending' | 'archived';
  accountNumber?: string;
  routingNumber?: string;
}

/**
 * Mercury Treasury Account from API
 */
export interface MercuryTreasuryAccount {
  id: string;
  name: string;
  type: 'treasury';
  availableBalance: number;
  currentBalance: number;
  createdAt: string;
  status: 'active' | 'deleted' | 'pending' | 'archived';
}

// ============================================================================
// Database Types (matches Prisma schema)
// ============================================================================

export type MercuryConnectionStatus = 'ACTIVE' | 'DISCONNECTED' | 'API_ERROR';
export type MercurySyncType = 'TRANSACTIONS' | 'BALANCES' | 'FULL';
export type MercurySyncStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
export type MercurySyncTrigger = 'SYSTEM' | 'MANUAL' | 'RETRY';
export type MappingConfidence = 'EXACT' | 'FUZZY' | 'MANUAL';
export type MappingSource = 'SYSTEM' | 'ADMIN_USER';
export type CategorizationRuleType = 'MERCHANT_NAME' | 'DESCRIPTION_KEYWORD' | 'AMOUNT_RANGE';
export type MercuryAccountType = 'CHECKING' | 'SAVINGS' | 'TREASURY';
export type ExpenseRecordSyncStatus = 'MANUAL' | 'SYNCED' | 'CATEGORIZATION_FAILED' | 'MAPPING_FAILED';
export type MerchantMappingMode = 'SINGLE' | 'PER_TRANSACTION';

// ============================================================================
// Sync Error Types
// ============================================================================

export interface SyncError {
  type: 'API_ERROR' | 'MAPPING_FAILURE' | 'CATEGORIZATION_FAILURE' | 'VALIDATION_ERROR' | 'RATE_LIMIT';
  message: string;
  context?: {
    transaction_id?: string;
    merchant_name?: string;
    http_status?: number;
    retry_count?: number;
  };
  timestamp: string; // ISO 8601
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Connect Mercury API Key Request
 */
export interface ConnectMercuryRequest {
  apiKey: string;
  organizationId: string;
}

/**
 * Connect Mercury Response
 */
export interface ConnectMercuryResponse {
  success: boolean;
  connection: {
    id: string;
    organization_id: string;
    connection_status: MercuryConnectionStatus;
    created_at: string;
  };
  message?: string;
}

/**
 * Disconnect Mercury Request
 */
export interface DisconnectMercuryRequest {
  organizationId: string;
}

/**
 * Mercury Sync Request
 */
export interface MercurySyncRequest {
  organizationId: string;
  syncType?: MercurySyncType;
  triggeredBy?: MercurySyncTrigger;
}

/**
 * Mercury Sync Response
 */
export interface MercurySyncResponse {
  success: boolean;
  syncLog: {
    id: string;
    status: MercurySyncStatus;
    started_at: string;
    transactions_processed?: number;
    balances_updated?: number;
  };
  message?: string;
}

/**
 * Mercury Connection Status Response
 */
export interface MercuryConnectionStatusResponse {
  connected: boolean;
  connection?: {
    id: string;
    organization_id: string;
    connection_status: MercuryConnectionStatus;
    last_sync_at: string | null;
    last_sync_status: MercurySyncStatus | null;
    created_at: string;
  };
  error?: string;
}

// ============================================================================
// Merchant Mapping Types
// ============================================================================

export interface MerchantMapping {
  id: string;
  connection_id: string;
  mercury_merchant_name: string;
  normalized_merchant_name: string;
  contractor_id: string | null;
  mapping_confidence: MappingConfidence;
  confidence_score: number | null;
  mapped_by: MappingSource;
  mapped_at: string;
}

export interface UnmappedMerchant {
  mercury_merchant_name: string;
  normalized_merchant_name: string;
  transaction_count: number;
  total_amount: number;
  first_seen: string;
  last_seen: string;
}

export interface MapMerchantRequest {
  merchantName: string;
  contractorId: string;
  organizationId: string;
}

// ============================================================================
// Categorization Types
// ============================================================================

export interface CategorizationRule {
  id: string;
  organization_id: string;
  rule_type: CategorizationRuleType;
  pattern: string;
  category: string;
  priority: number;
  is_active: boolean;
  created_at: string;
}

export interface CategorizationResult {
  category: string;
  confidence: number;
  rule_id?: string;
  contractor_id?: string;
  subscription_id?: string;
  agency_id?: string;
  client_id?: string;
  expense_category_id?: string;
  staff_id?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Pagination parameters for Mercury API
 */
export interface MercuryPaginationParams {
  limit?: number;
  offset?: number;
  start_after?: string; // Cursor for next page
  end_before?: string; // Cursor for previous page
  start?: string; // Filter by earliest createdAt date (YYYY-MM-DD or ISO 8601)
  end?: string; // Filter by latest createdAt date (YYYY-MM-DD or ISO 8601)
}

/**
 * Date range filter for transactions
 */
export interface MercuryDateRangeFilter {
  start?: string; // ISO 8601 date
  end?: string; // ISO 8601 date
}

/**
 * Mercury API Error Response
 */
export interface MercuryApiError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
  status: number;
}

/**
 * Transaction sync result
 */
export interface TransactionSyncResult {
  success: boolean;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{
    transaction_id: string;
    error: string;
  }>;
  duration_ms: number;
  /** Cursor for next batch — if present, more transactions remain to be synced */
  nextCursor?: string;
  /** Whether this is a partial result with more batches to follow */
  hasMore?: boolean;
}

/**
 * Transaction sync progress
 */
export interface TransactionSyncProgress {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  currentMerchant: string;
  percentage: number;
}

// ============================================================================
// Mercury Recipient Types (Feature 6: Contractor Payment Portal)
// ============================================================================

/**
 * Mercury Recipient from API
 */
export interface MercuryRecipient {
  id: string;
  name: string;
  emails: string[];
  defaultPaymentMethod: 'ach' | 'domesticWire' | 'internationalWire' | 'check';
  electronicRoutingInfo?: {
    accountNumber: string;
    routingNumber: string;
    bankName?: string;
    address?: Address;
  };
  domesticWireRoutingInfo?: {
    accountNumber: string;
    routingNumber: string;
    address?: Address;
  };
  status?: string;
}

/**
 * Payload for requesting money to be sent via Mercury approval queue
 */
export interface RequestSendMoneyPayload {
  recipientId: string;
  amount: number;
  paymentMethod: 'ach' | 'domesticWire' | 'check';
  memo?: string;
  idempotencyKey?: string;
}

/**
 * Response from request-send-money endpoint
 */
export interface SendMoneyResponse {
  id: string;
  status: string;
  amount: number;
  recipientId: string;
  createdAt: string;
}

/**
 * Payload for creating a new Mercury recipient
 */
export interface CreateRecipientPayload {
  name: string;
  emails?: string[];
  defaultPaymentMethod: 'ach' | 'domesticWire' | 'internationalWire' | 'check';
  electronicRoutingInfo?: {
    accountNumber: string;
    routingNumber: string;
  };
  domesticWireRoutingInfo?: {
    accountNumber: string;
    routingNumber: string;
    address?: Address;
  };
}
