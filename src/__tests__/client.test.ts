/**
 * Tests for KeyPartyClient core functionality
 * Covers constructor, request method, and all credit operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyPartyClient } from '../client.js';
import { ValidationError, AuthenticationError, NetworkError, UserNotFoundError, InsufficientCreditsError, RateLimitError } from '../errors.js';

describe('KeyPartyClient', () => {
  describe('Constructor', () => {
    it('should create client with valid service key', () => {
      expect(() => new KeyPartyClient('sk_test_key')).not.toThrow();
    });

    it('should throw ValidationError for missing service key', () => {
      expect(() => new KeyPartyClient(null as any)).toThrow(ValidationError);
      expect(() => new KeyPartyClient(undefined as any)).toThrow(ValidationError);
      expect(() => new KeyPartyClient('' as any)).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-string service key', () => {
      expect(() => new KeyPartyClient(123 as any)).toThrow('Service key is required');
      expect(() => new KeyPartyClient({} as any)).toThrow(ValidationError);
    });

    it('should throw ValidationError for service key without sk_ prefix', () => {
      expect(() => new KeyPartyClient('test_key')).toThrow('Service key must start with "sk_"');
      expect(() => new KeyPartyClient('pk_test_key')).toThrow('Service key must start with "sk_"');
    });

    it('should accept optional configuration', () => {
      const client = new KeyPartyClient('sk_test_key', {
        timeout: 5000,
        retryAttempts: 5,
        retryDelay: 2000,
      });
      expect(client).toBeInstanceOf(KeyPartyClient);
    });
  });

  describe('getCredits', () => {
    let client: KeyPartyClient;
    let mockRequest: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      client = new KeyPartyClient('sk_test_key');
      mockRequest = vi.spyOn(client as any, 'request');
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should get credits for valid user', async () => {
      // API now returns flat response with userId, credits, timestamp
      mockRequest.mockResolvedValue({
        userId: 'user_123',
        credits: 100,
        timestamp: '2025-10-26T10:00:00.000Z'
      });

      const result = await client.getCredits('user_123');

      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/credits/get', { userId: 'user_123' });
      expect(result.userId).toBe('user_123');
      expect(result.credits).toBe(100);
      expect(result.timestamp).toBe('2025-10-26T10:00:00.000Z');
    });

    it('should validate userId before making request', async () => {
      await expect(client.getCredits('')).rejects.toThrow('userId cannot be empty');
      await expect(client.getCredits('   ')).rejects.toThrow('userId cannot be empty');
      await expect(client.getCredits('a'.repeat(256))).rejects.toThrow('userId must be 255 characters or less');
    });
  });

  describe('addCredits', () => {
    let client: KeyPartyClient;
    let mockRequest: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      client = new KeyPartyClient('sk_test_key');
      mockRequest = vi.spyOn(client as any, 'request');
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should add credits successfully', async () => {
      // API now returns complete OperationResult with all data in single call
      mockRequest.mockResolvedValue({
        success: true,
        userId: 'user_123',
        previousCredits: 100,
        newCredits: 110,
        operation: 'add' as const,
        amount: 10,
        timestamp: '2025-10-26T10:00:00.000Z',
        reason: 'Bonus'
      });

      const result = await client.addCredits('user_123', 10, 'Bonus');

      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/credits/add', {
        userId: 'user_123',
        amount: 10,
        reason: 'Bonus',
      });
      expect(result.success).toBe(true);
      expect(result.previousCredits).toBe(100);
      expect(result.newCredits).toBe(110);
      expect(result.operation).toBe('add');
      expect(result.amount).toBe(10);
      expect(result.reason).toBe('Bonus');
    });

    it('should use default reason when not provided', async () => {
      mockRequest.mockResolvedValue({
        success: true,
        userId: 'user_123',
        previousCredits: 50,
        newCredits: 60,
        operation: 'add' as const,
        amount: 10,
        timestamp: '2025-10-26T10:00:00.000Z',
        reason: 'Credit addition'
      });

      await client.addCredits('user_123', 10);

      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/credits/add', {
        userId: 'user_123',
        amount: 10,
        reason: 'Credit addition',
      });
    });

    it('should validate amount is positive integer', async () => {
      await expect(client.addCredits('user_123', 0)).rejects.toThrow('amount must be positive');
      await expect(client.addCredits('user_123', -5)).rejects.toThrow('amount must be positive');
      await expect(client.addCredits('user_123', 10.5)).rejects.toThrow('amount must be an integer');
    });
  });

  describe('deductCredits', () => {
    let client: KeyPartyClient;
    let mockRequest: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      client = new KeyPartyClient('sk_test_key');
      mockRequest = vi.spyOn(client as any, 'request');
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should deduct credits successfully', async () => {
      // API now returns complete OperationResult with all data in single call
      mockRequest.mockResolvedValue({
        success: true,
        userId: 'user_123',
        previousCredits: 100,
        newCredits: 95,
        operation: 'deduct' as const,
        amount: 5,
        timestamp: '2025-10-26T10:00:00.000Z',
        reason: 'Usage'
      });

      const result = await client.deductCredits('user_123', 5, 'Usage');

      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/credits/deduct', {
        userId: 'user_123',
        amount: 5,
        reason: 'Usage',
      });
      expect(result.success).toBe(true);
      expect(result.previousCredits).toBe(100);
      expect(result.newCredits).toBe(95);
      expect(result.operation).toBe('deduct');
      expect(result.amount).toBe(5);
    });

    it('should validate amount is positive integer', async () => {
      await expect(client.deductCredits('user_123', 0)).rejects.toThrow('amount must be positive');
      await expect(client.deductCredits('user_123', -5)).rejects.toThrow('amount must be positive');
    });
  });

  describe('setCredits', () => {
    let client: KeyPartyClient;
    let mockRequest: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      client = new KeyPartyClient('sk_test_key');
      mockRequest = vi.spyOn(client as any, 'request');
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should set credits to specific value', async () => {
      // API now returns complete OperationResult with all data in single call
      mockRequest.mockResolvedValue({
        success: true,
        userId: 'user_123',
        previousCredits: 100,
        newCredits: 50,
        operation: 'set' as const,
        amount: 50,
        timestamp: '2025-10-26T10:00:00.000Z',
        reason: 'Reset'
      });

      const result = await client.setCredits('user_123', 50, 'Reset');

      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/credits/set', {
        userId: 'user_123',
        amount: 50,
        reason: 'Reset',
      });
      expect(result.success).toBe(true);
      expect(result.previousCredits).toBe(100);
      expect(result.newCredits).toBe(50);
      expect(result.operation).toBe('set');
      expect(result.amount).toBe(50);
    });

    it('should allow setting credits to zero', async () => {
      mockRequest.mockResolvedValue({
        success: true,
        userId: 'user_123',
        previousCredits: 100,
        newCredits: 0,
        operation: 'set' as const,
        amount: 0,
        timestamp: '2025-10-26T10:00:00.000Z',
        reason: 'Credit balance update'
      });

      const result = await client.setCredits('user_123', 0);

      expect(result.newCredits).toBe(0);
    });

    it('should not allow negative credits', async () => {
      await expect(client.setCredits('user_123', -10)).rejects.toThrow('amount cannot be negative');
    });
  });

  describe('batchOperation', () => {
    let client: KeyPartyClient;
    let addCreditsSpy: ReturnType<typeof vi.spyOn>;
    let deductCreditsSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      client = new KeyPartyClient('sk_test_key');
      addCreditsSpy = vi.spyOn(client, 'addCredits') as any;
      deductCreditsSpy = vi.spyOn(client, 'deductCredits') as any;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should execute batch add operations', async () => {
      const mockResult = {
        success: true,
        previousCredits: 100,
        newCredits: 101,
        operation: 'add' as const,
        amount: 1,
        timestamp: new Date().toISOString(),
      };

      addCreditsSpy.mockResolvedValue(mockResult);

      const result = await client.batchOperation('add', 'user_123', 3);

      expect(addCreditsSpy).toHaveBeenCalledTimes(3);
      expect(result.totalSuccessful).toBe(3);
      expect(result.totalFailed).toBe(0);
      expect(result.operations).toHaveLength(3);
    });

    it('should execute batch deduct operations', async () => {
      const mockResult = {
        success: true,
        previousCredits: 100,
        newCredits: 99,
        operation: 'deduct' as const,
        amount: 1,
        timestamp: new Date().toISOString(),
      };

      deductCreditsSpy.mockResolvedValue(mockResult);

      const result = await client.batchOperation('deduct', 'user_123', 5);

      expect(deductCreditsSpy).toHaveBeenCalledTimes(5);
      expect(result.totalSuccessful).toBe(5);
    });

    it('should handle partial failures in batch operations', async () => {
      addCreditsSpy
        .mockResolvedValueOnce({
          success: true,
          previousCredits: 100,
          newCredits: 101,
          operation: 'add' as const,
          amount: 1,
          timestamp: new Date().toISOString(),
        })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          previousCredits: 101,
          newCredits: 102,
          operation: 'add' as const,
          amount: 1,
          timestamp: new Date().toISOString(),
        });

      const result = await client.batchOperation('add', 'user_123', 3);

      expect(result.totalSuccessful).toBe(2);
      expect(result.totalFailed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Network error');
    });

    it('should validate count is between 1 and 100', async () => {
      await expect(client.batchOperation('add', 'user_123', 0))
        .rejects.toThrow('count must be between 1 and 100');
      await expect(client.batchOperation('add', 'user_123', 101))
        .rejects.toThrow('count must be between 1 and 100');
      await expect(client.batchOperation('add', 'user_123', 1.5))
        .rejects.toThrow('count must be between 1 and 100');
    });
  });

  describe('request method error handling', () => {
    let client: KeyPartyClient;

    beforeEach(() => {
      client = new KeyPartyClient('sk_test_key');
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should throw UserNotFoundError for missing user', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'User not found: user_123' }),
      });

      await expect(client.getCredits('user_123')).rejects.toThrow(UserNotFoundError);
    });

    it('should throw AuthenticationError for missing API key', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'Missing API key' }),
      });

      await expect(client.getCredits('user_123')).rejects.toThrow(AuthenticationError);
    });

    it('should throw InsufficientCreditsError when credits are insufficient', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'Insufficient credits' }),
      });

      await expect(client.getCredits('user_123')).rejects.toThrow(InsufficientCreditsError);
    });

    it('should throw AuthenticationError for 401 status', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ success: false, error: 'Unauthorized' }),
      });

      await expect(client.getCredits('user_123')).rejects.toThrow('Invalid service key');
    });

    it('should throw RateLimitError for 429 rate limit', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ success: false, error: 'Rate limited' }),
      });

      await expect(client.getCredits('user_123')).rejects.toThrow(RateLimitError);
    });

    it('should retry on network errors', async () => {
      const client = new KeyPartyClient('sk_test_key', { retryAttempts: 2, retryDelay: 10 });

      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ userId: 'user_123', credits: 100, timestamp: '2025-10-26T10:00:00.000Z' }),
        });

      const result = await client.getCredits('user_123');

      expect(result.credits).toBe(100);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw NetworkError after max retries', async () => {
      const client = new KeyPartyClient('sk_test_key', { retryAttempts: 1, retryDelay: 10 });

      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(client.getCredits('user_123')).rejects.toThrow(NetworkError);
      expect(global.fetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should not retry on ValidationError', async () => {
      // Validation happens before request, so this tests early exit
      await expect(client.getCredits('')).rejects.toThrow(ValidationError);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
