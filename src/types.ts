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
