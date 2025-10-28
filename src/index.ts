/**
 * KeyParty Node.js SDK
 * TypeScript SDK for KeyParty credit management system
 *
 * @packageDocumentation
 */

// Export main client
export { KeyPartyClient } from './client.js';

// Export types
export type {
  KeyPartyConfig,
  CreditResponse,
  OperationResult,
  BatchOperationResult,
  KeyPartyApiError,
  KeyPartyApiResponse,
  SubscriptionStatus,
  Subscription,
  SubscriptionResponse,
  SubscriptionStatusResponse,
} from './types.js';

// Export errors
export {
  KeyPartyError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  RateLimitError,
  InsufficientCreditsError,
  NetworkError,
  UserNotFoundError,
} from './errors.js';
