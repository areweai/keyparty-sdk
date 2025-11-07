# KeyParty SDK

TypeScript SDK for KeyParty credit management with server-authoritative timestamps and comprehensive audit trails.

## Installation

```bash
npm install keyparty-sdk
```

## Quick Start

```typescript
import { KeyPartyClient } from 'keyparty-sdk';

const client = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY);

// Get balance
const balance = await client.getCredits('user_123');

// Manage credits
await client.addCredits('user_123', 100, 'Signup bonus');
await client.deductCredits('user_123', 10, 'API usage');
```

## Features

- Single API call per operation with automatic retries
- Full TypeScript support with zero dependencies
- Secure permission model (service keys vs child keys)
- Recurring subscriptions with automated renewals
- Webhook management for event notifications
- Child key lifecycle management and monitoring
- Transaction history with pagination and filtering

## Security Model

### Key Types

**Service Key (`sk_*`)** - Full administrative access for SaaS owners
- Manage credits (add, deduct, set, view)
- Create and manage child keys, webhooks, subscriptions
- View all transaction history

**Child Key (`ck_pk_*`)** - Limited user access
- View own balance and transaction history
- Deduct own credits only
- Cannot add credits or create keys

### Permission Matrix

| Operation | Service Key | Child Key |
|-----------|-------------|-----------|
| View Credits | Yes | Yes (own only) |
| Deduct Credits | Yes | Yes (own only) |
| Add/Set Credits | Yes | No |
| Manage Keys/Webhooks | Yes | No |

## Error Handling

```typescript
import {
  ForbiddenError,
  InsufficientCreditsError,
  AuthenticationError
} from 'keyparty-sdk';

try {
  await client.deductCredits('user_123', 100, 'API usage');
} catch (error) {
  if (error instanceof InsufficientCreditsError) {
    console.error('Not enough credits');
  } else if (error instanceof ForbiddenError) {
    console.error('Permission denied');
  }
}
```

**Available Errors:** `ForbiddenError`, `AuthenticationError`, `ValidationError`, `UserNotFoundError`, `InsufficientCreditsError`, `RateLimitError`, `NetworkError` (auto-retry)

## API Reference

### Core Operations

```typescript
// Credits
await client.getCredits(userId);
await client.addCredits(userId, amount, reason?);
await client.deductCredits(userId, amount, reason?);
await client.setCredits(userId, amount, reason?);
await client.batchOperation(operation, userId, amount);

// Child Keys
await client.createChildKey(userId, credits, options?);
await client.listChildKeys(options?);
await client.revokeChildKey(childKeyId);
await client.getChildKeyStatus(childKeyId);
await client.getChildKeyMetadata(childKeyId);
await client.updateChildKeyMetadata(childKeyId, metadata);

// Subscriptions
await client.startSubscription(userId, amount, validityDays);
await client.stopSubscription(userId, subscriptionId);
await client.getSubscriptionStatus(userId);

// Multi-tenant subscriptions
await client.startExternalUserSubscription(externalUserId, amount, validityDays);
await client.stopExternalUserSubscription(externalUserId, subscriptionId);
await client.getExternalUserSubscriptionStatus(externalUserId);

// Webhooks
await client.createWebhook(config);
await client.listWebhooks(status?);
await client.getWebhook(webhookId);
await client.updateWebhook(webhookId, updates);
await client.rotateWebhookSecret(webhookId);
await client.deleteWebhook(webhookId);

// Transaction History
await client.getTransactionHistory(userId, options?);
await client.getTransactionById(transactionId);
```

### Transaction History Options

```typescript
const history = await client.getTransactionHistory('user_123', {
  limit: 50,              // Results per page (default: 50)
  offset: 0,              // Skip results (default: 0)
  type: 'deduct',         // Filter: 'deduct' | 'increase' | 'set'
  startDate: new Date(),  // Date range start
  endDate: new Date()     // Date range end
});
```

### Webhook Events

- `service_key.rotated` / `service_key.created`
- `child_key.created` / `child_key.revoked`
- `credits.low_threshold` / `credits.exhausted`

### Constructor Options

```typescript
const client = new KeyPartyClient(serviceKey, {
  baseUrl: 'https://your-api.com',  // Custom endpoint
  timeout: 10000,                    // Request timeout (ms)
  retryAttempts: 3,                  // Retry attempts
  retryDelay: 1000                   // Retry delay (ms)
});
```

## Configuration

Required:
```bash
KEYPARTY_SERVICE_KEY=sk_test_your_service_key
```

Optional:
```bash
KEYPARTY_BASE_URL=https://your-deployment.convex.site
KEYPARTY_TIMEOUT=10000
KEYPARTY_RETRY_ATTEMPTS=3
```

## Testing

```bash
npm test                                          # Run all tests
KEYPARTY_SERVICE_KEY=sk_test npm test            # Include integration tests
npm run test:watch                                # Watch mode
```

## Requirements

- Node.js v22.0.0 or higher
- TypeScript 5.0+ (for TypeScript projects)

## Version History

- **v0.1.7** - Phase 1 complete: Fixed endpoint mismatches, verified integration tests
- **v0.1.6** - Added child key management and transaction history
- **v0.1.5** - Added webhook management
- **v0.1.4** - Added recurring subscriptions
- **v0.1.3** - Security fix: Restricted child key permissions
- **v0.1.0** - Initial release

## License

MIT

## Support

https://github.com/areweai/keyparty-sdk/issues
