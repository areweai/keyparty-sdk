# KeyParty SDK

TypeScript SDK for KeyParty credit management. Single API call per operation with server-authoritative timestamps.

## Features

- Single API call per operation
- Full TypeScript support
- Zero dependencies (native Node.js fetch)
- Automatic retry logic
- Comprehensive test coverage
- Secure permission model with child key support
- Recurring subscriptions with automated credit renewals
- Webhook management with event subscriptions
- Child key lifecycle management and monitoring
- Transaction history with comprehensive audit trails

## Installation

```bash
npm install keyparty-sdk
```

## Quick Start

```typescript
import { KeyPartyClient } from 'keyparty-sdk';

// Initialize client with service key (for SaaS service owners)
const client = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY);

// Get current balance
const balance = await client.getCredits('user_123');
console.log(`Balance: ${balance.credits}`);
// Output: { userId: 'user_123', credits: 100, timestamp: '2025-10-26T10:00:00.000Z' }

// Add credits (service keys only)
const result = await client.addCredits('user_123', 50, 'Signup bonus');
console.log(`Previous: ${result.previousCredits}, New: ${result.newCredits}`);
// Output: { success: true, previousCredits: 100, newCredits: 150, operation: 'add', amount: 50, timestamp: '...', reason: 'Signup bonus' }
```

## Security & Permission Model

### Key Types

**Service Key (`sk_*`)** - Full administrative access
- Held by SaaS service owner
- Can add, deduct, set, and get credits for any user
- Can create child keys for end users
- Required for credit management operations

**Child Key (`ck_pk_*`)** - Limited user access
- Given to end users to manage their own credits
- Can get their credit balance (read-only)
- Can deduct credits for their own usage
- **Cannot** add or set credits (security restriction)

### Permission Matrix

| Operation | Service Key (`sk_*`) | Child Key (`ck_pk_*`) |
|-----------|---------------------|----------------------|
| Get Credits | ✅ Yes | ✅ Yes |
| Deduct Credits | ✅ Yes | ✅ Yes |
| Add Credits | ✅ Yes | ❌ No (403 Forbidden) |
| Set Credits | ✅ Yes | ❌ No (403 Forbidden) |
| Create Child Keys | ✅ Yes | ❌ No |

### ⚠️ Important: Security Fix (v0.1.3)

**Breaking Change:** As of v0.1.3, child keys can no longer call `/api/credits/add` or `/api/credits/set` endpoints.

**Why this changed:**
- This was a **critical security vulnerability** where child keys could grant themselves unlimited credits
- Child keys are meant for end users to spend credits, not add them
- Only service keys (held by the SaaS owner) should be able to add or modify credit balances

**Migration:**
```typescript
// ❌ BEFORE (vulnerable - no longer works)
const childKey = new KeyPartyClient('ck_pk_...');
await childKey.addCredits('user_123', 100); // Throws ForbiddenError

// ✅ AFTER (correct - use service key for credit management)
const serviceKey = new KeyPartyClient('sk_...');
await serviceKey.addCredits('user_123', 100); // Works correctly
```

If you receive a `ForbiddenError`, you are using a child key for an operation that requires a service key.


## Error Handling

The SDK provides comprehensive error types for different failure scenarios:

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
    // Child key attempted operation requiring service key
    console.error('Permission denied: Use service key for this operation');
  } else if (error instanceof InsufficientCreditsError) {
    // User doesn't have enough credits
    console.error('Not enough credits');
  } else if (error instanceof UserNotFoundError) {
    // User doesn't exist in system
    console.error('User not found');
  } else if (error instanceof AuthenticationError) {
    // Invalid API key
    console.error('Invalid service key');
  } else if (error instanceof ValidationError) {
    // Invalid parameters
    console.error('Invalid input');
  } else if (error instanceof NetworkError) {
    // Network failure (will retry automatically)
    console.error('Network error');
  }
}
```

### Error Types

| Error | Status Code | Description | Retryable |
|-------|------------|-------------|-----------|
| `ForbiddenError` | 403 | Permission denied (e.g., child key adding credits) | No |
| `AuthenticationError` | 401 | Invalid API key | No |
| `ValidationError` | 400 | Invalid input parameters | No |
| `UserNotFoundError` | 404 | User does not exist | No |
| `InsufficientCreditsError` | 402 | Not enough credits | No |
| `RateLimitError` | 429 | Too many requests | No |
| `NetworkError` | - | Network failure or timeout | Yes (automatic) |

## API Reference

### Constructor

```typescript
const client = new KeyPartyClient(serviceKey, config?)
```

Optional config: `baseUrl`, `timeout`, `retryAttempts`, `retryDelay`

### getCredits()

```typescript
const balance = await client.getCredits('user_123');
// Returns: { userId, credits, timestamp }
```

### addCredits()

```typescript
const result = await client.addCredits('user_123', 100, 'Referral bonus');
// Returns: { success, userId, previousCredits, newCredits, operation, amount, timestamp, reason }
```

### deductCredits()

```typescript
const result = await client.deductCredits('user_123', 10, 'API usage');
// Returns: { success, userId, previousCredits, newCredits, operation, amount, timestamp, reason }
```

### setCredits()

```typescript
const result = await client.setCredits('user_123', 1000, 'Account reset');
// Returns: { success, userId, previousCredits, newCredits, operation, amount, timestamp, reason }
```

### batchOperation()

```typescript
const results = await client.batchOperation('add', 'user_123', 10);
// Returns: { operations, totalSuccessful, totalFailed, errors }
```

### createChildKey()

```typescript
const childKey = await client.createChildKey('user_123', 1000, {
  name: 'Production API Key',
  environment: 'production'
});
// Returns: { apiKey, externalUserId, credits }
```

### Subscriptions

```typescript
// Start monthly subscription (100 credits every 31 days)
const sub = await client.startSubscription('user_123', 100, 31);
// Returns: { success, subscription: { id, amount, validityDays, status: 'active', ... }, message }

// Get user's subscriptions
const status = await client.getSubscriptionStatus('user_123');
// Returns: { success, subscriptions: [{ id, amount, status, ... }] }

// Stop subscription (credits remain until cycle end)
await client.stopSubscription('user_123', 'sub_id');
// Returns: { success, subscription: { status: 'canceled', ... }, message }

// Multi-tenant subscriptions (manage subscriptions for your users)
await client.startExternalUserSubscription('external_user_id', 100, 31);
await client.getExternalUserSubscriptionStatus('external_user_id');
await client.stopExternalUserSubscription('external_user_id', 'sub_id');
```

### Webhooks (v0.1.5+)

```typescript
// Create webhook for credit events
const webhook = await client.createWebhook({
  name: 'Credit Alerts',
  url: 'https://example.com/webhooks/credits',
  events: ['credits.low_threshold', 'credits.exhausted'],
  lowCreditThreshold: 50,
  description: 'Alert when credits run low'
});
// Returns: { success, data: { webhookId, secret }, timestamp }
// ⚠️ Store the secret securely - only shown once!

// List all webhooks
const webhooks = await client.listWebhooks();
// Optional: Filter by status
const activeWebhooks = await client.listWebhooks('enabled');

// Get webhook details
const details = await client.getWebhook('webhook_id');

// Update webhook configuration
await client.updateWebhook('webhook_id', {
  events: ['child_key.created', 'child_key.revoked'],
  status: 'disabled'
});

// Rotate webhook secret (for security)
const newSecret = await client.rotateWebhookSecret('webhook_id');
// Returns: { success, data: { secret, message }, timestamp }

// Delete webhook
await client.deleteWebhook('webhook_id');
```

**Available Webhook Events:**
- `service_key.rotated` - Service key was rotated
- `service_key.created` - New service key created
- `child_key.created` - Child API key generated
- `child_key.revoked` - Child API key revoked
- `credits.low_threshold` - Credits below threshold
- `credits.exhausted` - Credits reached zero

### Child Key Management (v0.1.6+)

```typescript
// List all child keys with filtering
const childKeys = await client.listChildKeys({
  environment: 'production',
  externalUserId: 'user_123',
  includeRevoked: false
});
// Returns: { success, data: { childKeys: [...], summary: { total, active, revoked, byEnvironment } }, timestamp }

// Revoke compromised key (irreversible)
await client.revokeChildKey('child_key_id');
// Returns: { success, data: { childKeyId, previousStatus, newStatus, revokedAt, message }, timestamp }

// Get detailed key health metrics
const status = await client.getChildKeyStatus('child_key_id');
// Returns: { success, data: { id, status, metrics24h, credits, rateLimit, ... }, timestamp }

// Custom metadata management
const metadata = await client.getChildKeyMetadata('child_key_id');
await client.updateChildKeyMetadata('child_key_id', {
  department: 'Engineering',
  project: 'Mobile App',
  version: '2.0'
});
// Max 10KB JSON metadata per key
```

### Transaction History (v0.1.6+)

```typescript
// Get paginated transaction history
const history = await client.getTransactionHistory('user_123', {
  limit: 50,
  offset: 0,
  type: 'deduct',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31')
});
// Returns: { success, data: { userId, transactions: [...], pagination: { total, limit, offset, hasMore } }, timestamp }

// Get specific transaction details (idempotency check)
const transaction = await client.getTransactionById('transaction_uuid');
// Returns: { success, data: { id, type, amount, previousBalance, newBalance, status, metadata, ... }, timestamp }

// Transaction types: 'deduct' | 'increase' | 'set'
// Transaction status: 'completed' | 'failed' | 'rolled_back'
```

## Configuration

### Environment Variables

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

## Requirements

Node.js v22.0.0 or higher

## License

MIT
