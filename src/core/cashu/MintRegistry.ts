/**
 * MintRegistry
 *
 * Service for discovering and fetching public Cashu mints.
 * Provides a curated list of popular mints and can fetch from external registries.
 *
 * Features:
 * - Curated list of popular/trusted mints
 * - Health checking for listed mints
 * - Categorization (mainnet, testnet, region)
 * - Optional external registry fetching
 */

import { MintDiscovery } from './MintDiscovery';

/**
 * Public mint entry
 */
export interface PublicMint {
  url: string;
  name: string;
  description?: string;
  operator?: string;
  contact?: string;
  region?: string;
  features?: string[];
  isTestnet?: boolean;
  isRecommended?: boolean;
}

/**
 * Mint health status
 */
export interface MintHealth {
  url: string;
  healthy: boolean;
  responseTime?: number;
  lastChecked: number;
  error?: string;
}

/**
 * Curated list of popular Cashu mints
 * Updated periodically - users can also add custom mints
 */
const CURATED_MINTS: PublicMint[] = [
  // Mainnet Mints
  {
    url: 'https://mint.minibits.cash/Bitcoin',
    name: 'Minibits',
    description: 'Popular community mint by Minibits wallet',
    operator: 'Minibits',
    region: 'Global',
    features: ['NUT-07', 'NUT-08', 'NUT-10', 'NUT-11'],
    isRecommended: true,
  },
  {
    url: 'https://mint.coinos.io',
    name: 'Coinos',
    description: 'Mint operated by Coinos.io',
    operator: 'Coinos',
    region: 'Global',
    features: ['NUT-07', 'NUT-08'],
    isRecommended: true,
  },
  {
    url: 'https://mint.lnbits.com/cashu/api/v1/AptDNABNBXv8gpuywhx6NV',
    name: 'LNbits Demo',
    description: 'LNbits public demo mint',
    operator: 'LNbits',
    region: 'Global',
  },
  {
    url: 'https://8333.space:3338',
    name: '8333.space',
    description: 'Community mint',
    operator: '8333.space',
    region: 'Europe',
  },
  {
    url: 'https://mint.macadamia.cash',
    name: 'Macadamia',
    description: 'Macadamia wallet mint',
    operator: 'Macadamia',
    region: 'Global',
  },

  // Testnet Mints
  {
    url: 'https://testnut.cashu.space',
    name: 'Testnut',
    description: 'Official Cashu test mint - NOT real sats!',
    operator: 'Cashu',
    region: 'Global',
    isTestnet: true,
    isRecommended: true,
  },
  {
    url: 'https://legend.lnbits.com/cashu/api/v1/4gr9Xcmz3XEkUNwiBiQGoC',
    name: 'LNbits Legend (Test)',
    description: 'LNbits legend server test mint',
    operator: 'LNbits',
    region: 'Global',
    isTestnet: true,
  },
];

/**
 * External registry URLs (for future use)
 */
const REGISTRY_URLS = {
  bitcoinmints: 'https://bitcoinmints.com/api/mints',
};

/**
 * MintRegistry class
 */
export class MintRegistry {
  private static instance: MintRegistry;
  private discovery: MintDiscovery;
  private healthCache: Map<string, MintHealth> = new Map();

  // Health check cache TTL: 5 minutes
  private readonly HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;

  private constructor() {
    this.discovery = MintDiscovery.getInstance();
  }

  static getInstance(): MintRegistry {
    if (!MintRegistry.instance) {
      MintRegistry.instance = new MintRegistry();
    }
    return MintRegistry.instance;
  }

  /**
   * Get all curated mints
   */
  getCuratedMints(): PublicMint[] {
    return [...CURATED_MINTS];
  }

  /**
   * Get recommended mints only
   */
  getRecommendedMints(): PublicMint[] {
    return CURATED_MINTS.filter(m => m.isRecommended);
  }

  /**
   * Get mainnet mints only
   */
  getMainnetMints(): PublicMint[] {
    return CURATED_MINTS.filter(m => !m.isTestnet);
  }

  /**
   * Get testnet mints only
   */
  getTestnetMints(): PublicMint[] {
    return CURATED_MINTS.filter(m => m.isTestnet);
  }

  /**
   * Get mints by region
   */
  getMintsByRegion(region: string): PublicMint[] {
    return CURATED_MINTS.filter(
      m => m.region?.toLowerCase() === region.toLowerCase()
    );
  }

  /**
   * Search mints by name or description
   */
  searchMints(query: string): PublicMint[] {
    const lowerQuery = query.toLowerCase();
    return CURATED_MINTS.filter(
      m =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.description?.toLowerCase().includes(lowerQuery) ||
        m.operator?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Check health of a single mint
   */
  async checkMintHealth(url: string, forceRefresh: boolean = false): Promise<MintHealth> {
    // Check cache first
    const cached = this.healthCache.get(url);
    if (cached && !forceRefresh) {
      const age = Date.now() - cached.lastChecked;
      if (age < this.HEALTH_CACHE_TTL_MS) {
        return cached;
      }
    }

    // Perform health check
    const result = await this.discovery.checkMintHealth(url);

    const health: MintHealth = {
      url,
      healthy: result.healthy,
      responseTime: result.responseTime,
      lastChecked: Date.now(),
      error: result.error,
    };

    // Cache result
    this.healthCache.set(url, health);

    return health;
  }

  /**
   * Check health of all curated mints
   * Returns mints sorted by response time
   */
  async checkAllMintsHealth(): Promise<MintHealth[]> {
    const results: MintHealth[] = [];

    // Check all mints in parallel
    const promises = CURATED_MINTS.map(mint =>
      this.checkMintHealth(mint.url).catch(error => ({
        url: mint.url,
        healthy: false,
        lastChecked: Date.now(),
        error: error.message,
      }))
    );

    const healthResults = await Promise.all(promises);

    // Sort by health status and response time
    return healthResults.sort((a, b) => {
      // Healthy mints first
      if (a.healthy && !b.healthy) return -1;
      if (!a.healthy && b.healthy) return 1;

      // Then by response time
      const aTime = a.responseTime || Infinity;
      const bTime = b.responseTime || Infinity;
      return aTime - bTime;
    });
  }

  /**
   * Get curated mints with health status
   */
  async getCuratedMintsWithHealth(): Promise<(PublicMint & { health?: MintHealth })[]> {
    const healthResults = await this.checkAllMintsHealth();
    const healthMap = new Map(healthResults.map(h => [h.url, h]));

    return CURATED_MINTS.map(mint => ({
      ...mint,
      health: healthMap.get(mint.url),
    }));
  }

  /**
   * Fetch mints from external registry (experimental)
   * Falls back to curated list on failure
   */
  async fetchFromRegistry(): Promise<PublicMint[]> {
    try {
      // Try to fetch from bitcoinmints.com
      const response = await fetch(REGISTRY_URLS.bitcoinmints, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Registry returned ${response.status}`);
      }

      const data = await response.json();

      // Transform registry format to our format
      if (Array.isArray(data)) {
        return data.map((mint: any) => ({
          url: mint.url || mint.mint_url,
          name: mint.name || 'Unknown',
          description: mint.description,
          operator: mint.operator,
          region: mint.region,
        }));
      }

      return this.getCuratedMints();
    } catch (error) {
      console.warn('[MintRegistry] Failed to fetch from external registry:', error);
      // Fall back to curated list
      return this.getCuratedMints();
    }
  }

  /**
   * Validate a mint URL before adding
   */
  async validateMint(url: string): Promise<{
    valid: boolean;
    info?: any;
    error?: string;
  }> {
    try {
      const info = await this.discovery.fetchMintInfo(url);
      return {
        valid: true,
        info,
      };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Clear health cache
   */
  clearHealthCache(): void {
    this.healthCache.clear();
  }

  /**
   * Get unique regions from curated mints
   */
  getAvailableRegions(): string[] {
    const regions = new Set<string>();
    CURATED_MINTS.forEach(m => {
      if (m.region) regions.add(m.region);
    });
    return Array.from(regions).sort();
  }
}

export default MintRegistry;
