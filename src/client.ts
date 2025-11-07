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
  SubscriptionResponse,
  SubscriptionStatusResponse,
  CreateWebhookInput,
  CreateWebhookResponse,
  UpdateWebhookInput,
  WebhookOperationResponse,
  ListWebhooksResponse,
  GetWebhookResponse,
  RotateWebhookSecretResponse,
  WebhookStatus,
  ListChildKeysOptions,
  ListChildKeysResponse,
  RevokeChildKeyResponse,
  ChildKeyStatusResponse,
  ChildKeyMetadataResponse,
  TransactionHistoryOptions,
  TransactionHistoryResponse,
  TransactionResponse,
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
   * @param method - HTTP method (GET, POST, PUT, PATCH, DELETE)
   * @param path - API endpoint path (e.g., '/api/credits/get')
   * @param body - Request body as JSON-serializable object
   * @returns Promise resolving to API response data
   * @throws ValidationError, AuthenticationError, UserNotFoundError, InsufficientCreditsError, NetworkError
   */
  private async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
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

  /**
   * Start a recurring credit subscription
   *
   * Creates a subscription that automatically adds credits at regular intervals.
   * The first allocation happens immediately upon creation.
   *
   * @param userId - User ID to create subscription for
   * @param amount - Credits to add per cycle
   * @param validityDays - Cycle duration in days (default: 31)
   * @param metadata - Optional metadata for the subscription
   * @returns Subscription details including ID and renewal dates
   *
   * @throws {ValidationError} If parameters are invalid
   * @throws {AuthenticationError} If service key is invalid
   * @throws {ForbiddenError} If child key attempts this operation
   *
   * @example
   * ```typescript
   * const sub = await client.startSubscription('user_123', 500, 31);
   * console.log(`Next renewal: ${new Date(sub.subscription.nextRenewalAt)}`);
   * ```
   */
  async startSubscription(
    userId: string,
    amount: number,
    validityDays: number = 31,
    metadata?: JsonObject
  ): Promise<SubscriptionResponse> {
    this.validateUserId(userId);
    this.validateAmount(amount);

    if (validityDays <= 0 || validityDays > 365) {
      throw new ValidationError('validityDays must be between 1 and 365');
    }

    return await this.request('POST', '/api/subscriptions/start', {
      serviceApiKey: this.serviceKey,
      amount,
      validityDays,
      ...(metadata && { metadata }),
    });
  }

  /**
   * Stop (cancel) a recurring subscription
   *
   * Cancels future renewals. Credits remain valid until current cycle ends.
   *
   * @param userId - User ID
   * @param subscriptionId - Subscription ID to cancel
   * @returns Updated subscription details
   *
   * @throws {ValidationError} If parameters are invalid
   * @throws {AuthenticationError} If service key is invalid
   * @throws {UserNotFoundError} If subscription doesn't exist
   *
   * @example
   * ```typescript
   * await client.stopSubscription('user_123', 'subscription_id');
   * ```
   */
  async stopSubscription(
    userId: string,
    subscriptionId: string
  ): Promise<SubscriptionResponse> {
    this.validateUserId(userId);

    if (!subscriptionId || typeof subscriptionId !== 'string') {
      throw new ValidationError('subscriptionId is required');
    }

    return await this.request('POST', '/api/subscriptions/stop', {
      serviceApiKey: this.serviceKey,
      subscriptionId,
    });
  }

  /**
   * Get subscription status for a user
   *
   * Returns all subscriptions (active, canceled, paused) for the specified user.
   *
   * @param userId - User ID to query
   * @returns Array of all subscriptions with status and renewal dates
   *
   * @throws {ValidationError} If userId is invalid
   * @throws {AuthenticationError} If service key is invalid
   *
   * @example
   * ```typescript
   * const status = await client.getSubscriptionStatus('user_123');
   * const active = status.subscriptions.filter(s => s.status === 'active');
   * ```
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatusResponse> {
    this.validateUserId(userId);

    const params = new URLSearchParams({ serviceApiKey: this.serviceKey });
    return await this.request('GET', `/api/subscriptions/status?${params.toString()}`);
  }

  /**
   * Start subscription for external user (multi-tenant)
   *
   * Service owners can create subscriptions for their own users using externalUserId.
   *
   * @param externalUserId - Your application's user ID
   * @param amount - Credits per cycle
   * @param validityDays - Cycle duration (default: 31)
   * @param metadata - Optional metadata
   * @returns Subscription details
   *
   * @throws {ValidationError} If parameters are invalid
   * @throws {AuthenticationError} If service key is invalid
   * @throws {UserNotFoundError} If external user has no child key
   *
   * @example
   * ```typescript
   * const sub = await client.startExternalUserSubscription('app_user_456', 500, 31);
   * ```
   */
  async startExternalUserSubscription(
    externalUserId: string,
    amount: number,
    validityDays: number = 31,
    metadata?: JsonObject
  ): Promise<SubscriptionResponse> {
    this.validateUserId(externalUserId);
    this.validateAmount(amount);

    if (validityDays <= 0 || validityDays > 365) {
      throw new ValidationError('validityDays must be between 1 and 365');
    }

    return await this.request('POST', '/api/external-user/subscriptions/start', {
      serviceApiKey: this.serviceKey,
      externalUserId,
      amount,
      validityDays,
      ...(metadata && { metadata }),
    });
  }

  /**
   * Stop subscription for external user
   *
   * @param externalUserId - Your application's user ID
   * @param subscriptionId - Subscription ID to cancel
   * @returns Updated subscription details
   *
   * @throws {ValidationError} If parameters are invalid
   * @throws {AuthenticationError} If service key is invalid
   *
   * @example
   * ```typescript
   * await client.stopExternalUserSubscription('app_user_456', 'sub_id');
   * ```
   */
  async stopExternalUserSubscription(
    externalUserId: string,
    subscriptionId: string
  ): Promise<SubscriptionResponse> {
    this.validateUserId(externalUserId);

    if (!subscriptionId || typeof subscriptionId !== 'string') {
      throw new ValidationError('subscriptionId is required');
    }

    return await this.request('POST', '/api/external-user/subscriptions/stop', {
      serviceApiKey: this.serviceKey,
      externalUserId,
      subscriptionId,
    });
  }

  /**
   * Get subscription status for external user
   *
   * @param externalUserId - Your application's user ID
   * @returns Array of subscriptions for this external user
   *
   * @throws {ValidationError} If externalUserId is invalid
   * @throws {AuthenticationError} If service key is invalid
   *
   * @example
   * ```typescript
   * const status = await client.getExternalUserSubscriptionStatus('app_user_456');
   * ```
   */
  async getExternalUserSubscriptionStatus(
    externalUserId: string
  ): Promise<SubscriptionStatusResponse> {
    this.validateUserId(externalUserId);

    const params = new URLSearchParams({
      serviceApiKey: this.serviceKey,
      externalUserId,
    });
    return await this.request('GET', `/api/external-user/subscriptions/status?${params.toString()}`);
  }

  // ============================================================================
  // WEBHOOK METHODS
  // ============================================================================

  /**
   * Validate webhook name
   */
  private validateWebhookName(name: string): void {
    if (typeof name !== 'string') {
      throw new ValidationError('name must be a string');
    }
    if (name.trim().length < 3) {
      throw new ValidationError('name must be at least 3 characters');
    }
    if (name.length > 100) {
      throw new ValidationError('name must be 100 characters or less');
    }
  }

  /**
   * Validate webhook URL
   */
  private validateWebhookUrl(url: string): void {
    if (typeof url !== 'string') {
      throw new ValidationError('url must be a string');
    }
    if (!url.startsWith('https://')) {
      throw new ValidationError('url must use HTTPS protocol');
    }
    try {
      new URL(url);
    } catch {
      throw new ValidationError('url must be a valid URL');
    }
  }

  /**
   * Validate webhook events array
   */
  private validateWebhookEvents(events: unknown): void {
    if (!Array.isArray(events)) {
      throw new ValidationError('events must be an array');
    }
    if (events.length === 0) {
      throw new ValidationError('events must contain at least one event type');
    }

    const validEvents = [
      'service_key.rotated',
      'service_key.created',
      'child_key.created',
      'child_key.revoked',
      'credits.low_threshold',
      'credits.exhausted',
    ];

    for (const event of events) {
      if (typeof event !== 'string' || !validEvents.includes(event)) {
        throw new ValidationError(
          `Invalid event type: ${event}. Valid types: ${validEvents.join(', ')}`
        );
      }
    }
  }

  /**
   * Create a new webhook
   *
   * Webhooks allow you to receive real-time notifications when events occur.
   * The webhook secret is ONLY shown once - store it securely for signature verification.
   *
   * @param input - Webhook configuration
   * @returns Webhook ID and secret (secret shown ONLY once!)
   *
   * @throws {ValidationError} If parameters are invalid
   * @throws {AuthenticationError} If service key is invalid
   *
   * @example
   * ```typescript
   * const webhook = await client.createWebhook({
   *   name: 'Production Alerts',
   *   url: 'https://api.example.com/webhooks/keyparty',
   *   events: ['credits.low_threshold', 'child_key.created'],
   *   description: 'Production monitoring webhooks',
   *   lowCreditThreshold: 50,
   *   customHeaders: { 'X-Service-Auth': 'secret-token' }
   * });
   * console.log(`Webhook ID: ${webhook.data.webhookId}`);
   * console.log(`Secret (save this!): ${webhook.data.secret}`);
   * ```
   */
  async createWebhook(input: CreateWebhookInput): Promise<CreateWebhookResponse> {
    // Validate required fields
    this.validateWebhookName(input.name);
    this.validateWebhookUrl(input.url);
    this.validateWebhookEvents(input.events);

    // Validate optional fields
    if (input.description !== undefined) {
      if (typeof input.description !== 'string') {
        throw new ValidationError('description must be a string');
      }
    }

    if (input.lowCreditThreshold !== undefined) {
      if (typeof input.lowCreditThreshold !== 'number' || input.lowCreditThreshold < 0) {
        throw new ValidationError('lowCreditThreshold must be a non-negative number');
      }
    }

    if (input.customHeaders !== undefined) {
      if (typeof input.customHeaders !== 'object' || input.customHeaders === null) {
        throw new ValidationError('customHeaders must be an object');
      }
    }

    if (input.retryConfig !== undefined) {
      if (typeof input.retryConfig !== 'object' || input.retryConfig === null) {
        throw new ValidationError('retryConfig must be an object');
      }
    }

    return await this.request<CreateWebhookResponse>('POST', '/api/webhooks', input as unknown as JsonObject);
  }

  /**
   * List all webhooks
   *
   * Returns all webhooks for the authenticated service.
   * Optionally filter by status.
   *
   * @param status - Optional filter by webhook status ('enabled' or 'disabled')
   * @returns Array of webhooks with full configuration and statistics
   *
   * @throws {AuthenticationError} If service key is invalid
   *
   * @example
   * ```typescript
   * // Get all webhooks
   * const all = await client.listWebhooks();
   *
   * // Get only enabled webhooks
   * const enabled = await client.listWebhooks('enabled');
   * console.log(`${enabled.data.webhooks.length} enabled webhooks`);
   * ```
   */
  async listWebhooks(status?: WebhookStatus): Promise<ListWebhooksResponse> {
    let path = '/api/webhooks';
    if (status) {
      if (status !== 'enabled' && status !== 'disabled') {
        throw new ValidationError('status must be "enabled" or "disabled"');
      }
      path += `?status=${status}`;
    }

    return await this.request<ListWebhooksResponse>('GET', path);
  }

  /**
   * Get webhook details by ID
   *
   * Returns complete configuration and statistics for a specific webhook.
   * Note: The webhook secret is never returned after creation.
   *
   * @param webhookId - Webhook ID to retrieve
   * @returns Webhook configuration and statistics
   *
   * @throws {ValidationError} If webhookId is invalid
   * @throws {AuthenticationError} If service key is invalid
   * @throws {UserNotFoundError} If webhook doesn't exist
   *
   * @example
   * ```typescript
   * const webhook = await client.getWebhook('webhook_123');
   * console.log(`Status: ${webhook.data.status}`);
   * console.log(`Success rate: ${webhook.data.successCount}/${webhook.data.successCount + webhook.data.failureCount}`);
   * ```
   */
  async getWebhook(webhookId: string): Promise<GetWebhookResponse> {
    if (!webhookId || typeof webhookId !== 'string') {
      throw new ValidationError('webhookId is required');
    }

    return await this.request<GetWebhookResponse>('GET', `/api/webhooks/${webhookId}`);
  }

  /**
   * Update a webhook configuration
   *
   * Update any webhook properties. All fields are optional.
   * Note: Uses PATCH method for partial updates.
   *
   * @param webhookId - Webhook ID to update
   * @param input - Fields to update (all optional)
   * @returns Operation result
   *
   * @throws {ValidationError} If parameters are invalid
   * @throws {AuthenticationError} If service key is invalid
   * @throws {UserNotFoundError} If webhook doesn't exist
   *
   * @example
   * ```typescript
   * // Disable a webhook
   * await client.updateWebhook('webhook_123', { status: 'disabled' });
   *
   * // Update multiple properties
   * await client.updateWebhook('webhook_123', {
   *   name: 'Updated Name',
   *   lowCreditThreshold: 25,
   *   events: ['credits.exhausted']
   * });
   * ```
   */
  async updateWebhook(
    webhookId: string,
    input: UpdateWebhookInput
  ): Promise<WebhookOperationResponse> {
    if (!webhookId || typeof webhookId !== 'string') {
      throw new ValidationError('webhookId is required');
    }

    // Validate any provided fields
    if (input.name !== undefined) {
      this.validateWebhookName(input.name);
    }
    if (input.url !== undefined) {
      this.validateWebhookUrl(input.url);
    }
    if (input.events !== undefined) {
      this.validateWebhookEvents(input.events);
    }
    if (input.status !== undefined) {
      if (input.status !== 'enabled' && input.status !== 'disabled') {
        throw new ValidationError('status must be "enabled" or "disabled"');
      }
    }
    if (input.lowCreditThreshold !== undefined) {
      if (typeof input.lowCreditThreshold !== 'number' || input.lowCreditThreshold < 0) {
        throw new ValidationError('lowCreditThreshold must be a non-negative number');
      }
    }

    return await this.request<WebhookOperationResponse>('PATCH', `/api/webhooks/${webhookId}`, input as unknown as JsonObject);
  }

  /**
   * Delete a webhook
   *
   * Soft delete - sets webhook status to 'disabled'.
   * Webhook can be re-enabled by updating its status.
   *
   * @param webhookId - Webhook ID to delete
   * @returns Operation result
   *
   * @throws {ValidationError} If webhookId is invalid
   * @throws {AuthenticationError} If service key is invalid
   * @throws {UserNotFoundError} If webhook doesn't exist
   *
   * @example
   * ```typescript
   * await client.deleteWebhook('webhook_123');
   * ```
   */
  async deleteWebhook(webhookId: string): Promise<WebhookOperationResponse> {
    if (!webhookId || typeof webhookId !== 'string') {
      throw new ValidationError('webhookId is required');
    }

    return await this.request<WebhookOperationResponse>('DELETE', `/api/webhooks/${webhookId}`);
  }

  /**
   * Rotate webhook secret
   *
   * Generates a new webhook secret and invalidates the old one.
   * The new secret is ONLY shown once - store it securely.
   *
   * Note: This method calls a Convex mutation directly since the HTTP endpoint
   * may not be exposed yet. Check API documentation for availability.
   *
   * @param webhookId - Webhook ID to rotate secret for
   * @returns New webhook secret (shown ONLY once!)
   *
   * @throws {ValidationError} If webhookId is invalid
   * @throws {AuthenticationError} If service key is invalid
   * @throws {UserNotFoundError} If webhook doesn't exist
   *
   * @example
   * ```typescript
   * const result = await client.rotateWebhookSecret('webhook_123');
   * console.log(`New secret (save this!): ${result.data.secret}`);
   * ```
   */
  async rotateWebhookSecret(webhookId: string): Promise<RotateWebhookSecretResponse> {
    if (!webhookId || typeof webhookId !== 'string') {
      throw new ValidationError('webhookId is required');
    }

    // Note: This endpoint may need to be added to the HTTP API
    // For now, this documents the expected interface
    return await this.request<RotateWebhookSecretResponse>('POST', `/api/webhooks/${webhookId}/rotate-secret`);
  }

  // ============================================================================
  // CHILD API KEY MANAGEMENT METHODS
  // ============================================================================

  /**
   * Validate child key ID
   */
  private validateChildKeyId(childKeyId: string): void {
    if (!childKeyId || typeof childKeyId !== 'string') {
      throw new ValidationError('childKeyId is required and must be a string');
    }
    if (childKeyId.trim().length === 0) {
      throw new ValidationError('childKeyId cannot be empty');
    }
  }

  /**
   * List all child API keys created under this service
   *
   * Returns array of child keys with usage statistics.
   * Use this to build dashboards showing key health and usage.
   *
   * @param options - Filtering options
   * @returns Array of child keys with statistics
   *
   * @throws {AuthenticationError} If service key is invalid
   *
   * @example
   * ```typescript
   * // List all production keys
   * const keys = await client.listChildKeys({ environment: 'production' });
   * console.log(`${keys.data.summary.active} active keys`);
   *
   * // List keys for specific user
   * const userKeys = await client.listChildKeys({
   *   externalUserId: 'user_123'
   * });
   *
   * // Include revoked keys
   * const allKeys = await client.listChildKeys({ includeRevoked: true });
   * ```
   */
  async listChildKeys(options?: ListChildKeysOptions): Promise<ListChildKeysResponse> {
    // Backend uses POST /api/apiKeys/list with service key authentication
    const body: JsonObject = {};

    if (options?.environment) {
      if (!['development', 'staging', 'production'].includes(options.environment)) {
        throw new ValidationError('environment must be development, staging, or production');
      }
      body.environment = options.environment;
    }

    if (options?.includeRevoked !== undefined) {
      body.includeRevoked = options.includeRevoked;
    }

    if (options?.externalUserId) {
      this.validateUserId(options.externalUserId);
      body.externalUserId = options.externalUserId;
    }

    return await this.request<ListChildKeysResponse>('POST', '/api/apiKeys/list', body);
  }

  /**
   * Revoke a child API key
   *
   * IMPORTANT: This is irreversible! The child key will immediately stop working.
   * Consider creating a new key for the user if needed.
   *
   * @param childKeyId - ID of child key to revoke (keyHash from backend)
   * @returns Revocation confirmation
   *
   * @throws {ValidationError} If childKeyId is invalid
   * @throws {AuthenticationError} If service key is invalid
   * @throws {UserNotFoundError} If child key doesn't exist
   *
   * @example
   * ```typescript
   * // Revoke compromised key
   * await client.revokeChildKey('key_abc123');
   *
   * // Then create new key for user
   * const newKey = await client.createChildKey('user_123', 1000);
   * ```
   */
  async revokeChildKey(childKeyId: string): Promise<RevokeChildKeyResponse> {
    this.validateChildKeyId(childKeyId);

    // Backend uses DELETE /api/keys/delete with keyHash parameter
    return await this.request<RevokeChildKeyResponse>('DELETE', '/api/keys/delete', {
      keyHash: childKeyId,
    });
  }

  /**
   * Get detailed health metrics for a specific child key
   *
   * Returns comprehensive statistics including:
   * - 24-hour usage metrics
   * - Top endpoints by usage
   * - Current credit balance
   * - Rate limiting status
   *
   * @param childKeyId - ID of child key (keyHash)
   * @returns Health metrics and usage statistics
   *
   * @throws {ValidationError} If childKeyId is invalid
   * @throws {AuthenticationError} If service key is invalid
   * @throws {UserNotFoundError} If child key doesn't exist
   *
   * @example
   * ```typescript
   * const status = await client.getChildKeyStatus('key_abc123');
   * console.log(`Requests: ${status.data.metrics24h.totalRequests}`);
   * console.log(`Success rate: ${status.data.metrics24h.successRate}%`);
   * console.log(`Credits: ${status.data.credits.balance}`);
   * ```
   */
  async getChildKeyStatus(childKeyId: string): Promise<ChildKeyStatusResponse> {
    this.validateChildKeyId(childKeyId);

    // Backend uses POST /api/apiKeys/status with keyHash in body
    return await this.request<ChildKeyStatusResponse>('POST', '/api/apiKeys/status', {
      keyHash: childKeyId,
    });
  }

  /**
   * Retrieve custom metadata associated with a child key
   *
   * Use this to retrieve custom fields you've stored like:
   * - User tier/plan information
   * - Custom limits or features
   * - Internal notes or tags
   *
   * @param childKeyId - ID of child key (keyHash)
   * @returns Custom metadata object
   *
   * @throws {ValidationError} If childKeyId is invalid
   * @throws {AuthenticationError} If service key is invalid
   * @throws {UserNotFoundError} If child key doesn't exist
   *
   * @example
   * ```typescript
   * const meta = await client.getChildKeyMetadata('key_abc123');
   * console.log(`User tier: ${meta.data.metadata.tier}`);
   * ```
   */
  async getChildKeyMetadata(childKeyId: string): Promise<ChildKeyMetadataResponse> {
    this.validateChildKeyId(childKeyId);

    // Backend uses GET /api/keys/metadata with query parameter
    return await this.request<ChildKeyMetadataResponse>('GET', `/api/keys/metadata?keyHash=${encodeURIComponent(childKeyId)}`);
  }

  /**
   * Update custom metadata for a child key
   *
   * Store arbitrary JSON metadata (max 10KB serialized).
   * Common use cases:
   * - User tier: { tier: 'pro', features: ['unlimited', 'priority'] }
   * - Custom limits: { dailyLimit: 10000, monthlyLimit: 100000 }
   * - Internal tracking: { notes: 'VIP customer', tags: ['enterprise'] }
   *
   * @param childKeyId - ID of child key (keyHash)
   * @param metadata - Custom metadata (max 10KB serialized)
   * @returns Updated metadata
   *
   * @throws {ValidationError} If childKeyId or metadata is invalid
   * @throws {AuthenticationError} If service key is invalid
   * @throws {UserNotFoundError} If child key doesn't exist
   *
   * @example
   * ```typescript
   * await client.updateChildKeyMetadata('key_abc123', {
   *   tier: 'pro',
   *   features: ['api_access', 'premium_support'],
   *   dailyLimit: 10000
   * });
   * ```
   */
  async updateChildKeyMetadata(
    childKeyId: string,
    metadata: JsonObject
  ): Promise<ChildKeyMetadataResponse> {
    this.validateChildKeyId(childKeyId);

    // Validate metadata
    if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
      throw new ValidationError('metadata must be an object');
    }

    // Check JSON serializability and size
    let serialized: string;
    try {
      serialized = JSON.stringify(metadata);
    } catch {
      throw new ValidationError('metadata must be JSON-serializable');
    }

    if (serialized.length > 10000) {
      throw new ValidationError('metadata size must be 10KB or less when serialized');
    }

    // Backend uses PUT /api/keys/metadata with keyHash and metadata in body
    return await this.request<ChildKeyMetadataResponse>('PUT', '/api/keys/metadata', {
      keyHash: childKeyId,
      metadata,
    } as unknown as JsonObject);
  }

  // ============================================================================
  // TRANSACTION HISTORY METHODS
  // ============================================================================

  /**
   * Get audit trail of all credit operations
   *
   * Returns paginated transaction history with full details.
   * Use for:
   * - Compliance and auditing
   * - Debugging credit discrepancies
   * - Usage analysis and reporting
   *
   * @param userId - User ID (or externalUserId for child key users)
   * @param options - Filtering and pagination options
   * @returns Transaction history with pagination
   *
   * @throws {ValidationError} If userId or options are invalid
   * @throws {AuthenticationError} If service key is invalid
   *
   * @example
   * ```typescript
   * // Get last 50 transactions
   * const history = await client.getTransactionHistory('user_123');
   *
   * // Filter by type
   * const deductions = await client.getTransactionHistory('user_123', {
   *   type: 'deduct',
   *   limit: 100
   * });
   *
   * // Date range query
   * const monthly = await client.getTransactionHistory('user_123', {
   *   startDate: new Date('2025-01-01'),
   *   endDate: new Date('2025-01-31')
   * });
   *
   * // Pagination
   * const page2 = await client.getTransactionHistory('user_123', {
   *   limit: 50,
   *   offset: 50
   * });
   * ```
   */
  async getTransactionHistory(
    userId: string,
    options?: TransactionHistoryOptions
  ): Promise<TransactionHistoryResponse> {
    this.validateUserId(userId);

    const params = new URLSearchParams({ userId });

    if (options?.limit !== undefined) {
      if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 500) {
        throw new ValidationError('limit must be between 1 and 500');
      }
      params.append('limit', String(options.limit));
    }

    if (options?.offset !== undefined) {
      if (!Number.isInteger(options.offset) || options.offset < 0) {
        throw new ValidationError('offset must be a non-negative integer');
      }
      params.append('offset', String(options.offset));
    }

    if (options?.type) {
      if (!['deduct', 'increase', 'set'].includes(options.type)) {
        throw new ValidationError('type must be deduct, increase, or set');
      }
      params.append('type', options.type);
    }

    if (options?.startDate) {
      if (!(options.startDate instanceof Date) || isNaN(options.startDate.getTime())) {
        throw new ValidationError('startDate must be a valid Date object');
      }
      params.append('startDate', options.startDate.toISOString());
    }

    if (options?.endDate) {
      if (!(options.endDate instanceof Date) || isNaN(options.endDate.getTime())) {
        throw new ValidationError('endDate must be a valid Date object');
      }
      params.append('endDate', options.endDate.toISOString());
    }

    // Validate date range
    if (options?.startDate && options?.endDate && options.startDate > options.endDate) {
      throw new ValidationError('startDate must be before endDate');
    }

    return await this.request<TransactionHistoryResponse>('GET', `/api/transactions?${params.toString()}`);
  }

  /**
   * Get specific transaction by ID
   *
   * Use this for:
   * - Idempotency verification
   * - Debugging specific transactions
   * - Transaction status checks
   *
   * @param transactionId - UUID of transaction
   * @returns Transaction details
   *
   * @throws {ValidationError} If transactionId is invalid
   * @throws {AuthenticationError} If service key is invalid
   * @throws {UserNotFoundError} If transaction doesn't exist
   *
   * @example
   * ```typescript
   * // Check if transaction already completed (idempotency)
   * try {
   *   const tx = await client.getTransactionById('tx_abc123');
   *   console.log(`Transaction already completed: ${tx.data.status}`);
   * } catch (error) {
   *   if (error instanceof UserNotFoundError) {
   *     // Transaction doesn't exist, safe to proceed
   *   }
   * }
   * ```
   */
  async getTransactionById(transactionId: string): Promise<TransactionResponse> {
    if (!transactionId || typeof transactionId !== 'string') {
      throw new ValidationError('transactionId is required and must be a string');
    }
    if (transactionId.trim().length === 0) {
      throw new ValidationError('transactionId cannot be empty');
    }

    return await this.request<TransactionResponse>('GET', `/api/transactions/${transactionId}`);
  }
}
