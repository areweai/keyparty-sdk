# KeyParty SDK

TypeScript SDK for KeyParty credit management. Single API call per operation with server-authoritative timestamps.

## Features

- Single API call per operation
- Full TypeScript support
- Zero dependencies (native Node.js fetch)
- Automatic retry logic
- Comprehensive test coverage

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
// Output: { userId: 'user_123', credits: 100, timestamp: '2025-10-26T10:00:00.000Z' }

// Add credits
const result = await client.addCredits('user_123', 50, 'Signup bonus');
console.log(`Previous: ${result.previousCredits}, New: ${result.newCredits}`);
// Output: { success: true, previousCredits: 100, newCredits: 150, operation: 'add', amount: 50, timestamp: '...', reason: 'Signup bonus' }
```


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
