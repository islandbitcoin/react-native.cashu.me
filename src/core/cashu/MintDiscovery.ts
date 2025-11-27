/**
 * MintDiscovery
 *
 * Discovers and syncs mint information and keysets.
 * Fetches mint metadata from /.well-known/cashu endpoints.
 *
 * Features:
 * - Automatic mint discovery from URLs
 * - Keyset synchronization (fetch public keys)
 * - Mint metadata caching
 * - Trust level management
 * - Keyset rotation detection
 * - Offline keyset validation
 *
 * Architecture:
 * - Uses @cashu/cashu-ts for mint communication
 * - Stores mints in MintRepository
 * - Caches keysets for offline proof validation
 */

import { CashuMint, GetInfoResponse } from '@cashu/cashu-ts';
import MintRepository from '../../data/repositories/MintRepository';
import { TrustLevel, MintKeyset } from '../../types';

/**
 * Mint info result
 */
export interface MintInfo {
  url: string;
  name?: string;
  description?: string;
  publicKey?: string;
  version?: string;
  motd?: string;
  contact?: {
    email?: string;
    nostr?: string;
  };
  nuts?: Record<string, any>;
}

/**
 * Keyset sync result
 */
export interface KeysetSyncResult {
  added: number;
  updated: number;
  deactivated: number;
  errors: string[];
}

/**
 * Discovery result
 */
export interface DiscoveryResult {
  success: boolean;
  mintId?: string;
  error?: string;
  keysets?: number;
}

/**
 * MintDiscovery class
 */
export class MintDiscovery {
  private static instance: MintDiscovery;

  private mintRepo: MintRepository;
  private discoveryCache: Map<string, MintInfo> = new Map();

  // Cache TTL: 1 hour
  private readonly CACHE_TTL_MS = 60 * 60 * 1000;

  private constructor() {
    this.mintRepo = MintRepository.getInstance();
  }

  static getInstance(): MintDiscovery {
    if (!MintDiscovery.instance) {
      MintDiscovery.instance = new MintDiscovery();
    }
    return MintDiscovery.instance;
  }

  /**
   * Discover mint from URL
   * Fetches mint info and creates entry in database
   */
  async discoverMint(
    url: string,
    trustLevel: TrustLevel = TrustLevel.UNTRUSTED
  ): Promise<DiscoveryResult> {
    try {
      // Normalize URL (remove trailing slash)
      const normalizedUrl = url.replace(/\/$/, '');

      // Check if mint already exists
      const existing = await this.mintRepo.getByUrl(normalizedUrl);
      if (existing) {
        // Update last synced
        await this.mintRepo.updateLastSynced(existing.id);

        return {
          success: true,
          mintId: existing.id,
        };
      }

      // Fetch mint info
      const info = await this.fetchMintInfo(normalizedUrl);

      // Create mint entry
      const mint = await this.mintRepo.create({
        url: normalizedUrl,
        name: info.name,
        description: info.description,
        publicKey: info.publicKey,
        trustLevel,
        lastSyncedAt: Date.now(),
      });

      // Sync keysets
      const syncResult = await this.syncKeysets(mint.id, normalizedUrl);

      console.log(`[MintDiscovery] Discovered mint: ${normalizedUrl}`);
      console.log(`[MintDiscovery] Synced ${syncResult.added} keysets`);

      return {
        success: true,
        mintId: mint.id,
        keysets: syncResult.added,
      };
    } catch (error: any) {
      console.error(`[MintDiscovery] Failed to discover mint ${url}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Fetch mint info from /.well-known/cashu endpoint
   */
  async fetchMintInfo(url: string): Promise<MintInfo> {
    try {
      // Check cache first
      const cached = this.discoveryCache.get(url);
      if (cached) {
        return cached;
      }

      // Create mint instance
      const mint = new CashuMint(url);

      // Fetch info
      const info: GetInfoResponse = await mint.getInfo();

      const mintInfo: MintInfo = {
        url,
        name: info.name,
        description: info.description,
        publicKey: info.pubkey,
        version: info.version,
        motd: info.motd,
        contact: info.contact
          ? {
              email: info.contact[0]?.[1],
              nostr: info.contact[1]?.[1],
            }
          : undefined,
        nuts: info.nuts,
      };

      // Cache result
      this.discoveryCache.set(url, mintInfo);

      // Clear cache after TTL
      setTimeout(() => {
        this.discoveryCache.delete(url);
      }, this.CACHE_TTL_MS);

      return mintInfo;
    } catch (error: any) {
      throw new Error(`Failed to fetch mint info: ${error.message}`);
    }
  }

  /**
   * Sync keysets for a mint
   * Fetches all active keysets and stores them
   */
  async syncKeysets(mintId: string, url: string): Promise<KeysetSyncResult> {
    const result: KeysetSyncResult = {
      added: 0,
      updated: 0,
      deactivated: 0,
      errors: [],
    };

    try {
      // Create mint instance
      const mint = new CashuMint(url);

      // Fetch keysets
      const keysets = await mint.getKeys();

      // Get existing keysets
      const existingKeysets = await this.mintRepo.getKeysets({ mintId });
      const existingKeysetIds = new Set(existingKeysets.map(k => k.keysetId));

      // Process each keyset
      for (const [keysetId, keys] of Object.entries(keysets)) {
        try {
          // Check if keyset exists
          const exists = await this.mintRepo.keysetExists(mintId, keysetId);

          if (exists) {
            // Update existing keyset
            const existing = await this.mintRepo.getKeysetByKeysetId(mintId, keysetId);
            if (existing) {
              await this.mintRepo.updateKeyset(existing.id, {
                keys: keys as Record<string, string>,
                active: true,
              });
              result.updated++;
            }
          } else {
            // Create new keyset
            await this.mintRepo.createKeyset({
              mintId,
              keysetId,
              unit: 'sat', // Default to sat, could detect from keys
              active: true,
              keys: keys as Record<string, string>,
            });
            result.added++;
          }

          // Remove from existing set (to find deactivated keysets)
          existingKeysetIds.delete(keysetId);
        } catch (error: any) {
          result.errors.push(`Keyset ${keysetId}: ${error.message}`);
        }
      }

      // Deactivate keysets that are no longer returned by mint
      for (const keysetId of existingKeysetIds) {
        const keyset = await this.mintRepo.getKeysetByKeysetId(mintId, keysetId);
        if (keyset && keyset.active) {
          await this.mintRepo.deactivateKeyset(keyset.id);
          result.deactivated++;
        }
      }

      // Update mint last synced timestamp
      await this.mintRepo.updateLastSynced(mintId);

      console.log(`[MintDiscovery] Synced keysets for ${url}:`, result);

      return result;
    } catch (error: any) {
      result.errors.push(`Sync failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Sync all mints
   * Updates keysets for all known mints
   */
  async syncAllMints(): Promise<Map<string, KeysetSyncResult>> {
    const results = new Map<string, KeysetSyncResult>();

    try {
      // Get all mints
      const mints = await this.mintRepo.getAll();

      console.log(`[MintDiscovery] Syncing ${mints.length} mints...`);

      // Sync each mint
      for (const mint of mints) {
        try {
          const result = await this.syncKeysets(mint.id, mint.url);
          results.set(mint.url, result);
        } catch (error: any) {
          console.error(`[MintDiscovery] Failed to sync ${mint.url}:`, error);
          results.set(mint.url, {
            added: 0,
            updated: 0,
            deactivated: 0,
            errors: [error.message],
          });
        }
      }

      return results;
    } catch (error: any) {
      console.error('[MintDiscovery] Failed to sync all mints:', error);
      return results;
    }
  }

  /**
   * Sync stale mints (not synced in X hours)
   */
  async syncStaleMints(hoursThreshold: number = 24): Promise<Map<string, KeysetSyncResult>> {
    const results = new Map<string, KeysetSyncResult>();

    try {
      // Get stale mints
      const staleMints = await this.mintRepo.getStaleMints(hoursThreshold);

      console.log(`[MintDiscovery] Found ${staleMints.length} stale mints`);

      // Sync each stale mint
      for (const mint of staleMints) {
        try {
          const result = await this.syncKeysets(mint.id, mint.url);
          results.set(mint.url, result);
        } catch (error: any) {
          console.error(`[MintDiscovery] Failed to sync stale mint ${mint.url}:`, error);
          results.set(mint.url, {
            added: 0,
            updated: 0,
            deactivated: 0,
            errors: [error.message],
          });
        }
      }

      return results;
    } catch (error: any) {
      console.error('[MintDiscovery] Failed to sync stale mints:', error);
      return results;
    }
  }

  /**
   * Check mint health (can connect and fetch info)
   */
  async checkMintHealth(url: string): Promise<{
    healthy: boolean;
    responseTime?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Try to fetch mint info
      await this.fetchMintInfo(url);

      const responseTime = Date.now() - startTime;

      return {
        healthy: true,
        responseTime,
      };
    } catch (error: any) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify mint supports required NUTs (Notation, Usage, and Terminology)
   * NUTs are Cashu protocol specifications
   */
  async verifyMintCapabilities(
    url: string,
    requiredNuts: string[]
  ): Promise<{
    supported: boolean;
    missing: string[];
  }> {
    try {
      const info = await this.fetchMintInfo(url);

      const missing: string[] = [];

      for (const nut of requiredNuts) {
        if (!info.nuts || !info.nuts[nut]) {
          missing.push(nut);
        }
      }

      return {
        supported: missing.length === 0,
        missing,
      };
    } catch (error) {
      return {
        supported: false,
        missing: requiredNuts,
      };
    }
  }

  /**
   * Get recommended trust level based on mint info
   */
  async getRecommendedTrustLevel(url: string): Promise<TrustLevel> {
    try {
      const info = await this.fetchMintInfo(url);

      // Check various factors for trust level
      const hasPublicKey = !!info.publicKey;
      const hasContact = !!info.contact?.email || !!info.contact?.nostr;
      const hasDescription = !!info.description;
      const supportsModernNuts = info.nuts && Object.keys(info.nuts).length >= 5;

      // Simple heuristic for trust level
      let score = 0;
      if (hasPublicKey) score++;
      if (hasContact) score++;
      if (hasDescription) score++;
      if (supportsModernNuts) score++;

      if (score >= 4) return TrustLevel.MEDIUM;
      if (score >= 2) return TrustLevel.LOW;
      return TrustLevel.UNTRUSTED;
    } catch (error) {
      return TrustLevel.UNTRUSTED;
    }
  }

  /**
   * Extract mint URL from token
   */
  extractMintFromToken(token: string): string | null {
    try {
      // Decode token
      const decoded = atob(token.substring(5)); // Remove 'cashu' prefix
      const parsed = JSON.parse(decoded);

      // Get first mint URL
      return parsed.token?.[0]?.mint || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Discover and add mint from token
   * Useful when receiving tokens from unknown mints
   */
  async discoverFromToken(
    token: string,
    trustLevel: TrustLevel = TrustLevel.LOW
  ): Promise<DiscoveryResult> {
    try {
      const mintUrl = this.extractMintFromToken(token);

      if (!mintUrl) {
        return {
          success: false,
          error: 'Could not extract mint URL from token',
        };
      }

      return await this.discoverMint(mintUrl, trustLevel);
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): {
    totalMints: number;
    trustedMints: number;
    activeKeysets: number;
    staleMints: number;
  } {
    const stats = this.mintRepo.getStats();

    return {
      totalMints: stats.totalMints,
      trustedMints: stats.trustedMints,
      activeKeysets: stats.activeKeysetCount,
      staleMints: 0, // Would need to calculate
    };
  }

  /**
   * Clear discovery cache
   */
  clearCache(): void {
    this.discoveryCache.clear();
  }
}

/**
 * Singleton instance export
 */
export default MintDiscovery.getInstance();
