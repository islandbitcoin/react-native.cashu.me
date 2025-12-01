/**
 * MintDirectory
 *
 * Provides access to public Cashu mint directories.
 * Features:
 * - Large curated list of production mints
 * - Pagination support for infinite scroll
 * - Dynamic mint discovery
 * - Health check integration
 */

import { MintDiscovery } from './MintDiscovery';

/**
 * Public mint entry from directory
 */
export interface DirectoryMint {
  url: string;
  name: string;
  description?: string;
  operator?: string;
  iconUrl?: string;
  contact?: {
    email?: string;
    nostr?: string;
    twitter?: string;
    website?: string;
  };
  features?: {
    lightning: boolean;
    onchain?: boolean;
    nfc?: boolean;
  };
  nuts?: string[];
  fees?: {
    mintFeePercent?: number;
    meltFeePercent?: number;
  };
  stats?: {
    uptime?: number;
    responseTime?: number;
    lastChecked?: number;
  };
  rating?: number;
  reviewCount?: number;
  isTestnet?: boolean;
  isFeatured?: boolean;
  addedAt?: number;
}

/**
 * Paginated result
 */
export interface PaginatedMints {
  mints: DirectoryMint[];
  hasMore: boolean;
  nextPage: number;
  total: number;
}

/**
 * Production mints - curated list of known public mints
 * Only includes real, production mints (no testnet)
 */
const PRODUCTION_MINTS: DirectoryMint[] = [
  // Recommended mint (top pick)
  {
    url: 'https://forge.flashapp.me',
    name: 'Flash Forge',
    description: 'Recommended mint by Flash. Great for getting started with Cashu.',
    operator: 'Flash',
    features: { lightning: true },
    isFeatured: true,
    contact: { website: 'https://flashapp.me' },
  },
  // Featured mints (well-known, reliable)
  {
    url: 'https://mint.minibits.cash',
    name: 'Minibits Mint',
    description: 'Official mint operated by the Minibits wallet team.',
    operator: 'Minibits',
    features: { lightning: true },
    isFeatured: true,
    contact: { website: 'https://minibits.cash' },
  },
  {
    url: 'https://mint.coinos.io',
    name: 'Coinos Mint',
    description: 'Cashu mint by Coinos, a popular Bitcoin web wallet.',
    operator: 'Coinos',
    features: { lightning: true },
    isFeatured: true,
    contact: { website: 'https://coinos.io' },
  },
  {
    url: 'https://mint.lnbits.com',
    name: 'LNbits Mint',
    description: 'Community mint operated by the LNbits team.',
    operator: 'LNbits',
    features: { lightning: true },
    isFeatured: true,
    contact: { website: 'https://lnbits.com' },
  },
  {
    url: 'https://legend.lnbits.com/cashu/api/v1/AptDNABNBXv8gpuywhx6NV',
    name: 'Legend LNbits',
    description: 'Public Cashu mint hosted on Legend LNbits instance.',
    operator: 'LNbits Community',
    features: { lightning: true },
    isFeatured: true,
  },
  // Community mints
  {
    url: 'https://mint.macadamia.cash',
    name: 'Macadamia Mint',
    description: 'Mint operated by the Macadamia wallet team.',
    operator: 'Macadamia',
    features: { lightning: true },
    contact: { website: 'https://macadamia.cash' },
  },
  {
    url: 'https://8333.space:3338',
    name: '8333.space Mint',
    description: 'Community-operated Cashu mint.',
    operator: '8333.space',
    features: { lightning: true },
  },
  {
    url: 'https://mint.bitcointxoko.com',
    name: 'Bitcoin Txoko',
    description: 'Cashu mint by Bitcoin Txoko community.',
    operator: 'Bitcoin Txoko',
    features: { lightning: true },
    contact: { website: 'https://bitcointxoko.com' },
  },
  {
    url: 'https://mint.enuts.cash',
    name: 'eNuts Mint',
    description: 'Official mint for the eNuts mobile wallet.',
    operator: 'eNuts',
    features: { lightning: true },
    contact: { website: 'https://enuts.cash' },
  },
  {
    url: 'https://mint.nutbank.cash',
    name: 'Nutbank',
    description: 'Community Cashu mint.',
    operator: 'Nutbank',
    features: { lightning: true },
  },
  {
    url: 'https://stablenut.umint.cash',
    name: 'Stablenut',
    description: 'Cashu mint by Umint.',
    operator: 'Umint',
    features: { lightning: true },
  },
  {
    url: 'https://mint.0xchat.com',
    name: '0xChat Mint',
    description: 'Cashu mint integrated with 0xChat messenger.',
    operator: '0xChat',
    features: { lightning: true },
    contact: { website: 'https://0xchat.com' },
  },
];

/**
 * Test mints - only for development/testing
 */
const TEST_MINTS: DirectoryMint[] = [
  {
    url: 'https://testnut.cashu.space',
    name: 'Testnut (with fees)',
    description: 'Official Cashu test mint with fees. Uses fake/unbacked ecash for testing.',
    operator: 'Cashu Team',
    features: { lightning: true },
    fees: { mintFeePercent: 1, meltFeePercent: 1 },
    isTestnet: true,
    contact: { website: 'https://cashu.space' },
  },
  {
    url: 'https://nofees.testnut.cashu.space',
    name: 'Testnut (no fees)',
    description: 'Official Cashu test mint without fees. Uses fake/unbacked ecash for testing.',
    operator: 'Cashu Team',
    features: { lightning: true },
    fees: { mintFeePercent: 0, meltFeePercent: 0 },
    isTestnet: true,
    contact: { website: 'https://cashu.space' },
  },
];

const PAGE_SIZE = 5;

/**
 * MintDirectory class
 */
export class MintDirectory {
  private static instance: MintDirectory;
  private mintDiscovery: MintDiscovery;
  private dynamicMints: DirectoryMint[] = [];
  private discoveredUrls: Set<string> = new Set();

  private constructor() {
    this.mintDiscovery = MintDiscovery.getInstance();
    // Initialize with all known production mint URLs
    PRODUCTION_MINTS.forEach(m => this.discoveredUrls.add(m.url));
  }

  static getInstance(): MintDirectory {
    if (!MintDirectory.instance) {
      MintDirectory.instance = new MintDirectory();
    }
    return MintDirectory.instance;
  }

  /**
   * Get paginated production mints (for infinite scroll)
   */
  getProductionMintsPaginated(page: number = 0): PaginatedMints {
    const allMints = [...PRODUCTION_MINTS, ...this.dynamicMints].filter(m => !m.isTestnet);
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const mints = allMints.slice(start, end);

    return {
      mints,
      hasMore: end < allMints.length,
      nextPage: page + 1,
      total: allMints.length,
    };
  }

  /**
   * Get featured mints (first page, recommended)
   */
  getFeaturedMints(): DirectoryMint[] {
    return PRODUCTION_MINTS.filter(m => m.isFeatured && !m.isTestnet);
  }

  /**
   * Get test mints (hidden by default, only when explicitly requested)
   */
  getTestMints(): DirectoryMint[] {
    return TEST_MINTS;
  }

  /**
   * Get all production mints (non-paginated)
   */
  getAllProductionMints(): DirectoryMint[] {
    return [...PRODUCTION_MINTS, ...this.dynamicMints].filter(m => !m.isTestnet);
  }

  /**
   * Search mints by query (production only)
   */
  searchMints(query: string): DirectoryMint[] {
    const lowerQuery = query.toLowerCase();
    const allMints = [...PRODUCTION_MINTS, ...this.dynamicMints];

    return allMints.filter(mint =>
      !mint.isTestnet && (
        mint.name.toLowerCase().includes(lowerQuery) ||
        mint.description?.toLowerCase().includes(lowerQuery) ||
        mint.operator?.toLowerCase().includes(lowerQuery) ||
        mint.url.toLowerCase().includes(lowerQuery)
      )
    );
  }

  /**
   * Discover a new mint dynamically and add to directory
   */
  async discoverAndAddMint(url: string): Promise<DirectoryMint | null> {
    const normalizedUrl = url.replace(/\/$/, '');

    // Check if already known
    if (this.discoveredUrls.has(normalizedUrl)) {
      return this.getMintByUrl(normalizedUrl) || null;
    }

    try {
      const mintInfo = await this.mintDiscovery.fetchMintInfo(normalizedUrl);

      const newMint: DirectoryMint = {
        url: normalizedUrl,
        name: mintInfo.name || 'Unknown Mint',
        description: mintInfo.description || 'Dynamically discovered mint',
        iconUrl: mintInfo.iconUrl,
        contact: mintInfo.contact,
        features: { lightning: true },
        nuts: mintInfo.nuts ? Object.keys(mintInfo.nuts) : undefined,
        addedAt: Date.now(),
      };

      this.dynamicMints.push(newMint);
      this.discoveredUrls.add(normalizedUrl);

      return newMint;
    } catch (error) {
      console.error('[MintDirectory] Failed to discover mint:', error);
      return null;
    }
  }

  /**
   * Check mint health
   */
  async checkMintHealth(mint: DirectoryMint): Promise<DirectoryMint> {
    const health = await this.mintDiscovery.checkMintHealth(mint.url);

    return {
      ...mint,
      stats: {
        ...mint.stats,
        uptime: health.healthy ? 100 : 0,
        responseTime: health.responseTime,
        lastChecked: Date.now(),
      },
    };
  }

  /**
   * Get mint by URL
   */
  getMintByUrl(url: string): DirectoryMint | undefined {
    const normalizedUrl = url.replace(/\/$/, '');
    const allMints = [...PRODUCTION_MINTS, ...this.dynamicMints, ...TEST_MINTS];
    return allMints.find(m => m.url.replace(/\/$/, '') === normalizedUrl);
  }

  /**
   * Get total count of production mints
   */
  getTotalProductionMints(): number {
    return PRODUCTION_MINTS.length + this.dynamicMints.filter(m => !m.isTestnet).length;
  }

  /**
   * Get page size
   */
  getPageSize(): number {
    return PAGE_SIZE;
  }
}

export default MintDirectory;
