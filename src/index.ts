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
  // Webhook types
  WebhookEventType,
  WebhookRetryConfig,
  WebhookStatus,
  WebhookDeliveryStatus,
  Webhook,
  CreateWebhookInput,
  CreateWebhookResponse,
  UpdateWebhookInput,
  WebhookOperationResponse,
  ListWebhooksResponse,
  GetWebhookResponse,
  RotateWebhookSecretResponse,
  // Child API Key Management types
  ChildKeyEnvironment,
  ChildKeyStatus,
  ChildKey,
  ListChildKeysOptions,
  ListChildKeysResponse,
  RevokeChildKeyResponse,
  ChildKeyStatusResponse,
  ChildKeyMetadataResponse,
  // Transaction History types
  TransactionType,
  TransactionStatus,
  TransactionPerformerType,
  Transaction,
  TransactionHistoryOptions,
  TransactionHistoryResponse,
  DetailedTransaction,
  TransactionResponse,
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
