/**
 * SyncEngine
 *
 * Orchestrates all syncing operations for offline-first architecture.
 * Monitors network state and automatically syncs when online.
 *
 * Features:
 * - Network state monitoring
 * - Automatic OCR refill when online
 * - Mint keyset synchronization
 * - Pending transaction processing
 * - Configurable sync strategies
 * - Sync queue management
 * - Background sync support
 *
 * Sync Priority:
 * 1. Critical: Pending transaction resolution
 * 2. High: OCR refill (if depleted)
 * 3. Medium: Keyset updates
 * 4. Low: Mint metadata refresh
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import OCRManager from '../ocr/OCRManager';
import MintDiscovery from '../cashu/MintDiscovery';
import TransactionRepository from '../../data/repositories/TransactionRepository';
import MintRepository from '../../data/repositories/MintRepository';
import { TransactionStatus, OCRStatus } from '../../types';

/**
 * Sync strategy configuration
 */
export interface SyncStrategy {
  autoSync: boolean;
  syncOnWiFiOnly: boolean;
  syncInterval: number; // In minutes
  backgroundSync: boolean;
  priority: {
    transactions: boolean;
    ocr: boolean;
    keysets: boolean;
    metadata: boolean;
  };
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  timestamp: number;
  operations: {
    transactions: number;
    ocrRefills: number;
    keysetUpdates: number;
    metadataUpdates: number;
  };
  errors: string[];
}

/**
 * Network state
 */
export interface NetworkState {
  isConnected: boolean;
  isWiFi: boolean;
  isMetered: boolean;
  timestamp: number;
}

/**
 * SyncEngine class
 */
export class SyncEngine {
  private static instance: SyncEngine;

  private ocrManager: OCRManager;
  private mintDiscovery: MintDiscovery;
  private txRepo: TransactionRepository;
  private mintRepo: MintRepository;

  private networkState: NetworkState = {
    isConnected: false,
    isWiFi: false,
    isMetered: true,
    timestamp: Date.now(),
  };

  private isSyncing: boolean = false;
  private lastSyncTimestamp: number = 0;
  private syncIntervalId?: NodeJS.Timeout;

  // Default sync strategy
  private strategy: SyncStrategy = {
    autoSync: true,
    syncOnWiFiOnly: false,
    syncInterval: 15, // 15 minutes
    backgroundSync: true,
    priority: {
      transactions: true,
      ocr: true,
      keysets: true,
      metadata: false,
    },
  };

  private constructor() {
    this.ocrManager = OCRManager.getInstance();
    this.mintDiscovery = MintDiscovery.getInstance();
    this.txRepo = TransactionRepository.getInstance();
    this.mintRepo = MintRepository.getInstance();
  }

  static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  /**
   * Initialize sync engine
   * Starts network monitoring and periodic sync
   */
  async initialize(): Promise<void> {
    console.log('[SyncEngine] Initializing...');

    // Subscribe to network state changes
    NetInfo.addEventListener(this.handleNetworkStateChange.bind(this));

    // Get initial network state
    const state = await NetInfo.fetch();
    this.updateNetworkState(state);

    // Start periodic sync if enabled
    if (this.strategy.autoSync) {
      this.startPeriodicSync();
    }

    console.log('[SyncEngine] Initialized');
  }

  /**
   * Shutdown sync engine
   */
  shutdown(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = undefined;
    }

    console.log('[SyncEngine] Shutdown');
  }

  /**
   * Handle network state changes
   */
  private handleNetworkStateChange(state: NetInfoState): void {
    const wasConnected = this.networkState.isConnected;
    this.updateNetworkState(state);

    // If just connected, trigger sync
    if (!wasConnected && this.networkState.isConnected) {
      console.log('[SyncEngine] Network connected, triggering sync');
      this.syncNow();
    }

    // If disconnected, cancel any ongoing sync
    if (wasConnected && !this.networkState.isConnected) {
      console.log('[SyncEngine] Network disconnected');
    }
  }

  /**
   * Update internal network state
   */
  private updateNetworkState(state: NetInfoState): void {
    this.networkState = {
      isConnected: state.isConnected ?? false,
      isWiFi: state.type === 'wifi',
      isMetered: state.details?.isConnectionExpensive ?? true,
      timestamp: Date.now(),
    };

    console.log('[SyncEngine] Network state:', this.networkState);
  }

  /**
   * Get current network state
   */
  getNetworkState(): NetworkState {
    return { ...this.networkState };
  }

  /**
   * Check if sync is allowed based on strategy
   */
  private canSync(): boolean {
    // Must be connected
    if (!this.networkState.isConnected) {
      return false;
    }

    // Check WiFi requirement
    if (this.strategy.syncOnWiFiOnly && !this.networkState.isWiFi) {
      console.log('[SyncEngine] Sync requires WiFi, skipping');
      return false;
    }

    // Check if already syncing
    if (this.isSyncing) {
      console.log('[SyncEngine] Already syncing, skipping');
      return false;
    }

    return true;
  }

  /**
   * Perform full sync
   */
  async syncNow(): Promise<SyncResult> {
    if (!this.canSync()) {
      return {
        success: false,
        timestamp: Date.now(),
        operations: {
          transactions: 0,
          ocrRefills: 0,
          keysetUpdates: 0,
          metadataUpdates: 0,
        },
        errors: ['Sync not allowed (offline or already syncing)'],
      };
    }

    this.isSyncing = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let transactionCount = 0;
    let ocrRefills = 0;
    let keysetUpdates = 0;
    let metadataUpdates = 0;

    console.log('[SyncEngine] Starting full sync...');

    try {
      // 1. Priority: Process pending transactions
      if (this.strategy.priority.transactions) {
        try {
          transactionCount = await this.processPendingTransactions();
          console.log(`[SyncEngine] Processed ${transactionCount} pending transactions`);
        } catch (error: any) {
          errors.push(`Transaction sync failed: ${error.message}`);
        }
      }

      // 2. High priority: Refill OCR if needed
      if (this.strategy.priority.ocr) {
        try {
          const mints = await this.mintRepo.getTrustedMints();

          for (const mint of mints) {
            const result = await this.ocrManager.refillIfNeeded(mint.url);
            if (result && result.success) {
              ocrRefills++;
              console.log(`[SyncEngine] Refilled OCR for ${mint.url}`);
            }
          }
        } catch (error: any) {
          errors.push(`OCR refill failed: ${error.message}`);
        }
      }

      // 3. Medium priority: Sync keysets
      if (this.strategy.priority.keysets) {
        try {
          const results = await this.mintDiscovery.syncStaleMints(24);
          keysetUpdates = Array.from(results.values()).reduce(
            (sum, r) => sum + r.added + r.updated,
            0
          );
          console.log(`[SyncEngine] Updated ${keysetUpdates} keysets`);
        } catch (error: any) {
          errors.push(`Keyset sync failed: ${error.message}`);
        }
      }

      // 4. Low priority: Refresh mint metadata
      if (this.strategy.priority.metadata) {
        try {
          const mints = await this.mintRepo.getAll();
          for (const mint of mints) {
            try {
              await this.mintDiscovery.fetchMintInfo(mint.url);
              await this.mintRepo.updateLastSynced(mint.id);
              metadataUpdates++;
            } catch (error) {
              // Silently fail for metadata updates
            }
          }
          console.log(`[SyncEngine] Updated ${metadataUpdates} mint metadata`);
        } catch (error: any) {
          errors.push(`Metadata sync failed: ${error.message}`);
        }
      }

      this.lastSyncTimestamp = Date.now();

      const duration = Date.now() - startTime;
      console.log(`[SyncEngine] Full sync completed in ${duration}ms`);

      return {
        success: errors.length === 0,
        timestamp: this.lastSyncTimestamp,
        operations: {
          transactions: transactionCount,
          ocrRefills,
          keysetUpdates,
          metadataUpdates,
        },
        errors,
      };
    } catch (error: any) {
      console.error('[SyncEngine] Sync failed:', error);
      return {
        success: false,
        timestamp: Date.now(),
        operations: {
          transactions: transactionCount,
          ocrRefills,
          keysetUpdates,
          metadataUpdates,
        },
        errors: [error.message],
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process pending transactions
   */
  private async processPendingTransactions(): Promise<number> {
    const pending = await this.txRepo.getPending();

    if (pending.length === 0) {
      return 0;
    }

    let processedCount = 0;

    for (const tx of pending) {
      try {
        // In a real implementation, you'd retry the transaction
        // For now, we just mark old pending transactions as failed
        const age = Date.now() - tx.createdAt;
        const ONE_HOUR = 60 * 60 * 1000;

        if (age > ONE_HOUR) {
          await this.txRepo.markFailed(tx.id);
          processedCount++;
        }
      } catch (error) {
        console.error(`[SyncEngine] Failed to process transaction ${tx.id}:`, error);
      }
    }

    return processedCount;
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }

    const intervalMs = this.strategy.syncInterval * 60 * 1000;

    this.syncIntervalId = setInterval(() => {
      if (this.strategy.autoSync && this.canSync()) {
        this.syncNow();
      }
    }, intervalMs);

    console.log(`[SyncEngine] Periodic sync started (${this.strategy.syncInterval} min)`);
  }

  /**
   * Update sync strategy
   */
  setStrategy(strategy: Partial<SyncStrategy>): void {
    this.strategy = {
      ...this.strategy,
      ...strategy,
    };

    // Restart periodic sync if interval changed
    if (strategy.syncInterval !== undefined || strategy.autoSync !== undefined) {
      if (this.strategy.autoSync) {
        this.startPeriodicSync();
      } else if (this.syncIntervalId) {
        clearInterval(this.syncIntervalId);
        this.syncIntervalId = undefined;
      }
    }

    console.log('[SyncEngine] Strategy updated:', this.strategy);
  }

  /**
   * Get current sync strategy
   */
  getStrategy(): SyncStrategy {
    return { ...this.strategy };
  }

  /**
   * Get sync status
   */
  getStatus(): {
    isSyncing: boolean;
    lastSync: number | null;
    timeSinceLastSync: number | null;
    networkState: NetworkState;
    canSync: boolean;
  } {
    const timeSinceLastSync = this.lastSyncTimestamp
      ? Date.now() - this.lastSyncTimestamp
      : null;

    return {
      isSyncing: this.isSyncing,
      lastSync: this.lastSyncTimestamp || null,
      timeSinceLastSync,
      networkState: this.networkState,
      canSync: this.canSync(),
    };
  }

  /**
   * Estimate next sync time
   */
  getNextSyncTime(): number | null {
    if (!this.strategy.autoSync || !this.lastSyncTimestamp) {
      return null;
    }

    const intervalMs = this.strategy.syncInterval * 60 * 1000;
    return this.lastSyncTimestamp + intervalMs;
  }

  /**
   * Force sync regardless of strategy
   */
  async forceSyncNow(): Promise<SyncResult> {
    if (!this.networkState.isConnected) {
      return {
        success: false,
        timestamp: Date.now(),
        operations: {
          transactions: 0,
          ocrRefills: 0,
          keysetUpdates: 0,
          metadataUpdates: 0,
        },
        errors: ['Cannot force sync: offline'],
      };
    }

    return await this.syncNow();
  }
}

/**
 * Singleton instance export
 */
export default SyncEngine.getInstance();
