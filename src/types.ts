/**
 * Type definitions for KeyParty Node.js SDK
 * Based on actual KeyParty API at https://ideal-grouse-601.convex.site
 */

/**
 * JSON-serializable primitive types
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * JSON-serializable value types (recursive)
 */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * JSON-serializable object type
 */
export interface JsonObject {
  [key: string]: JsonValue;
}

/**
 * JSON-serializable array type
 */
export interface JsonArray extends Array<JsonValue> {}

/**
 * Configuration for KeyPartyClient
 */
export interface KeyPartyConfig {
  /** Base URL for KeyParty API (default: https://ideal-grouse-601.convex.site) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 10000ms) */
  timeout?: number;
  /** Number of retry attempts for failed requests (default: 3) */
  retryAttempts?: number;
  /** Delay between retry attempts in milliseconds (default: 1000ms) */
  retryDelay?: number;
  /** Rate limiting configuration */
  rateLimit?: {
    /** Maximum requests allowed */
    maxRequests: number;
    /** Time window in milliseconds */
    perMilliseconds: number;
  };
}

/**
 * Response from credit operations
 */
export interface CreditResponse {
  /** User ID the credits belong to */
  userId: string;
  /** Current credit balance */
  credits: number;
  /** Timestamp of the response */
  timestamp: string;
}

/**
 * Result of a single credit operation (add/deduct/set)
 */
export interface OperationResult {
  /** Operation success status */
  success: boolean;
  /** Previous credit balance before operation */
  previousCredits: number;
  /** New credit balance after operation */
  newCredits: number;
  /** Type of operation performed */
  operation: 'add' | 'deduct' | 'set';
  /** Amount of credits changed */
  amount: number;
  /** Timestamp of the operation */
  timestamp: string;
  /** Optional reason for the operation */
  reason?: string;
}

/**
 * Result of batch operations
 */
export interface BatchOperationResult {
  /** Array of individual operation results */
  operations: OperationResult[];
  /** Number of successful operations */
  totalSuccessful: number;
  /** Number of failed operations */
  totalFailed: number;
  /** Errors encountered during batch operation */
  errors: Array<{ index: number; error: string }>;
}

/**
 * Response from creating a child API key
 */
export interface ChildKeyResponse {
  /** The generated child API key */
  apiKey: string;
  /** External user ID associated with the key */
  externalUserId: string;
  /** Initial credits allocated to the key */
  credits: number;
  /** Optional additional properties from the API (must be JSON-serializable) */
  [key: string]: JsonValue;
}

/**
 * Subscription status types
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'paused' | 'expired';

/**
 * Subscription details
 */
export interface Subscription {
  /** Subscription ID */
  id: string;
  /** Credits added per cycle */
  amount: number;
  /** Cycle duration in days */
  validityDays: number;
  /** Current subscription status */
  status: SubscriptionStatus;
  /** Cycle start timestamp (milliseconds) */
  currentCycleStart: number;
  /** Cycle end timestamp (milliseconds) */
  currentCycleEnd: number;
  /** Next renewal timestamp (milliseconds) */
  nextRenewalAt: number;
  /** Total number of renewals completed */
  renewalCount?: number;
  /** Creation timestamp (milliseconds) */
  createdAt?: number;
}

/**
 * Response from subscription operations (start/stop)
 */
export interface SubscriptionResponse {
  /** Operation success status */
  success: boolean;
  /** Subscription details */
  subscription: Subscription;
  /** Operation message */
  message: string;
  /** External user ID (for multi-tenant operations) */
  externalUserId?: string;
}

/**
 * Response from subscription status query
 */
export interface SubscriptionStatusResponse {
  /** Operation success status */
  success: boolean;
  /** Array of subscriptions */
  subscriptions: Subscription[];
  /** External user ID (for multi-tenant operations) */
  externalUserId?: string;
}

/**
 * API error response structure
 */
export interface KeyPartyApiError {
  /** Error message */
  error: string;
  /** Timestamp of the error */
  timestamp: number;
  /** Success flag (always false for errors) */
  success: false;
}

/**
 * Union type for API responses
 *
 * The API uses mixed response format:
 * - Error responses: wrapped with {success: false, error, timestamp}
 * - Success responses: flat data (no wrapper)
 *
 * This allows the API to return complete data directly for success cases
 * while maintaining structured error responses.
 */
export type KeyPartyApiResponse<T = unknown> = T | KeyPartyApiError;

/**
 * Webhook event types that can trigger notifications
 */
export type WebhookEventType =
  | 'service_key.rotated'
  | 'service_key.created'
  | 'child_key.created'
  | 'child_key.revoked'
  | 'credits.low_threshold'
  | 'credits.exhausted';

/**
 * Webhook retry configuration for failed deliveries
 */
export interface WebhookRetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Initial delay before first retry in milliseconds (default: 1000) */
  initialDelayMs: number;
}

/**
 * Webhook status
 */
export type WebhookStatus = 'enabled' | 'disabled';

/**
 * Webhook delivery status
 */
export type WebhookDeliveryStatus = 'success' | 'failure';

/**
 * Webhook configuration and details
 */
export interface Webhook {
  /** Unique webhook ID */
  id: string;
  /** Webhook name (3-100 characters) */
  name: string;
  /** HTTPS URL to receive webhook events */
  url: string;
  /** Current webhook status */
  status: WebhookStatus;
  /** Array of events this webhook subscribes to */
  events: WebhookEventType[];
  /** Retry configuration for failed deliveries */
  retryConfig: WebhookRetryConfig;
  /** Optional custom HTTP headers to include in webhook requests */
  customHeaders?: Record<string, string>;
  /** Optional description of webhook purpose */
  description?: string;
  /** Credit threshold for low_threshold event (default: 100) */
  lowCreditThreshold?: number;
  /** Timestamp of last successful/failed delivery attempt */
  lastDeliveryAt?: number;
  /** Status of last delivery attempt */
  lastDeliveryStatus?: WebhookDeliveryStatus;
  /** Error message from last failed delivery */
  lastErrorMessage?: string;
  /** Total successful deliveries */
  successCount: number;
  /** Total failed deliveries */
  failureCount: number;
  /** Creation timestamp (milliseconds) */
  createdAt: number;
  /** Last update timestamp (milliseconds) */
  updatedAt: number;
}

/**
 * Request body for creating a webhook
 */
export interface CreateWebhookInput {
  /** Webhook name (3-100 characters) */
  name: string;
  /** HTTPS URL (SSRF protected) */
  url: string;
  /** Events to subscribe to (at least 1 required) */
  events: WebhookEventType[];
  /** Optional description */
  description?: string;
  /** Optional custom HTTP headers */
  customHeaders?: Record<string, string>;
  /** Optional retry configuration (uses defaults if not specified) */
  retryConfig?: Partial<WebhookRetryConfig>;
  /** Credit threshold for low_threshold event (default: 100) */
  lowCreditThreshold?: number;
}

/**
 * Response from webhook creation
 */
export interface CreateWebhookResponse {
  /** Operation success status */
  success: boolean;
  /** Response data */
  data: {
    /** New webhook ID */
    webhookId: string;
    /** Webhook secret - ONLY shown once! Store securely for signature verification */
    secret: string;
  };
  /** Response timestamp */
  timestamp: number;
}

/**
 * Request body for updating a webhook
 */
export interface UpdateWebhookInput {
  /** Updated name */
  name?: string;
  /** Updated URL */
  url?: string;
  /** Updated event subscriptions */
  events?: WebhookEventType[];
  /** Updated status */
  status?: WebhookStatus;
  /** Updated description */
  description?: string;
  /** Updated custom headers */
  customHeaders?: Record<string, string>;
  /** Updated retry configuration */
  retryConfig?: Partial<WebhookRetryConfig>;
  /** Updated credit threshold */
  lowCreditThreshold?: number;
}

/**
 * Response from webhook update/delete operations
 */
export interface WebhookOperationResponse {
  /** Operation success status */
  success: boolean;
  /** Response data */
  data: {
    /** Operation success flag */
    success: boolean;
    /** Operation message */
    message: string;
  };
  /** Response timestamp */
  timestamp: number;
}

/**
 * Response from listing webhooks
 */
export interface ListWebhooksResponse {
  /** Operation success status */
  success: boolean;
  /** Response data */
  data: {
    /** Array of webhooks */
    webhooks: Webhook[];
  };
  /** Response timestamp */
  timestamp: number;
}

/**
 * Response from getting a single webhook
 */
export interface GetWebhookResponse {
  /** Operation success status */
  success: boolean;
  /** Response data */
  data: Webhook;
  /** Response timestamp */
  timestamp: number;
}

/**
 * Response from webhook secret rotation
 */
export interface RotateWebhookSecretResponse {
  /** Operation success status */
  success: boolean;
  /** Response data */
  data: {
    /** New webhook secret - ONLY shown once! */
    secret: string;
    /** Rotation message */
    message: string;
  };
  /** Response timestamp */
  timestamp: number;
}

// ============================================================================
// CHILD API KEY MANAGEMENT TYPES
// ============================================================================

/**
 * Child key environment type
 */
export type ChildKeyEnvironment = 'development' | 'staging' | 'production';

/**
 * Child key status
 */
export type ChildKeyStatus = 'active' | 'revoked';

/**
 * Child key with usage statistics
 */
export interface ChildKey {
  /** Child key ID (not the key itself) */
  id: string;
  /** Masked key hash (e.g., "ck_***abc123") */
  keyHash: string;
  /** Key name/description */
  name: string;
  /** External user ID (your app's user ID) */
  externalUserId: string;
  /** Environment */
  environment: ChildKeyEnvironment;
  /** Current status */
  status: ChildKeyStatus;
  /** Rate limit per minute */
  rateLimitPerMinute: number;
  /** Creation timestamp (milliseconds) */
  createdAt: number;
  /** Last usage timestamp (milliseconds) */
  lastUsedAt?: number;
  /** 24-hour statistics */
  stats24h: {
    /** Total requests in last 24h */
    totalRequests: number;
    /** Total credits consumed in last 24h */
    totalCreditsUsed: number;
    /** Error count in last 24h */
    errorCount: number;
    /** Success rate percentage (0-100) */
    successRate: number;
  };
}

/**
 * Options for listing child keys
 */
export interface ListChildKeysOptions {
  /** Filter by environment */
  environment?: ChildKeyEnvironment;
  /** Include revoked keys */
  includeRevoked?: boolean;
  /** Filter by external user ID */
  externalUserId?: string;
}

/**
 * Response from listing child keys
 */
export interface ListChildKeysResponse {
  /** Operation success status */
  success: boolean;
  /** Response data */
  data: {
    /** Array of child keys */
    childKeys: ChildKey[];
    /** Summary statistics */
    summary: {
      /** Total child keys */
      total: number;
      /** Active keys count */
      active: number;
      /** Revoked keys count */
      revoked: number;
      /** Keys by environment */
      byEnvironment: {
        development: number;
        staging: number;
        production: number;
      };
    };
  };
  /** Response timestamp */
  timestamp: number;
}

/**
 * Response from revoking a child key
 */
export interface RevokeChildKeyResponse {
  /** Operation success status */
  success: boolean;
  /** Response data */
  data: {
    /** Child key ID */
    childKeyId: string;
    /** Previous status */
    previousStatus: 'active';
    /** New status */
    newStatus: 'revoked';
    /** Revocation timestamp (milliseconds) */
    revokedAt: number;
    /** Operation message */
    message: string;
  };
  /** Response timestamp */
  timestamp: number;
}

/**
 * Child key status with detailed metrics
 */
export interface ChildKeyStatusResponse {
  /** Operation success status */
  success: boolean;
  /** Response data */
  data: {
    /** Child key ID */
    id: string;
    /** Masked key hash */
    keyHash: string;
    /** Key name */
    name: string;
    /** External user ID */
    externalUserId: string;
    /** Environment */
    environment: ChildKeyEnvironment;
    /** Current status */
    status: ChildKeyStatus;
    /** Creation timestamp */
    createdAt: number;
    /** Last usage timestamp */
    lastUsedAt?: number;
    /** 24-hour metrics */
    metrics24h: {
      /** Total requests */
      totalRequests: number;
      /** Total credits used */
      totalCreditsUsed: number;
      /** Error count */
      errorCount: number;
      /** Success rate percentage */
      successRate: number;
      /** Average response time (ms) */
      averageResponseTime: number;
      /** Top endpoints by usage */
      topEndpoints: Array<{
        endpoint: string;
        count: number;
        creditsUsed: number;
      }>;
    };
    /** Current credit balance */
    credits: {
      balance: number;
      lastUpdated: number;
    };
    /** Rate limiting information */
    rateLimit: {
      perMinute: number;
      currentUsage: number;
      resetAt: number;
    };
  };
  /** Response timestamp */
  timestamp: number;
}

/**
 * Response from getting/updating child key metadata
 */
export interface ChildKeyMetadataResponse {
  /** Operation success status */
  success: boolean;
  /** Response data */
  data: {
    /** Child key ID */
    childKeyId: string;
    /** Custom metadata */
    metadata: JsonObject;
    /** Creation timestamp */
    createdAt: number;
    /** Last update timestamp */
    updatedAt: number;
  };
  /** Response timestamp */
  timestamp: number;
}

// ============================================================================
// TRANSACTION HISTORY TYPES
// ============================================================================

/**
 * Transaction type
 */
export type TransactionType = 'deduct' | 'increase' | 'set';

/**
 * Transaction status
 */
export type TransactionStatus = 'completed' | 'failed' | 'rolled_back';

/**
 * Transaction performer type
 */
export type TransactionPerformerType = 'service_key' | 'child_key' | 'system';

/**
 * Transaction record
 */
export interface Transaction {
  /** Transaction ID (UUID) */
  id: string;
  /** Transaction type */
  type: TransactionType;
  /** Credit amount */
  amount: number;
  /** Reason for transaction */
  reason: string;
  /** Balance before transaction */
  previousBalance: number;
  /** Balance after transaction */
  newBalance: number;
  /** Transaction status */
  status: TransactionStatus;
  /** Transaction timestamp (milliseconds) */
  timestamp: number;
  /** Optional metadata */
  metadata?: JsonObject;
  /** Who performed the transaction */
  performedBy?: {
    type: TransactionPerformerType;
    keyId?: string;
  };
}

/**
 * Options for querying transaction history
 */
export interface TransactionHistoryOptions {
  /** Maximum results (default: 50, max: 500) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Filter by transaction type */
  type?: TransactionType;
  /** Filter by start date */
  startDate?: Date;
  /** Filter by end date */
  endDate?: Date;
}

/**
 * Response from transaction history query
 */
export interface TransactionHistoryResponse {
  /** Operation success status */
  success: boolean;
  /** Response data */
  data: {
    /** User ID */
    userId: string;
    /** Array of transactions */
    transactions: Transaction[];
    /** Pagination information */
    pagination: {
      /** Total transactions */
      total: number;
      /** Current limit */
      limit: number;
      /** Current offset */
      offset: number;
      /** More results available */
      hasMore: boolean;
    };
  };
  /** Response timestamp */
  timestamp: number;
}

/**
 * Detailed transaction record
 */
export interface DetailedTransaction {
  /** Transaction ID */
  id: string;
  /** User ID */
  userId: string;
  /** Transaction type */
  type: TransactionType;
  /** Credit amount */
  amount: number;
  /** Reason for transaction */
  reason: string;
  /** Balance before transaction */
  previousBalance: number;
  /** Balance after transaction */
  newBalance: number;
  /** Transaction status */
  status: TransactionStatus;
  /** Start timestamp (milliseconds) */
  startedAt: number;
  /** Completion timestamp (milliseconds) */
  completedAt?: number;
  /** Optional metadata */
  metadata?: JsonObject;
}

/**
 * Response from getting transaction by ID
 */
export interface TransactionResponse {
  /** Operation success status */
  success: boolean;
  /** Response data */
  data: DetailedTransaction;
  /** Response timestamp */
  timestamp: number;
}
