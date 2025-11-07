/**
 * Phase 1 Integration Tests
 *
 * Tests actual SDK methods against live backend endpoints.
 * Requires KEYPARTY_SERVICE_KEY environment variable.
 *
 * Run with: KEYPARTY_SERVICE_KEY=sk_xxx npm test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { KeyPartyClient } from '../client.js';

const SERVICE_KEY = process.env.KEYPARTY_SERVICE_KEY;
const BASE_URL = process.env.KEYPARTY_BASE_URL;
const SKIP_INTEGRATION = !SERVICE_KEY;

// Test constants
const TEST_USER_ID = `test_user_${Date.now()}`;
const TEST_CREDITS = 1000;

describe.skipIf(SKIP_INTEGRATION)('Phase 1 Integration Tests', () => {
  let client: KeyPartyClient;
  let childKeyHash: string;

  beforeAll(() => {
    if (!SERVICE_KEY) {
      console.warn('⚠️  KEYPARTY_SERVICE_KEY not set - skipping Phase 1 integration tests');
      return;
    }
    // Use custom base URL if provided (for testing against different deployments)
    client = new KeyPartyClient(SERVICE_KEY, BASE_URL ? { baseUrl: BASE_URL } : undefined);
    if (BASE_URL) {
      console.log(`✅ Testing against custom base URL: ${BASE_URL}`);
    }
  });

  describe('Child Key Management', () => {
    it('should create a child key for testing', async () => {
      const result = await client.createChildKey(TEST_USER_ID, TEST_CREDITS, {
        name: 'Phase 1 Integration Test Key',
        environment: 'development',
      });

      expect(result.apiKey).toBeDefined();
      expect(result.externalUserId).toBe(TEST_USER_ID);
      expect(result.credits).toBe(TEST_CREDITS);

      childKeyHash = result.apiKey;
    });

    it('should list child keys', async () => {
      const result = await client.listChildKeys({
        environment: 'development',
        includeRevoked: false,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.childKeys).toBeInstanceOf(Array);
      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.total).toBeGreaterThanOrEqual(1);
    });

    it('should list child keys for specific user', async () => {
      const result = await client.listChildKeys({
        externalUserId: TEST_USER_ID,
      });

      expect(result.success).toBe(true);
      expect(result.data.childKeys).toBeInstanceOf(Array);
      const testUserKeys = result.data.childKeys.filter(
        k => k.externalUserId === TEST_USER_ID
      );
      expect(testUserKeys.length).toBeGreaterThanOrEqual(1);
    });

    it('should get child key status', async () => {
      if (!childKeyHash) {
        expect.fail('childKeyHash not set - create test skipped or failed');
      }

      const result = await client.getChildKeyStatus(childKeyHash);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.status).toBe('active');
      expect(result.data.metrics24h).toBeDefined();
    });

    it('should get child key metadata', async () => {
      if (!childKeyHash) {
        expect.fail('childKeyHash not set');
      }

      const result = await client.getChildKeyMetadata(childKeyHash);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.childKeyId).toBeDefined();
    });

    it('should update child key metadata', async () => {
      if (!childKeyHash) {
        expect.fail('childKeyHash not set');
      }

      const metadata = {
        tier: 'test',
        testRun: true,
        timestamp: Date.now(),
      };

      const result = await client.updateChildKeyMetadata(childKeyHash, metadata);

      expect(result.success).toBe(true);
      expect(result.data.metadata).toEqual(metadata);
    });
  });

  describe('Transaction History', () => {
    it('should get transaction history for user', async () => {
      const result = await client.getTransactionHistory(TEST_USER_ID, {
        limit: 10,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.userId).toBe(TEST_USER_ID);
      expect(result.data.transactions).toBeInstanceOf(Array);
      expect(result.data.pagination).toBeDefined();
      expect(result.data.pagination.limit).toBe(10);
    });

    it('should filter transactions by type', async () => {
      const result = await client.getTransactionHistory(TEST_USER_ID, {
        type: 'increase',
        limit: 5,
      });

      expect(result.success).toBe(true);
      expect(result.data.transactions).toBeInstanceOf(Array);

      // All transactions should be 'increase' type
      result.data.transactions.forEach(tx => {
        expect(tx.type).toBe('increase');
      });
    });

    it('should filter transactions by date range', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Last 7 days

      const result = await client.getTransactionHistory(TEST_USER_ID, {
        startDate,
        endDate,
        limit: 20,
      });

      expect(result.success).toBe(true);
      expect(result.data.transactions).toBeInstanceOf(Array);

      // All transactions should be within date range
      result.data.transactions.forEach(tx => {
        expect(tx.timestamp).toBeGreaterThanOrEqual(startDate.getTime());
        expect(tx.timestamp).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    it('should handle pagination correctly', async () => {
      const page1 = await client.getTransactionHistory(TEST_USER_ID, {
        limit: 2,
        offset: 0,
      });

      const page2 = await client.getTransactionHistory(TEST_USER_ID, {
        limit: 2,
        offset: 2,
      });

      expect(page1.success).toBe(true);
      expect(page2.success).toBe(true);

      // Pages should have different transactions
      if (page1.data.transactions.length > 0 && page2.data.transactions.length > 0) {
        expect(page1.data.transactions[0].id).not.toBe(page2.data.transactions[0].id);
      }
    });
  });

  describe('Cleanup', () => {
    it('should revoke test child key', async () => {
      if (!childKeyHash) {
        console.warn('⚠️  No childKeyHash to revoke - skipping cleanup');
        return;
      }

      const result = await client.revokeChildKey(childKeyHash);

      expect(result.success).toBe(true);
      expect(result.data.previousStatus).toBe('active');
      expect(result.data.newStatus).toBe('revoked');
    });
  });
});

// Print helpful message if integration tests are skipped
if (SKIP_INTEGRATION) {
  console.log('\n⚠️  Phase 1 integration tests skipped');
  console.log('Set KEYPARTY_SERVICE_KEY environment variable to run integration tests');
  console.log('Example: KEYPARTY_SERVICE_KEY=sk_xxx npm test\n');
}
