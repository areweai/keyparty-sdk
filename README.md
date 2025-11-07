# KeyParty SDK

TypeScript SDK for KeyParty credit management with server-authoritative timestamps and comprehensive audit trails.

## Features

- Single API call per operation
- Full TypeScript support with strict types
- Zero dependencies (native Node.js fetch)
- Automatic retry logic with configurable backoff
- Comprehensive test coverage
- Secure permission model with child key support
- Recurring subscriptions with automated credit renewals
- Webhook management with event subscriptions
- Child key lifecycle management and monitoring
- Transaction history with pagination and filtering

## Installation

```bash
npm install keyparty-sdk
```

## Quick Start

```typescript
import { KeyPartyClient } from 'keyparty-sdk';

// Initialize client with service key
const client = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY);

// Get current balance
const balance = await client.getCredits('user_123');
console.log(`Balance: ${balance.credits}`);

// Add credits (service keys only)
const result = await client.addCredits('user_123', 50, 'Signup bonus');
console.log(`Previous: ${result.previousCredits}, New: ${result.newCredits}`);
```

## Security & Permission Model

### Key Types

**Service Key (`sk_*`)** - Full administrative access
- Held by SaaS service owner
- Can add, deduct, set, and get credits for any user
- Can create and manage child keys
- Can manage subscriptions and webhooks
- Required for all administrative operations

**Child Key (`ck_pk_*`)** - Limited user access
- Given to end users for their own credit management
- Can view their own credit balance (read-only)
- Can deduct credits for their own usage
- Cannot add or set credits (security restriction)
- Cannot create additional child keys

### Permission Matrix

| Operation | Service Key | Child Key |
|-----------|-------------|-----------|
| Get Credits | Yes | Yes (own account only) |
| Deduct Credits | Yes | Yes (own account only) |
| Add Credits | Yes | No (403 Forbidden) |
| Set Credits | Yes | No (403 Forbidden) |
| Create Child Keys | Yes | No |
| Manage Webhooks | Yes | No |
| View Transaction History | Yes | Yes (own account only) |

### Security Notice (v0.1.3+)

As of v0.1.3, child keys can no longer call `/api/credits/add` or `/api/credits/set` endpoints. This prevents users from granting themselves unlimited credits.

**Migration:**
```typescript
// Incorrect - child key cannot add credits
const childKey = new KeyPartyClient('ck_pk_...');
await childKey.addCredits('user_123', 100); // Throws ForbiddenError

// Correct - use service key for credit management
const serviceKey = new KeyPartyClient('sk_...');
await serviceKey.addCredits('user_123', 100); // Works correctly
```

## Error Handling

The SDK provides typed error classes for all failure scenarios:

```typescript
import {
  KeyPartyClient,
  ForbiddenError,
  AuthenticationError,
  InsufficientCreditsError,
  UserNotFoundError,
  ValidationError,
  NetworkError,
} from 'keyparty-sdk';

const client = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY);

try {
  await client.deductCredits('user_123', 100, 'API usage');
} catch (error) {
  if (error instanceof ForbiddenError) {
    console.error('Permission denied');
  } else if (error instanceof InsufficientCreditsError) {
    console.error('Not enough credits');
  } else if (error instanceof UserNotFoundError) {
    console.error('User not found');
  } else if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof ValidationError) {
    console.error('Invalid input parameters');
  } else if (error instanceof NetworkError) {
    console.error('Network error (auto-retry in progress)');
  }
}
```

### Error Reference

| Error | Status | Description | Retryable |
|-------|--------|-------------|-----------|
| `ForbiddenError` | 403 | Permission denied | No |
| `AuthenticationError` | 401 | Invalid API key | No |
| `ValidationError` | 400 | Invalid parameters | No |
| `UserNotFoundError` | 404 | User does not exist | No |
| `InsufficientCreditsError` | 402 | Not enough credits | No |
| `RateLimitError` | 429 | Too many requests | No |
| `NetworkError` | - | Network failure | Yes (automatic) |

## API Reference

### Constructor

```typescript
const client = new KeyPartyClient(serviceKey, config?)
```

**Config options:**
- `baseUrl` - Custom API endpoint
- `timeout` - Request timeout in milliseconds (default: 10000)
- `retryAttempts` - Number of retry attempts (default: 3)
- `retryDelay` - Delay between retries in milliseconds (default: 1000)

### Core Credit Operations

#### getCredits(userId)

Get current credit balance for a user.

```typescript
const balance = await client.getCredits('user_123');
// Returns: { userId: string, credits: number, timestamp: string }
```

#### addCredits(userId, amount, reason?)

Add credits to a user's account. Service key required.

```typescript
const result = await client.addCredits('user_123', 100, 'Referral bonus');
// Returns: { success: boolean, userId: string, previousCredits: number, newCredits: number, operation: string, amount: number, timestamp: string, reason?: string }
```

#### deductCredits(userId, amount, reason?)

Deduct credits from a user's account.

```typescript
const result = await client.deductCredits('user_123', 10, 'API usage');
// Returns: { success: boolean, userId: string, previousCredits: number, newCredits: number, operation: string, amount: number, timestamp: string, reason?: string }
```

#### setCredits(userId, amount, reason?)

Set absolute credit balance. Service key required.

```typescript
const result = await client.setCredits('user_123', 1000, 'Account reset');
// Returns: { success: boolean, userId: string, previousCredits: number, newCredits: number, operation: string, amount: number, timestamp: string, reason?: string }
```

#### batchOperation(operation, userId, amount)

Perform bulk credit operations.

```typescript
const results = await client.batchOperation('add', 'user_123', 10);
// Returns: { operations: array, totalSuccessful: number, totalFailed: number, errors: array }
```

### Child Key Management

#### createChildKey(userId, credits, options?)

Create a new child API key for a user.

```typescript
const childKey = await client.createChildKey('user_123', 1000, {
  name: 'Production API Key',
  environment: 'production'
});
// Returns: { apiKey: string, externalUserId: string, credits: number }
```

#### listChildKeys(options?)

List all child keys with optional filtering.

```typescript
const childKeys = await client.listChildKeys({
  environment: 'production',
  externalUserId: 'user_123',
  includeRevoked: false
});
// Returns: { success: boolean, data: { childKeys: array, summary: object }, timestamp: string }
```

#### revokeChildKey(childKeyId)

Revoke a child key permanently.

```typescript
const result = await client.revokeChildKey('child_key_id');
// Returns: { success: boolean, data: { childKeyId: string, previousStatus: string, newStatus: string, revokedAt: string, message: string }, timestamp: string }
```

#### getChildKeyStatus(childKeyId)

Get detailed health metrics for a child key.

```typescript
const status = await client.getChildKeyStatus('child_key_id');
// Returns: { success: boolean, data: { id: string, status: string, metrics24h: object, credits: number, rateLimit: object }, timestamp: string }
```

#### getChildKeyMetadata(childKeyId)

Retrieve custom metadata for a child key.

```typescript
const metadata = await client.getChildKeyMetadata('child_key_id');
// Returns: { success: boolean, data: { childKeyId: string, metadata: object }, timestamp: string }
```

#### updateChildKeyMetadata(childKeyId, metadata)

Update custom metadata for a child key (max 10KB JSON).

```typescript
await client.updateChildKeyMetadata('child_key_id', {
  department: 'Engineering',
  project: 'Mobile App',
  version: '2.0'
});
// Returns: { success: boolean, data: { childKeyId: string, metadata: object }, timestamp: string }
```

### Subscriptions

#### startSubscription(userId, amount, validityDays)

Start a recurring credit subscription.

```typescript
const sub = await client.startSubscription('user_123', 100, 31);
// Returns: { success: boolean, subscription: object, message: string }
```

#### stopSubscription(userId, subscriptionId)

Cancel a recurring subscription.

```typescript
await client.stopSubscription('user_123', 'sub_id');
// Returns: { success: boolean, subscription: object, message: string }
```

#### getSubscriptionStatus(userId)

Get all subscriptions for a user.

```typescript
const status = await client.getSubscriptionStatus('user_123');
// Returns: { success: boolean, subscriptions: array }
```

#### Multi-tenant Subscription Methods

For SaaS platforms managing subscriptions on behalf of their users:

```typescript
await client.startExternalUserSubscription('external_user_id', 100, 31);
await client.stopExternalUserSubscription('external_user_id', 'sub_id');
await client.getExternalUserSubscriptionStatus('external_user_id');
```

### Webhooks

#### createWebhook(input)

Create a webhook for event notifications.

```typescript
const webhook = await client.createWebhook({
  name: 'Credit Alerts',
  url: 'https://example.com/webhooks/credits',
  events: ['credits.low_threshold', 'credits.exhausted'],
  lowCreditThreshold: 50,
  description: 'Alert when credits run low'
});
// Returns: { success: boolean, data: { webhookId: string, secret: string }, timestamp: string }
// WARNING: Store the secret securely - it is only shown once
```

#### listWebhooks(status?)

List all webhooks with optional status filtering.

```typescript
const webhooks = await client.listWebhooks();
const activeWebhooks = await client.listWebhooks('enabled');
// Returns: { success: boolean, data: { webhooks: array }, timestamp: string }
```

#### getWebhook(webhookId)

Get webhook details.

```typescript
const details = await client.getWebhook('webhook_id');
// Returns: { success: boolean, data: object, timestamp: string }
```

#### updateWebhook(webhookId, updates)

Update webhook configuration.

```typescript
await client.updateWebhook('webhook_id', {
  events: ['child_key.created', 'child_key.revoked'],
  status: 'disabled'
});
// Returns: { success: boolean, data: object, timestamp: string }
```

#### rotateWebhookSecret(webhookId)

Rotate webhook secret for security.

```typescript
const newSecret = await client.rotateWebhookSecret('webhook_id');
// Returns: { success: boolean, data: { secret: string, message: string }, timestamp: string }
```

#### deleteWebhook(webhookId)

Delete a webhook.

```typescript
await client.deleteWebhook('webhook_id');
// Returns: { success: boolean, data: object, timestamp: string }
```

**Available Webhook Events:**
- `service_key.rotated` - Service key was rotated
- `service_key.created` - New service key created
- `child_key.created` - Child API key generated
- `child_key.revoked` - Child API key revoked
- `credits.low_threshold` - Credits below threshold
- `credits.exhausted` - Credits reached zero

### Transaction History

#### getTransactionHistory(userId, options?)

Get paginated transaction history with filtering.

```typescript
const history = await client.getTransactionHistory('user_123', {
  limit: 50,
  offset: 0,
  type: 'deduct',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31')
});
// Returns: { success: boolean, data: { userId: string, transactions: array, pagination: object }, timestamp: string }
```

**Filter options:**
- `limit` - Number of results (default: 50)
- `offset` - Skip results for pagination (default: 0)
- `type` - Filter by transaction type: 'deduct' | 'increase' | 'set'
- `startDate` - Filter by date range (Date object)
- `endDate` - Filter by date range (Date object)

#### getTransactionById(transactionId)

Get specific transaction details.

```typescript
const transaction = await client.getTransactionById('transaction_uuid');
// Returns: { success: boolean, data: { id: string, type: string, amount: number, previousBalance: number, newBalance: number, status: string, metadata: object }, timestamp: string }
```

**Transaction status values:**
- `completed` - Transaction completed successfully
- `failed` - Transaction failed
- `rolled_back` - Transaction was rolled back

## Configuration

### Environment Variables

Required:
```bash
KEYPARTY_SERVICE_KEY=sk_test_your_service_key
```

Optional:
```bash
KEYPARTY_BASE_URL=https://your-deployment.convex.site
KEYPARTY_TIMEOUT=10000
KEYPARTY_RETRY_ATTEMPTS=3
KEYPARTY_RETRY_DELAY=1000
```

## Testing

The SDK includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests (requires KEYPARTY_SERVICE_KEY)
KEYPARTY_SERVICE_KEY=sk_test_key npm test
```

## Requirements

- Node.js v22.0.0 or higher
- TypeScript 5.0+ (for TypeScript projects)

## Version History

- **v0.1.7** - Phase 1 complete: Fixed all endpoint mismatches, verified integration tests
- **v0.1.6** - Added child key management and transaction history
- **v0.1.5** - Added webhook management
- **v0.1.4** - Added recurring subscriptions
- **v0.1.3** - Security fix: Restricted child key permissions
- **v0.1.0** - Initial release with core credit operations

## License

MIT

## Support

For issues and feature requests, please visit:
https://github.com/areweai/keyparty-sdk/issues
