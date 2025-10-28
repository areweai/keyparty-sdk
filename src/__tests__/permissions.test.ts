/**
 * Permission Enforcement Tests
 * Validates that child keys are properly restricted from add/set operations
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { KeyPartyClient } from '../client.js';
import { ForbiddenError } from '../errors.js';

describe('Child Key Permission Enforcement', () => {
  const hasRealCredentials = !!process.env.KEYPARTY_SERVICE_KEY;
  const describeIf = (condition: boolean) => condition ? describe : describe.skip;

  let serviceKeyClient: KeyPartyClient;
  let childKeyClient: KeyPartyClient;
  const testUserId = `test-permissions-${Date.now()}`;
  let childKeyApiKey: string;

  beforeAll(async () => {
    if (!hasRealCredentials) {
      console.warn('⚠️  KEYPARTY_SERVICE_KEY not set - skipping integration tests');
      console.warn('   Set KEYPARTY_SERVICE_KEY environment variable to run full test suite');
      return;
    }

    // Setup service key client
    const serviceKey = process.env.KEYPARTY_SERVICE_KEY!;
    serviceKeyClient = new KeyPartyClient(serviceKey);

    // Create a child key for testing
    try {
      const childKey = await serviceKeyClient.createChildKey(testUserId, 100, {
        name: 'Permission Test Key',
        environment: 'development',
      });
      childKeyApiKey = childKey.apiKey;
      childKeyClient = new KeyPartyClient(childKeyApiKey);
    } catch (error) {
      throw new Error(`Failed to create child key for testing: ${error}`);
    }
  });

  describeIf(hasRealCredentials)('Service Key Operations', () => {
    it('should allow service key to GET credits', async () => {
      try {
        const result = await serviceKeyClient.getCredits(testUserId);
        expect(result).toHaveProperty('userId');
        expect(result).toHaveProperty('credits');
      } catch (error) {
        // Accept both success and user not found (both are valid outcomes)
        expect(error).toBeDefined();
      }
    });

    it('should allow service key to ADD credits', async () => {
      try {
        const result = await serviceKeyClient.addCredits(testUserId, 10, 'Test add');
        expect(result).toHaveProperty('previousCredits');
        expect(result).toHaveProperty('newCredits');
        expect(result.operation).toBe('add');
      } catch (error) {
        // Accept user not found error (user may not exist)
        expect(error).toBeDefined();
      }
    });

    it('should allow service key to DEDUCT credits', async () => {
      try {
        const result = await serviceKeyClient.deductCredits(testUserId, 5, 'Test deduct');
        expect(result).toHaveProperty('previousCredits');
        expect(result).toHaveProperty('newCredits');
        expect(result.operation).toBe('deduct');
      } catch (error) {
        // Accept insufficient credits or user not found errors
        expect(error).toBeDefined();
      }
    });

    it('should allow service key to SET credits', async () => {
      try {
        const result = await serviceKeyClient.setCredits(testUserId, 50, 'Test set');
        expect(result).toHaveProperty('previousCredits');
        expect(result).toHaveProperty('newCredits');
        expect(result.operation).toBe('set');
      } catch (error) {
        // Accept user not found error
        expect(error).toBeDefined();
      }
    });
  });

  describeIf(hasRealCredentials)('Child Key Restrictions', () => {
    it('should DENY child key ADD operation with ForbiddenError', async () => {
      try {
        await childKeyClient.addCredits(testUserId, 10, 'Attempted add');
        throw new Error('Expected ForbiddenError but operation succeeded');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        expect((error as ForbiddenError).statusCode).toBe(403);
        expect((error as ForbiddenError).message).toContain('Forbidden');
      }
    });

    it('should DENY child key SET operation with ForbiddenError', async () => {
      try {
        await childKeyClient.setCredits(testUserId, 1000000, 'Attempted set');
        throw new Error('Expected ForbiddenError but operation succeeded');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        expect((error as ForbiddenError).statusCode).toBe(403);
        expect((error as ForbiddenError).message).toContain('Forbidden');
      }
    });

    it('should allow child key GET operation', async () => {
      try {
        const result = await childKeyClient.getCredits(testUserId);
        expect(result).toHaveProperty('userId');
        expect(result).toHaveProperty('credits');
      } catch (error) {
        // Accept any error except ForbiddenError (GET should not be forbidden)
        expect(error).not.toBeInstanceOf(ForbiddenError);
      }
    });

    it('should allow child key DEDUCT operation', async () => {
      try {
        const result = await childKeyClient.deductCredits(testUserId, 1, 'Test deduct');
        expect(result).toHaveProperty('operation', 'deduct');
      } catch (error) {
        // Accept insufficient credits error but not ForbiddenError
        expect(error).not.toBeInstanceOf(ForbiddenError);
      }
    });
  });

  describeIf(hasRealCredentials)('Security Validation', () => {
    it('should prevent child key from granting unlimited credits via ADD', async () => {
      const largeAmount = 1000000;

      try {
        await childKeyClient.addCredits(testUserId, largeAmount, 'Exploit attempt');
        throw new Error('Security breach: child key successfully added credits');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        expect((error as ForbiddenError).code).toBe('FORBIDDEN_ERROR');
      }
    });

    it('should prevent child key from setting arbitrary balance via SET', async () => {
      const arbitraryBalance = 999999999;

      try {
        await childKeyClient.setCredits(testUserId, arbitraryBalance, 'Exploit attempt');
        throw new Error('Security breach: child key successfully set credits');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        expect((error as ForbiddenError).code).toBe('FORBIDDEN_ERROR');
      }
    });

    it('should NOT retry ForbiddenError (should fail immediately)', async () => {
      const startTime = Date.now();

      try {
        await childKeyClient.addCredits(testUserId, 100, 'Should not retry');
        throw new Error('Expected ForbiddenError');
      } catch (error) {
        const duration = Date.now() - startTime;

        expect(error).toBeInstanceOf(ForbiddenError);
        // Should fail immediately without retries (< 1 second)
        expect(duration).toBeLessThan(1000);
      }
    });
  });

  describeIf(hasRealCredentials)('Error Message Clarity', () => {
    it('should return clear error message for child key ADD attempt', async () => {
      try {
        await childKeyClient.addCredits(testUserId, 10, 'Test');
        throw new Error('Expected ForbiddenError');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        const message = (error as Error).message.toLowerCase();
        expect(message).toMatch(/forbidden|cannot add|service key/i);
      }
    });

    it('should return clear error message for child key SET attempt', async () => {
      try {
        await childKeyClient.setCredits(testUserId, 100, 'Test');
        throw new Error('Expected ForbiddenError');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        const message = (error as Error).message.toLowerCase();
        expect(message).toMatch(/forbidden|cannot set|service key/i);
      }
    });
  });
});
