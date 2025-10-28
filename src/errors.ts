/**
 * Custom error classes for KeyParty SDK
 */

/**
 * Base error class for all KeyParty errors
 */
export class KeyPartyError extends Error {
  code: string;
  statusCode?: number;
  details?: unknown;

  constructor(message: string, code: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'KeyPartyError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error thrown for invalid inputs
 */
export class ValidationError extends KeyPartyError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error thrown for invalid service keys
 */
export class AuthenticationError extends KeyPartyError {
  constructor(message: string = 'Invalid or missing service key', details?: unknown) {
    super(message, 'AUTH_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Forbidden error thrown when the operation is not allowed for the key type
 * (e.g., child keys attempting to add/set credits)
 */
export class ForbiddenError extends KeyPartyError {
  constructor(message: string = 'Operation forbidden for this key type', details?: unknown) {
    super(message, 'FORBIDDEN_ERROR', 403, details);
    this.name = 'ForbiddenError';
  }
}

/**
 * Rate limit error thrown when rate limits are exceeded
 */
export class RateLimitError extends KeyPartyError {
  constructor(message: string = 'Rate limit exceeded', details?: unknown) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
    this.name = 'RateLimitError';
  }
}

/**
 * Insufficient credits error thrown when attempting to deduct more credits than available
 */
export class InsufficientCreditsError extends KeyPartyError {
  constructor(message: string = 'Insufficient credits for operation', details?: unknown) {
    super(message, 'INSUFFICIENT_CREDITS', 400, details);
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Network error thrown for network-related failures
 */
export class NetworkError extends KeyPartyError {
  constructor(message: string = 'Network request failed', details?: unknown) {
    super(message, 'NETWORK_ERROR', 0, details);
    this.name = 'NetworkError';
  }
}

/**
 * User not found error
 */
export class UserNotFoundError extends KeyPartyError {
  constructor(userId: string, details?: unknown) {
    super(`User not found: ${userId}`, 'USER_NOT_FOUND', 404, details);
    this.name = 'UserNotFoundError';
  }
}
