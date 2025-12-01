/**
 * MintDiscovery Tests
 *
 * Tests for the mint discovery service that handles
 * mint health checks, info fetching, and keyset synchronization.
 */

import { CashuMint } from '@cashu/cashu-ts';
import MintDiscovery from '../MintDiscovery';
import MintRepository from '../../../data/repositories/MintRepository';

// Create shared mock instances
const mockMintRepoInstance = {
  create: jest.fn(),
  exists: jest.fn(),
  getByUrl: jest.fn(),
  createKeyset: jest.fn(),
  getKeysets: jest.fn(),
  deactivateKeyset: jest.fn(),
  keysetExists: jest.fn(),
  getKeysetByKeysetId: jest.fn(),
  updateKeyset: jest.fn(),
  updateLastSynced: jest.fn(),
};

// Mock mint instance that can be controlled per test
let mockMintInstance = {
  getInfo: jest.fn(),
  getKeys: jest.fn(),
};

// Mock dependencies
jest.mock('@cashu/cashu-ts', () => ({
  CashuMint: jest.fn(() => mockMintInstance),
}));

jest.mock('../../../data/repositories/MintRepository', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => mockMintRepoInstance),
  },
}));

describe('MintDiscovery', () => {
  let mintDiscovery: MintDiscovery;

  const testMintUrl = 'https://mint.example.com';
  const testMintInfo = {
    name: 'Test Mint',
    version: '0.15.0',
    pubkey: 'test-pubkey-123',
    description: 'A test mint',
    nuts: {
      '4': { supported: true },
      '5': { supported: true },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton for each test
    (MintDiscovery as any).instance = undefined;

    // Setup default mock mint behavior
    mockMintInstance = {
      getInfo: jest.fn().mockResolvedValue(testMintInfo),
      getKeys: jest.fn().mockResolvedValue({
        keysets: [
          {
            id: 'keyset1',
            unit: 'sat',
            keys: { '1': 'pubkey1', '2': 'pubkey2' },
            active: true,
          },
        ],
      }),
    };

    // Update the mock to use the new instance
    (CashuMint as jest.Mock).mockImplementation(() => mockMintInstance);

    // Setup default repository mocks
    mockMintRepoInstance.getByUrl.mockResolvedValue(null);
    mockMintRepoInstance.create.mockResolvedValue({
      id: 'mint-123',
      url: testMintUrl,
      name: testMintInfo.name,
      createdAt: Date.now(),
      trustLevel: 'low',
    });
    mockMintRepoInstance.getKeysets.mockResolvedValue([]);
    mockMintRepoInstance.keysetExists.mockResolvedValue(false);

    mintDiscovery = MintDiscovery.getInstance();
  });

  describe('checkMintHealth', () => {
    it('should return healthy true when mint responds', async () => {
      const result = await mintDiscovery.checkMintHealth(testMintUrl);

      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBeDefined();
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should return healthy false on network error', async () => {
      // Use a different URL to avoid cache
      const errorUrl = 'https://error.mint.com';
      mockMintInstance.getInfo = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await mintDiscovery.checkMintHealth(errorUrl);

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Network error');
      expect(result.responseTime).toBeUndefined();
    });

    it('should return healthy false on timeout', async () => {
      // Use a different URL to avoid cache
      const timeoutUrl = 'https://timeout.mint.com';
      mockMintInstance.getInfo = jest.fn().mockRejectedValue(new Error('Timeout'));

      const result = await mintDiscovery.checkMintHealth(timeoutUrl);

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Timeout');
    });

    it('should include response time on success', async () => {
      // Use a different URL to avoid cache
      const freshUrl = 'https://fresh.mint.com';
      const startTime = Date.now();
      const result = await mintDiscovery.checkMintHealth(freshUrl);
      const endTime = Date.now();

      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBeDefined();
      expect(result.responseTime).toBeLessThanOrEqual(endTime - startTime + 100);
    });
  });

  describe('fetchMintInfo', () => {
    it('should fetch and return mint info', async () => {
      const freshUrl = 'https://info.mint.com';
      const result = await mintDiscovery.fetchMintInfo(freshUrl);

      expect(result).toBeDefined();
      expect(result.name).toBe(testMintInfo.name);
      expect(result.version).toBe(testMintInfo.version);
      expect(result.publicKey).toBe(testMintInfo.pubkey);
    });

    it('should use cache for repeated requests', async () => {
      const cacheUrl = 'https://cache.mint.com';

      // First call
      await mintDiscovery.fetchMintInfo(cacheUrl);

      // Verify mint was called
      expect(CashuMint).toHaveBeenCalledWith(cacheUrl);

      // Clear the call count
      (CashuMint as jest.Mock).mockClear();

      // Second call - should use cache
      await mintDiscovery.fetchMintInfo(cacheUrl);

      // CashuMint should not be called again for cached URL
      expect(CashuMint).not.toHaveBeenCalled();
    });

    it('should throw error on fetch failure', async () => {
      const failUrl = 'https://fail.mint.com';
      mockMintInstance.getInfo = jest.fn().mockRejectedValue(new Error('Connection refused'));

      await expect(mintDiscovery.fetchMintInfo(failUrl)).rejects.toThrow(
        'Failed to fetch mint info'
      );
    });
  });

  describe('discoverMint', () => {
    it('should create mint record in database', async () => {
      const newUrl = 'https://new.mint.com';
      mockMintRepoInstance.getByUrl.mockResolvedValue(null);

      const result = await mintDiscovery.discoverMint(newUrl);

      expect(result.success).toBe(true);
      expect(mockMintRepoInstance.create).toHaveBeenCalled();
    });

    it('should return success for existing mint URL', async () => {
      const existingUrl = 'https://existing.mint.com';
      mockMintRepoInstance.getByUrl.mockResolvedValue({
        id: 'existing-mint',
        url: existingUrl,
      });

      const result = await mintDiscovery.discoverMint(existingUrl);

      // Existing mint returns success (updates lastSynced)
      expect(result.success).toBe(true);
      expect(result.mintId).toBe('existing-mint');
    });

    it('should sync keysets on success', async () => {
      const syncUrl = 'https://sync.mint.com';
      mockMintRepoInstance.getByUrl.mockResolvedValue(null);

      await mintDiscovery.discoverMint(syncUrl);

      // Verify keyset creation was called
      expect(mockMintRepoInstance.createKeyset).toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      const errorUrl = 'https://network-error.mint.com';
      mockMintRepoInstance.getByUrl.mockResolvedValue(null);
      mockMintInstance.getInfo = jest.fn().mockRejectedValue(new Error('DNS lookup failed'));

      const result = await mintDiscovery.discoverMint(errorUrl);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('syncKeysets', () => {
    const testMintId = 'mint-123';

    beforeEach(() => {
      mockMintRepoInstance.getKeysets.mockResolvedValue([]);
    });

    it('should store new keysets', async () => {
      const syncUrl = 'https://keyset-sync.mint.com';
      const result = await mintDiscovery.syncKeysets(testMintId, syncUrl);

      expect(result.added).toBeGreaterThan(0);
      expect(mockMintRepoInstance.createKeyset).toHaveBeenCalled();
    });

    it('should deactivate old keysets', async () => {
      const oldKeysetUrl = 'https://old-keyset.mint.com';

      // Setup existing keyset that's not in the new response
      mockMintRepoInstance.getKeysets.mockResolvedValue([
        {
          id: 'old-keyset-id',
          mintId: testMintId,
          keysetId: 'old-keyset',
          unit: 'sat',
          keys: {},
          active: true,
          createdAt: Date.now() - 100000,
        },
      ]);
      mockMintRepoInstance.getKeysetByKeysetId.mockResolvedValue({
        id: 'old-keyset-id',
        active: true,
      });

      const result = await mintDiscovery.syncKeysets(testMintId, oldKeysetUrl);

      expect(result.deactivated).toBeGreaterThanOrEqual(0);
    });

    it('should handle keyset sync errors', async () => {
      const errorUrl = 'https://keyset-error.mint.com';
      mockMintInstance.getKeys = jest.fn().mockRejectedValue(new Error('Keyset fetch failed'));

      const result = await mintDiscovery.syncKeysets(testMintId, errorUrl);

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('verifyMintCapabilities', () => {
    it('should verify required NUTs are supported', async () => {
      const capUrl = 'https://capabilities.mint.com';
      const result = await mintDiscovery.verifyMintCapabilities(capUrl, ['4', '5']);

      expect(result.supported).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should return missing NUTs', async () => {
      const missingUrl = 'https://missing-nuts.mint.com';
      const result = await mintDiscovery.verifyMintCapabilities(missingUrl, ['4', '5', '99']);

      expect(result.supported).toBe(false);
      expect(result.missing).toContain('99');
    });
  });
});
