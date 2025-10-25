/**
 * Tests for KeyPartyClient.createChildKey method
 * Comprehensive validation and edge case coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyPartyClient } from '../client.js';
import { ValidationError } from '../errors.js';

describe('KeyPartyClient.createChildKey', () => {
  let client: KeyPartyClient;
  let mockRequest: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new KeyPartyClient('sk_test_key');
    mockRequest = vi.spyOn(client as any, 'request').mockResolvedValue({
      apiKey: 'sk_child_test_key',
      externalUserId: 'user_123',
      credits: 1000
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('successful key creation', () => {
    it('should create child key with minimal required parameters', async () => {
      const result = await client.createChildKey('user_123', 1000);

      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/keys/create', {
        name: 'user_123 API Key',
        environment: 'production',
        externalUserId: 'user_123',
        credits: 1000,
        metadata: undefined
      });
      expect(result.apiKey).toBe('sk_child_test_key');
    });

    it('should create child key with all optional parameters', async () => {
      const metadata = { plan: 'premium', tier: 'business', test_metadata: true };

      await client.createChildKey('user_456', 500, {
        name: 'Custom API Key Name',
        environment: 'development',
        metadata
      });

      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/keys/create', {
        name: 'Custom API Key Name',
        environment: 'development',
        externalUserId: 'user_456',
        credits: 500,
        metadata
      });
    });

    it('should use default values when options are partially provided', async () => {
      await client.createChildKey('user_789', 250, { name: 'Partial Options' });

      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/keys/create', {
        name: 'Partial Options',
        environment: 'production',
        externalUserId: 'user_789',
        credits: 250,
        metadata: undefined
      });
    });
  });

  describe('externalUserId validation', () => {
    it('should throw ValidationError for missing externalUserId', async () => {
      await expect(client.createChildKey(null as any, 1000))
        .rejects.toThrow(ValidationError);
      await expect(client.createChildKey(undefined as any, 1000))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for non-string externalUserId', async () => {
      await expect(client.createChildKey(123 as any, 1000))
        .rejects.toThrow('userId is required and must be a string');
      await expect(client.createChildKey({} as any, 1000))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty externalUserId', async () => {
      await expect(client.createChildKey('', 1000))
        .rejects.toThrow('userId cannot be empty or whitespace');
      await expect(client.createChildKey('   ', 1000))
        .rejects.toThrow('userId cannot be empty or whitespace');
    });

    it('should throw ValidationError for externalUserId exceeding 255 characters', async () => {
      const longUserId = 'a'.repeat(256);
      await expect(client.createChildKey(longUserId, 1000))
        .rejects.toThrow('userId must be 255 characters or less');
    });

    it('should accept externalUserId at 255 character boundary', async () => {
      const maxUserId = 'a'.repeat(255);
      await expect(client.createChildKey(maxUserId, 1000))
        .resolves.toBeDefined();
    });
  });

  describe('initialCredits validation', () => {
    it('should throw ValidationError for non-integer initialCredits', async () => {
      await expect(client.createChildKey('user_123', 10.5))
        .rejects.toThrow('amount must be an integer');
      await expect(client.createChildKey('user_123', 'invalid' as any))
        .rejects.toThrow('amount must be an integer');
    });

    it('should throw ValidationError for non-positive initialCredits', async () => {
      await expect(client.createChildKey('user_123', 0))
        .rejects.toThrow('amount must be positive');
      await expect(client.createChildKey('user_123', -100))
        .rejects.toThrow('amount must be positive');
    });

    it('should accept boundary value of 1 credit', async () => {
      await expect(client.createChildKey('user_123', 1))
        .resolves.toBeDefined();
    });
  });

  describe('name validation', () => {
    it('should throw ValidationError for non-string name', async () => {
      await expect(client.createChildKey('user_123', 1000, { name: 123 as any }))
        .rejects.toThrow('name must be a string');
      await expect(client.createChildKey('user_123', 1000, { name: {} as any }))
        .rejects.toThrow('name must be a string');
      await expect(client.createChildKey('user_123', 1000, { name: null as any }))
        .rejects.toThrow('name must be a string');
    });

    it('should throw ValidationError for empty name when provided', async () => {
      await expect(client.createChildKey('user_123', 1000, { name: '' }))
        .rejects.toThrow('name cannot be empty or whitespace');
      await expect(client.createChildKey('user_123', 1000, { name: '   ' }))
        .rejects.toThrow('name cannot be empty or whitespace');
    });

    it('should throw ValidationError for name exceeding 255 characters', async () => {
      const longName = 'a'.repeat(256);
      await expect(client.createChildKey('user_123', 1000, { name: longName }))
        .rejects.toThrow('name must be 255 characters or less');
    });

    it('should accept name at 255 character boundary', async () => {
      const maxName = 'a'.repeat(255);
      await expect(client.createChildKey('user_123', 1000, { name: maxName }))
        .resolves.toBeDefined();
    });

    it('should accept name with special characters', async () => {
      await expect(client.createChildKey('user_123', 1000, { name: 'API Key 🔑 (Production)' }))
        .resolves.toBeDefined();
    });

    it('should use default name when not provided', async () => {
      await client.createChildKey('test_user', 1000);

      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/keys/create',
        expect.objectContaining({ name: 'test_user API Key' })
      );
    });
  });

  describe('metadata validation', () => {
    it('should throw ValidationError for non-object metadata', async () => {
      await expect(client.createChildKey('user_123', 1000, { metadata: 'string' as any }))
        .rejects.toThrow('metadata must be an object');
      await expect(client.createChildKey('user_123', 1000, { metadata: 123 as any }))
        .rejects.toThrow('metadata must be an object');
      await expect(client.createChildKey('user_123', 1000, { metadata: true as any }))
        .rejects.toThrow('metadata must be an object');
    });

    it('should throw ValidationError for null or array metadata', async () => {
      await expect(client.createChildKey('user_123', 1000, { metadata: null as any }))
        .rejects.toThrow('metadata must be an object');
      await expect(client.createChildKey('user_123', 1000, { metadata: [] as any }))
        .rejects.toThrow('metadata must be an object');
      await expect(client.createChildKey('user_123', 1000, { metadata: ['item'] as any }))
        .rejects.toThrow('metadata must be an object');
    });

    it('should throw ValidationError for metadata exceeding 10KB when serialized', async () => {
      const largeMetadata = { data: 'x'.repeat(10001) };
      await expect(client.createChildKey('user_123', 1000, { metadata: largeMetadata }))
        .rejects.toThrow('metadata size must be 10KB or less when serialized');
    });

    it('should throw ValidationError for non-JSON-serializable metadata', async () => {
      const circularRef: any = {};
      circularRef.self = circularRef;

      await expect(client.createChildKey('user_123', 1000, { metadata: circularRef }))
        .rejects.toThrow('metadata must be JSON-serializable');
    });

    it('should accept metadata near 10KB boundary', async () => {
      const metadata = { data: 'x'.repeat(9980) };
      await expect(client.createChildKey('user_123', 1000, { metadata }))
        .resolves.toBeDefined();
    });

    it('should accept various metadata value types including nested objects', async () => {
      const metadata = {
        plan: 'premium',
        active: true,
        count: 42,
        ratio: 3.14,
        nullable: null,
        features: ['api', 'webhooks', 'analytics'],
        limits: { requests: 10000, storage: 100 },
        tags: { environment: 'production', region: 'us-east-1' }
      };

      await expect(client.createChildKey('user_123', 1000, { metadata }))
        .resolves.toBeDefined();
    });

    it('should accept empty metadata object', async () => {
      await expect(client.createChildKey('user_123', 1000, { metadata: {} }))
        .resolves.toBeDefined();
    });
  });

  describe('environment parameter', () => {
    it('should accept development environment', async () => {
      await client.createChildKey('user_dev', 100, { environment: 'development' });

      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/keys/create',
        expect.objectContaining({ environment: 'development' })
      );
    });

    it('should accept staging environment', async () => {
      await client.createChildKey('user_stg', 100, { environment: 'staging' });

      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/keys/create',
        expect.objectContaining({ environment: 'staging' })
      );
    });

    it('should accept production environment', async () => {
      await client.createChildKey('user_prod', 100, { environment: 'production' });

      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/keys/create',
        expect.objectContaining({ environment: 'production' })
      );
    });

    it('should default to production when not provided', async () => {
      await client.createChildKey('user_default', 100);

      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/keys/create',
        expect.objectContaining({ environment: 'production' })
      );
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle Unicode characters in externalUserId', async () => {
      await expect(client.createChildKey('user_测试_🎉', 1000))
        .resolves.toBeDefined();
    });

    it('should handle Unicode characters in name', async () => {
      await expect(client.createChildKey('user_123', 1000, { name: 'Ключ API 日本語 🔑' }))
        .resolves.toBeDefined();
    });

    it('should validate externalUserId before initialCredits', async () => {
      await expect(client.createChildKey('', -1))
        .rejects.toThrow('userId cannot be empty');
    });

    it('should validate required parameters before optional ones', async () => {
      await expect(client.createChildKey('user_123', 0, { name: '' }))
        .rejects.toThrow('amount must be positive');
    });
  });
});
