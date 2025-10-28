/**
 * KeyParty Client - Node.js SDK for credit management
 *
 * Usage:
 * ```typescript
 * const client = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY);
 * const credits = await client.getCredits('user_123');
 * await client.addCredits('user_123', 10, 'Signup bonus');
 * ```
 */

import type {
  KeyPartyConfig,
  CreditResponse,
  OperationResult,
  BatchOperationResult,
  KeyPartyApiResponse,
  ChildKeyResponse,
  JsonObject,
} from './types.js';
import {
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NetworkError,
  UserNotFoundError,
  InsufficientCreditsError,
  RateLimitError,
} from './errors.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<KeyPartyConfig, 'rateLimit'>> & { rateLimit?: KeyPartyConfig['rateLimit'] } = {
  baseUrl: 'https://ideal-grouse-601.convex.site',
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
};

/**
 * KeyParty Client for credit management operations
 */
export class KeyPartyClient {
  private serviceKey: string;
  private config: Required<Omit<KeyPartyConfig, 'rateLimit'>> & { rateLimit?: KeyPartyConfig['rateLimit'] };

  /**
   * Create a new KeyParty client instance
   *
   * @param serviceKey - Service key for authentication (starts with 'sk_')
   * @param config - Optional configuration overrides
   *
   * @example
   * ```typescript
   * const client = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY, {
   *   timeout: 15000,
   *   retryAttempts: 5
   * });
   * ```
   */
  constructor(serviceKey: string, config?: KeyPartyConfig) {
    // Validate service key
    if (!serviceKey || typeof serviceKey !== 'string') {
      throw new ValidationError('Service key is required');
    }
    if (!serviceKey.startsWith('sk_')) {
      throw new ValidationError('Service key must start with "sk_"');
    }

    this.serviceKey = serviceKey;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Make HTTP request to KeyParty API with retry logic
   *
   * This method handles:
   * - Automatic retries for network errors (up to retryAttempts)
   * - Request timeouts via AbortController
   * - API-level error handling (user not found, auth errors, insufficient credits)
   * - HTTP-level error handling (401, 429, etc.)
   *
   * @param method - HTTP method (GET, POST, PUT, DELETE)
   * @param path - API endpoint path (e.g., '/api/credits/get')
   * @param body - Request body as JSON-serializable object
   * @returns Promise resolving to API response data
   * @throws ValidationError, AuthenticationError, UserNotFoundError, InsufficientCreditsError, NetworkError
   */
  private async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: JsonObject
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    let lastError: Error | null = null;

    // Retry loop: attempt 0 is initial try, then up to retryAttempts additional tries
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Setup request timeout using AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.serviceKey,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Always try to parse JSON body first (works for both success and error responses)
        let data: KeyPartyApiResponse<T>;
        try {
          data = await response.json() as KeyPartyApiResponse<T>;
        } catch {
          // If JSON parsing fails, fall back to HTTP status code handling
          if (!response.ok) {
            if (response.status === 401) {
              throw new AuthenticationError('Invalid service key');
            }
            if (response.status === 429) {
              throw new RateLimitError('Rate limit exceeded');
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          throw new Error('Invalid response format: expected JSON');
        }

        // Check for error response (works regardless of HTTP status code)
        if (this.isErrorResponse(data)) {
          // Check HTTP status codes first for proper error typing
          if (!response.ok) {
            if (response.status === 401) {
              throw new AuthenticationError('Invalid service key');
            }
            if (response.status === 403) {
              throw new ForbiddenError(data.error || 'Operation forbidden for this key type');
            }
            if (response.status === 429) {
              throw new RateLimitError('Rate limit exceeded');
            }
            if (response.status === 402) {
              // Payment required - check for insufficient credits
              if (data.error?.includes('Insufficient credits')) {
                throw new InsufficientCreditsError(data.error);
              }
            }
          }

          // Check error message patterns for semantic errors
          if (data.error?.includes('User not found')) {
            throw new UserNotFoundError(String(body?.userId || 'unknown'));
          }
          if (data.error?.includes('Missing API key')) {
            throw new AuthenticationError(data.error);
          }
          if (data.error?.includes('Insufficient credits')) {
            throw new InsufficientCreditsError(data.error);
          }
          throw new Error(data.error);
        }

        // Success response is flat - return directly (no unwrapping)
        return data as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on validation, auth, or business logic errors (these won't be fixed by retrying)
        if (
          error instanceof ValidationError ||
          error instanceof AuthenticationError ||
          error instanceof ForbiddenError ||
          error instanceof UserNotFoundError ||
          error instanceof InsufficientCreditsError ||
          error instanceof RateLimitError
        ) {
          throw error;
        }

        // Retry on network errors (timeout, connection failed, etc.)
        // Only retry if we haven't exceeded retryAttempts
        if (attempt < this.config.retryAttempts) {
          await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
          continue;
        }
      }
    }

    // If we've exhausted all retry attempts, throw NetworkError with original error
    throw new NetworkError('Max retry attempts exceeded', { originalError: lastError });
  }

  /**
   * Type guard to detect wrapped error responses
   *
   * The API uses mixed response format:
   * - Error responses: {success: false, error: string, timestamp: number}
   * - Success responses: flat data (no wrapper)
   *
   * @param data - Response data to check
   * @returns True if data is an error response
   */
  private isErrorResponse(data: unknown): data is { success: false; error: string; timestamp: number } {
    return typeof data === 'object' &&
           data !== null &&
           'success' in data &&
           data.success === false;
  }

  /**
   * Validate user ID input
   */
  private validateUserId(userId: string): void {
    if (typeof userId !== 'string') {
      throw new ValidationError('userId is required and must be a string');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('userId cannot be empty or whitespace');
    }
    if (userId.length > 255) {
      throw new ValidationError('userId must be 255 characters or less');
    }
  }

  /**
   * Validate amount for credit operations
   *
   * @param amount - The credit amount to validate
   * @param allowZero - If true, allows 0 (for setCredits). If false, requires positive integer (for add/deduct)
   */
  private validateAmount(amount: number, allowZero: boolean = false): void {
    // Must be a whole number (integers only, no decimals)
    if (typeof amount !== 'number' || !Number.isInteger(amount)) {
      throw new ValidationError('amount must be an integer');
    }
    // For add/deduct operations: must be positive (> 0)
    if (!allowZero && amount <= 0) {
      throw new ValidationError('amount must be positive');
    }
    // For set operations: must be non-negative (>= 0)
    if (allowZero && amount < 0) {
      throw new ValidationError('amount cannot be negative');
    }
  }

  /**
   * Get current credit balance for a user
   *
   * Returns flat response from API with server-authoritative timestamp.
   *
   * @param userId - User identifier
   * @returns Current credit information with server timestamp
   *
   * @example
   * ```typescript
   * const credits = await client.getCredits('user_123');
   * console.log(`Balance: ${credits.credits}`);
   * console.log(`Server time: ${credits.timestamp}`);
   * ```
   */
  async getCredits(userId: string): Promise<CreditResponse> {
    this.validateUserId(userId);

    // API returns flat {userId, credits, timestamp} - no wrapper
    return this.request<CreditResponse>('POST', '/api/credits/get', {
      userId,
    });
  }

  /**
   * Add credits to a user's balance
   *
   * Single API call returns complete OperationResult with server-authoritative data.
   * Performance: 66% improvement over old 3-call pattern.
   *
   * @param userId - User identifier
   * @param amount - Number of credits to add (must be positive integer)
   * @param reason - Optional reason for adding credits
   * @returns Complete operation result from server (previousCredits, newCredits, timestamp)
   *
   * @example
   * ```typescript
   * const result = await client.addCredits('user_123', 10, 'Signup bonus');
   * console.log(`Previous: ${result.previousCredits}, New: ${result.newCredits}`);
   * console.log(`Server timestamp: ${result.timestamp}`);
   * ```
   */
  async addCredits(userId: string, amount: number, reason?: string): Promise<OperationResult> {
    this.validateUserId(userId);
    this.validateAmount(amount);

    // Single API call returns complete OperationResult with all data
    return this.request<OperationResult>('POST', '/api/credits/add', {
      userId,
      amount,
      reason: reason || 'Credit addition',
    });
  }

  /**
   * Deduct credits from a user's balance
   *
   * Single API call returns complete OperationResult with server-authoritative data.
   * Performance: 66% improvement over old 3-call pattern.
   *
   * @param userId - User identifier
   * @param amount - Number of credits to deduct (must be positive integer)
   * @param reason - Optional reason for deducting credits
   * @returns Complete operation result from server (previousCredits, newCredits, timestamp)
   *
   * @example
   * ```typescript
   * const result = await client.deductCredits('user_123', 5, 'API usage');
   * console.log(`Remaining: ${result.newCredits}`);
   * console.log(`Server timestamp: ${result.timestamp}`);
   * ```
   */
  async deductCredits(userId: string, amount: number, reason?: string): Promise<OperationResult> {
    this.validateUserId(userId);
    this.validateAmount(amount);

    // Single API call returns complete OperationResult with all data
    return this.request<OperationResult>('POST', '/api/credits/deduct', {
      userId,
      amount,
      reason: reason || 'Credit deduction',
    });
  }

  /**
   * Set user's credit balance to a specific value
   *
   * Single API call returns complete OperationResult with server-authoritative data.
   * Performance: 66% improvement over old 3-call pattern.
   *
   * @param userId - User identifier
   * @param amount - New credit balance (can be zero, must be non-negative)
   * @param reason - Optional reason for setting credits
   * @returns Complete operation result from server (previousCredits, newCredits, timestamp)
   *
   * @example
   * ```typescript
   * const result = await client.setCredits('user_123', 100, 'Account reset');
   * console.log(`Previous: ${result.previousCredits}, Set to: ${result.newCredits}`);
   * console.log(`Server timestamp: ${result.timestamp}`);
   * ```
   */
  async setCredits(userId: string, amount: number, reason?: string): Promise<OperationResult> {
    this.validateUserId(userId);
    this.validateAmount(amount, true); // Allow zero for set operation

    // Single API call returns complete OperationResult with all data
    return this.request<OperationResult>('POST', '/api/credits/set', {
      userId,
      amount,
      reason: reason || 'Credit balance update',
    });
  }

  /**
   * Perform batch operations (add or deduct) concurrently
   * Tests race conditions and KeyParty's locking/transaction model
   *
   * @param operation - Operation type ('add' or 'deduct')
   * @param userId - User identifier
   * @param count - Number of concurrent operations (1-100)
   * @param reason - Optional reason for operations
   * @returns Batch operation results
   *
   * @example
   * ```typescript
   * // Test concurrent operations
   * const results = await client.batchOperation('add', 'user_123', 5, 'Stress test');
   * console.log(`${results.totalSuccessful} succeeded, ${results.totalFailed} failed`);
   * ```
   */
  async batchOperation(
    operation: 'add' | 'deduct',
    userId: string,
    count: number,
    reason?: string
  ): Promise<BatchOperationResult> {
    this.validateUserId(userId);

    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new ValidationError('count must be between 1 and 100');
    }

    // Create array of concurrent operations
    const operations = Array.from({ length: count }, () => {
      return operation === 'add'
        ? this.addCredits(userId, 1, reason || `Batch ${operation}`)
        : this.deductCredits(userId, 1, reason || `Batch ${operation}`);
    });

    // Execute all operations concurrently using Promise.allSettled
    const results = await Promise.allSettled(operations);

    const operationResults: OperationResult[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    let totalSuccessful = 0;
    let totalFailed = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        operationResults.push(result.value);
        totalSuccessful++;
      } else {
        errors.push({
          index,
          error: result.reason?.message || String(result.reason),
        });
        totalFailed++;
      }
    });

    return {
      operations: operationResults,
      totalSuccessful,
      totalFailed,
      errors,
    };
  }

  /**
   * Create a child API key for a user with initial credits
   *
   * @param externalUserId - User identifier for the child key
   * @param initialCredits - Initial credits to allocate (must be positive integer)
   * @param options - Optional configuration for the child key
   * @returns Child key information including apiKey, externalUserId, and credits
   *
   * @example
   * ```typescript
   * const childKey = await client.createChildKey('user_123', 1000, {
   *   name: 'Production API Key',
   *   environment: 'production',
   *   metadata: { plan: 'premium', tier: 'business' }
   * });
   * console.log(`Created key: ${childKey.apiKey}`);
   * ```
   */
  async createChildKey(
    externalUserId: string,
    initialCredits: number,
    options?: {
      name?: string;
      environment?: 'development' | 'staging' | 'production';
      metadata?: JsonObject;
    }
  ): Promise<ChildKeyResponse> {
    // Validate required parameters
    this.validateUserId(externalUserId);
    this.validateAmount(initialCredits);

    // Extract and validate optional parameters
    const name = options?.name;
    const environment = options?.environment || 'production';
    const metadata = options?.metadata;

    // Validate custom name if provided
    if (name !== undefined) {
      if (typeof name !== 'string') {
        throw new ValidationError('name must be a string');
      }
      if (name.trim().length === 0) {
        throw new ValidationError('name cannot be empty or whitespace');
      }
      if (name.length > 255) {
        throw new ValidationError('name must be 255 characters or less');
      }
    }

    // Validate metadata if provided
    if (metadata !== undefined) {
      if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
        throw new ValidationError('metadata must be an object');
      }

      // Check JSON serializability
      let serialized: string;
      try {
        serialized = JSON.stringify(metadata);
      } catch {
        throw new ValidationError('metadata must be JSON-serializable');
      }

      // Check size limit (10KB)
      if (serialized.length > 10000) {
        throw new ValidationError('metadata size must be 10KB or less when serialized');
      }
    }

    // Set default name if not provided
    const finalName = name || `${externalUserId} API Key`;

    // Make API request
    return await this.request('POST', '/api/keys/create', {
      name: finalName,
      environment,
      externalUserId,
      credits: initialCredits,
      ...(metadata && { metadata }),
    });
  }
}
