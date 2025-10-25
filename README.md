# KeyParty Node.js SDK (`keyparty-sdk`)

**Official TypeScript SDK for KeyParty credit management and multi-tenant subscription billing**

[![npm version](https://img.shields.io/npm/v/keyparty-sdk.svg)](https://www.npmjs.com/package/keyparty-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

✅ **Full TypeScript Support** - Complete type definitions for all methods
✅ **Multi-Tenant Architecture** - Manage credits for your users using your own user IDs
✅ **Subscription Billing** - Recurring credit allocations with automatic renewals
✅ **Error Handling** - Comprehensive error types with retry logic
✅ **Production Ready** - Battle-tested with optimistic locking and race condition handling
✅ **Zero Dependencies** - Built on modern Node.js (v22+) with native fetch

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [AI-Assisted Setup](#ai-assisted-setup-prompt)
- [API Reference](#api-reference)
  - [Basic Credit Operations](#basic-credit-operations)
  - [External User ID Operations (Multi-Tenant)](#external-user-id-operations-multi-tenant)
  - [Subscription Management](#subscription-management)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Configuration](#configuration)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [TypeScript Types](#typescript-types)

## Installation

```bash
npm install keyparty-sdk
```

## Quick Start

```typescript
import { KeyPartyClient } from 'keyparty-sdk';

// Initialize the client with your service API key
const client = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY);

// Basic credit operations
const balance = await client.getCredits('user_123');
console.log(`Current balance: ${balance.credits}`);

await client.addCredits('user_123', 100, 'Welcome bonus');
await client.deductCredits('user_123', 5, 'API usage');

// Multi-tenant operations (recommended for SaaS applications)
const externalBalance = await client.getExternalUserCredits('app_user_456');
await client.addExternalUserCredits('app_user_456', 500, 'Monthly subscription');

// Subscription management
const subscription = await client.startExternalUserSubscription(
  'app_user_456',
  500, // 500 credits
  31,  // every 31 days
  { plan: 'pro' }
);
```

## AI-Assisted Setup Prompt

Copy this prompt to your AI assistant (Claude, ChatGPT, etc.) for guided integration:

```
I want to integrate the KeyParty Node.js SDK (keyparty-sdk) into my application. Please help me set up credit management for my users.

My application details:
- Framework: [Express/NestJS/Next.js/etc.]
- User authentication: [Auth0/Clerk/Firebase/etc.]
- Database: [PostgreSQL/MongoDB/etc.]
- Use case: [SaaS billing/API credits/game currency/etc.]

I need help with:
1. Installing and configuring the KeyParty client
2. Storing my KeyParty service API key securely in environment variables
3. Creating API endpoints to manage user credits
4. Setting up multi-tenant credit management using externalUserId
5. Implementing subscription billing for recurring credit allocation
6. Error handling and retry logic
7. TypeScript type definitions for my use case

Please guide me through the implementation step by step, providing:
- Code examples specific to my framework
- Security best practices for API key management
- Recommended patterns for credit operations (add/deduct/set)
- Subscription lifecycle management (start/stop/renew)
- Error handling strategies
- Testing approach

Additional context about my use case:
[Describe your specific requirements here]
```

## API Reference

### Initialization

```typescript
import { KeyPartyClient } from 'keyparty-sdk';

const client = new KeyPartyClient(serviceApiKey, {
  baseUrl: 'https://your-convex-deployment.convex.site', // Optional
  timeout: 15000,        // Request timeout in ms (default: 10000)
  retryAttempts: 5,      // Retry failed requests (default: 3)
  retryDelay: 2000,      // Delay between retries in ms (default: 1000)
});
```

### Basic Credit Operations

#### `getCredits(userId: string): Promise<CreditResponse>`

Get current credit balance for a user.

```typescript
const balance = await client.getCredits('user_123');
console.log(`Balance: ${balance.credits}`);
```

**Returns:**
```typescript
{
  userId: string;
  credits: number;
  timestamp: string; // ISO 8601
}
```

#### `addCredits(userId: string, amount: number, reason?: string): Promise<OperationResult>`

Add credits to a user's balance.

```typescript
const result = await client.addCredits('user_123', 100, 'Purchase credits package');
console.log(`Previous: ${result.previousCredits}, New: ${result.newCredits}`);
```

**Parameters:**
- `userId` - Internal user identifier
- `amount` - Positive integer (credits to add)
- `reason` - Optional description for audit trail

**Returns:**
```typescript
{
  success: true;
  previousCredits: number;
  newCredits: number;
  operation: 'add';
  amount: number;
  timestamp: string;
  reason?: string;
}
```

#### `deductCredits(userId: string, amount: number, reason?: string): Promise<OperationResult>`

Deduct credits from a user's balance (with insufficient funds protection).

```typescript
try {
  const result = await client.deductCredits('user_123', 5, 'API request processing');
  console.log(`Remaining: ${result.newCredits}`);
} catch (error) {
  if (error instanceof InsufficientCreditsError) {
    console.error('User does not have enough credits');
  }
}
```

#### `setCredits(userId: string, amount: number, reason?: string): Promise<OperationResult>`

Set user's credit balance to a specific value (admin operation).

```typescript
const result = await client.setCredits('user_123', 1000, 'Account reset');
```

### External User ID Operations (Multi-Tenant)

**Recommended for SaaS applications** - Use your own user IDs instead of managing KeyParty's internal user IDs.

#### `createChildKey(externalUserId, initialCredits, options?): Promise<any>`

Create a child API key associated with your application's user ID. This enables multi-tenant credit management where each of your users gets their own KeyParty credits.

```typescript
// When a user signs up in your application
const client = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY);

const result = await client.createChildKey('test123', 1000, {
  name: 'User 123 API Key',
  environment: 'production',
  metadata: {
    plan: 'premium',
    test_metadata: true,
    tier: 'business',
  }
});

console.log(`Created key: ${result.apiKey}`);
// Store result.apiKey in your database associated with user test123
```

**Parameters:**
- `externalUserId` - Your application's user ID
  - Required, non-empty string
  - Maximum 255 characters
  - Validated before operation
- `initialCredits` - Initial credit balance
  - Required, positive integer
  - Minimum value: 1
- `options` (optional):
  - `name` - Display name for the key (default: `{externalUserId} API Key`)
    - Must be non-empty when trimmed
    - Maximum 255 characters
  - `environment` - `'development' | 'staging' | 'production'` (default: `'production'`)
  - `metadata` - Custom metadata object
    - Must be a plain object (not array or null)
    - Must be JSON-serializable
    - Maximum 10KB when serialized

**Validation Rules:**
- All validations throw `ValidationError` on failure
- Parameter validation order: externalUserId → initialCredits → name → metadata
- Empty strings and whitespace-only values are rejected
- Unicode characters are supported in all string fields

#### `getExternalUserCredits(externalUserId: string): Promise<any>`

Get credit balance using your application's user ID.

```typescript
const balance = await client.getExternalUserCredits('app_user_456');
console.log(`Balance: ${balance.balance}`);
```

#### `addExternalUserCredits(externalUserId: string, amount: number, reason: string): Promise<any>`

Add credits to your user.

```typescript
const result = await client.addExternalUserCredits(
  'app_user_456',
  100,
  'Monthly subscription payment'
);
```

#### `deductExternalUserCredits(externalUserId: string, amount: number, reason: string): Promise<any>`

Deduct credits from your user.

```typescript
const result = await client.deductExternalUserCredits(
  'app_user_456',
  5,
  'API request: /analyze endpoint'
);
```

#### `setExternalUserCredits(externalUserId: string, amount: number, reason: string): Promise<any>`

Set credits for your user to a specific value.

```typescript
const result = await client.setExternalUserCredits(
  'app_user_456',
  1000,
  'Enterprise plan upgrade'
);
```

### Subscription Management

#### `startExternalUserSubscription(externalUserId, amount, validityDays?, metadata?): Promise<any>`

Start recurring credit allocation for your user.

```typescript
const subscription = await client.startExternalUserSubscription(
  'app_user_456',
  500,  // 500 credits per cycle
  31,   // every 31 days
  {
    plan: 'pro',
    tier: 'business',
    purchaseId: 'stripe_sub_123',
  }
);

console.log(`Subscription ID: ${subscription.subscription.id}`);
console.log(`Next renewal: ${new Date(subscription.subscription.nextRenewalAt)}`);
```

**Parameters:**
- `externalUserId` - Your application's user ID
- `amount` - Credits to add per cycle (positive integer)
- `validityDays` - Cycle duration (default: 31 days)
- `metadata` - Optional metadata object

**Limits:**
- Maximum 10 active subscriptions per user
- Minimum 1 credit per cycle
- Minimum 1 day validity period

#### `stopExternalUserSubscription(externalUserId, subscriptionId): Promise<any>`

Cancel a recurring subscription (credits remain valid until current cycle ends).

```typescript
const result = await client.stopExternalUserSubscription(
  'app_user_456',
  'sub_abc123def456'
);

console.log(`Subscription canceled`);
console.log(`Credits valid until: ${new Date(result.subscription.currentCycleEnd)}`);
```

#### `getExternalUserSubscriptions(externalUserId: string): Promise<any>`

Get all subscriptions for your user.

```typescript
const result = await client.getExternalUserSubscriptions('app_user_456');

console.log(`Found ${result.subscriptions.length} subscriptions`);
result.subscriptions.forEach(sub => {
  console.log(`- ${sub.amount} credits every ${sub.validityDays} days`);
  console.log(`  Status: ${sub.status}`);
  console.log(`  Renewal count: ${sub.renewalCount}`);
  console.log(`  Next renewal: ${new Date(sub.nextRenewalAt)}`);
});
```

## Authentication

### Service API Key

Your service API key is a **master credential** with full access to all operations. Protect it like a database password.

**Best Practices:**

✅ **DO:**
- Store in environment variables (`KEYPARTY_SERVICE_KEY`)
- Use server-side only (never expose to client-side code)
- Rotate periodically
- Use separate keys for development/staging/production

❌ **DON'T:**
- Commit to version control
- Expose in client-side code or browser
- Share across different services
- Log in plain text

**Example `.env` file:**
```bash
# KeyParty Configuration
KEYPARTY_SERVICE_KEY=kp_service_abc123def456...
KEYPARTY_BASE_URL=https://ideal-grouse-601.convex.site
```

## Error Handling

The SDK provides comprehensive error types:

```typescript
import {
  ValidationError,
  AuthenticationError,
  NetworkError,
  UserNotFoundError,
  InsufficientCreditsError,
} from 'keyparty-sdk';

try {
  await client.deductCredits('user_123', 100, 'API usage');
} catch (error) {
  if (error instanceof InsufficientCreditsError) {
    console.error('User does not have enough credits');
    // Redirect to purchase page
  } else if (error instanceof UserNotFoundError) {
    console.error('User not found in KeyParty system');
    // Create user first
  } else if (error instanceof AuthenticationError) {
    console.error('Invalid service API key');
    // Check environment variables
  } else if (error instanceof ValidationError) {
    console.error('Invalid input parameters');
    // Fix request parameters
  } else if (error instanceof NetworkError) {
    console.error('Network error or timeout');
    // Retry with exponential backoff
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Error Hierarchy

```
Error
├── ValidationError        - Invalid input parameters
├── AuthenticationError    - Invalid API key or unauthorized
├── UserNotFoundError      - User does not exist
├── InsufficientCreditsError - Not enough credits for operation
└── NetworkError           - Network failure or timeout
```

### Automatic Retries

The SDK automatically retries failed requests (default: 3 attempts with 1000ms delay).

**Retries are NOT applied to:**
- `ValidationError` - Fix your code
- `AuthenticationError` - Fix your API key
- `UserNotFoundError` - User doesn't exist

**Retries ARE applied to:**
- Network timeouts
- 5xx server errors
- Temporary connection issues

## Configuration

### Custom Base URL

```typescript
const client = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY, {
  baseUrl: 'https://your-convex-deployment.convex.site',
});
```

### Timeout Configuration

```typescript
const client = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY, {
  timeout: 30000, // 30 seconds for slow networks
});
```

### Retry Configuration

```typescript
const client = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY, {
  retryAttempts: 5,   // Try up to 5 times
  retryDelay: 2000,   // 2 seconds between retries
});
```

## Examples

### Express.js API Endpoint

```typescript
import express from 'express';
import { KeyPartyClient } from 'keyparty-sdk';

const app = express();
const keyparty = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY);

// Deduct credits for API usage
app.post('/api/analyze', async (req, res) => {
  const userId = req.user.id; // From your auth middleware

  try {
    // Check balance first
    const balance = await keyparty.getExternalUserCredits(userId);
    if (balance.balance < 10) {
      return res.status(402).json({
        error: 'Insufficient credits',
        balance: balance.balance,
        required: 10,
      });
    }

    // Perform the operation
    const result = await performAnalysis(req.body);

    // Deduct credits after successful operation
    await keyparty.deductExternalUserCredits(userId, 10, 'Analysis API request');

    res.json({ success: true, result });
  } catch (error) {
    console.error('KeyParty error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Subscription Billing Webhook

```typescript
import { KeyPartyClient } from 'keyparty-sdk';

const keyparty = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY);

// Stripe webhook handler
app.post('/webhooks/stripe', async (req, res) => {
  const event = req.body;

  if (event.type === 'customer.subscription.created') {
    const userId = event.data.object.metadata.userId;
    const planAmount = getPlanCredits(event.data.object.items.data[0].price.id);

    // Start KeyParty subscription
    await keyparty.startExternalUserSubscription(
      userId,
      planAmount,
      31, // monthly
      {
        stripeSubscriptionId: event.data.object.id,
        plan: event.data.object.items.data[0].price.nickname,
      }
    );
  }

  if (event.type === 'customer.subscription.deleted') {
    const userId = event.data.object.metadata.userId;
    const subscriptionId = event.data.object.metadata.keypartySubscriptionId;

    // Stop KeyParty subscription
    await keyparty.stopExternalUserSubscription(userId, subscriptionId);
  }

  res.json({ received: true });
});
```

### React Server Component (Next.js 14+)

```typescript
import { KeyPartyClient } from 'keyparty-sdk';

const keyparty = new KeyPartyClient(process.env.KEYPARTY_SERVICE_KEY!);

export default async function DashboardPage() {
  const userId = await getCurrentUserId(); // Your auth function

  const [balance, subscriptions] = await Promise.all([
    keyparty.getExternalUserCredits(userId),
    keyparty.getExternalUserSubscriptions(userId),
  ]);

  return (
    <div>
      <h1>Credit Balance: {balance.balance}</h1>
      <h2>Active Subscriptions:</h2>
      <ul>
        {subscriptions.subscriptions.map(sub => (
          <li key={sub.id}>
            {sub.amount} credits every {sub.validityDays} days ({sub.status})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Best Practices

### 1. Use External User IDs

**✅ Recommended:**
```typescript
await client.addExternalUserCredits('app_user_456', 100, 'Purchase');
```

**❌ Not Recommended:**
```typescript
await client.addCredits('clerk_2a1b3c4d', 100, 'Purchase');
```

### 2. Always Provide Reason

Helps with debugging and audit trails:

```typescript
await client.deductExternalUserCredits(
  userId,
  5,
  `API request: ${req.method} ${req.path}`
);
```

### 3. Check Balance Before Deducting

```typescript
const balance = await client.getExternalUserCredits(userId);
if (balance.balance < requiredCredits) {
  throw new InsufficientCreditsError('Not enough credits');
}
await client.deductExternalUserCredits(userId, requiredCredits, 'API usage');
```

### 4. Handle Errors Gracefully

```typescript
try {
  await client.deductExternalUserCredits(userId, amount, reason);
} catch (error) {
  if (error instanceof InsufficientCreditsError) {
    return { error: 'insufficient_credits', upgradeUrl: '/pricing' };
  }
  throw error; // Re-throw unexpected errors
}
```

### 5. Store Subscription IDs

When creating subscriptions, store the subscription ID in your database for future cancellation:

```typescript
const subscription = await client.startExternalUserSubscription(userId, 500, 31);

await db.users.update(userId, {
  keypartySubscriptionId: subscription.subscription.id,
});
```

## TypeScript Types

The SDK includes full TypeScript definitions:

```typescript
import type {
  KeyPartyConfig,
  CreditResponse,
  OperationResult,
  BatchOperationResult,
} from 'keyparty-sdk';

const config: KeyPartyConfig = {
  baseUrl: 'https://your-deployment.convex.site',
  timeout: 15000,
  retryAttempts: 3,
  retryDelay: 1000,
};

const result: OperationResult = await client.addCredits('user_123', 100, 'Bonus');
```

## Support & Documentation

- **GitHub Issues**: [Report bugs or request features](https://github.com/areweai/keyparty-sdk/issues)
- **npm Package**: [keyparty-sdk on npm](https://www.npmjs.com/package/keyparty-sdk)
- **License**: MIT

## License

MIT © Arewe.ai

---

**Built with ❤️ by the KeyParty team**
