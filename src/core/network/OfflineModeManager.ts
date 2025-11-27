/**
 * OfflineModeManager
 *
 * Manages offline mode behavior and optimizations.
 * Coordinates offline operations, queue management, and state preservation.
 *
 * Features:
 * - Automatic offline mode detection
 * - Offline operation queueing
 * - State preservation during offline periods
 * - Optimistic UI updates
 * - Automatic sync when reconnected
 * - Offline capability reporting
 *
 * Offline Capabilities:
 * - View balance and transaction history
 * - Send payments (OCR required)
 * - Receive payments (via NFC/Bluetooth/QR)
 * - Generate payment requests
 * - Access cached mint info
 */

import NetworkStateProvider, { NetworkEvent, NetworkEventData } from './NetworkStateProvider';
import SyncEngine from '../sync/SyncEngine';
import OperationQueue, { OperationType, OperationPriority } from '../sync/OperationQueue';
import StateReconciliation from '../sync/StateReconciliation';
import OCRManager from '../ocr/OCRManager';
import ProofRepository from '../../data/repositories/ProofRepository';

/**
 * Offline mode status
 */
export enum OfflineMode {
  ONLINE = 'online',
  OFFLINE = 'offline',
  SYNCING = 'syncing',
  ERROR = 'error',
}

/**
 * Offline capabilities
 */
export interface OfflineCapabilities {
  canSend: boolean;
  canReceive: boolean;
  canViewBalance: boolean;
  canViewHistory: boolean;
  canGeneratePaymentRequest: boolean;
  ocrAvailable: boolean;
  ocrBalance: number;
}

/**
 * Offline mode configuration
 */
export interface OfflineModeConfig {
  autoQueue: boolean; // Automatically queue failed operations
  optimisticUpdates: boolean; // Apply updates optimistically
  autoReconcile: boolean; // Auto-reconcile when reconnected
  notifyOnOffline: boolean; // Notify user when going offline
  notifyOnOnline: boolean; // Notify user when reconnecting
}

/**
 * OfflineModeManager class
 */
export class OfflineModeManager {
  private static instance: OfflineModeManager;

  private networkProvider: NetworkStateProvider;
  private syncEngine: SyncEngine;
  private operationQueue: OperationQueue;
  private stateReconciliation: StateReconciliation;
  private ocrManager: OCRManager;
  private proofRepo: ProofRepository;

  private mode: OfflineMode = OfflineMode.OFFLINE;
  private offlineSince?: number;
  private lastOnlineTime?: number;

  private config: OfflineModeConfig = {
    autoQueue: true,
    optimisticUpdates: true,
    autoReconcile: true,
    notifyOnOffline: true,
    notifyOnOnline: true,
  };

  private constructor() {
    this.networkProvider = NetworkStateProvider.getInstance();
    this.syncEngine = SyncEngine.getInstance();
    this.operationQueue = OperationQueue.getInstance();
    this.stateReconciliation = StateReconciliation.getInstance();
    this.ocrManager = OCRManager.getInstance();
    this.proofRepo = ProofRepository.getInstance();
  }

  static getInstance(): OfflineModeManager {
    if (!OfflineModeManager.instance) {
      OfflineModeManager.instance = new OfflineModeManager();
    }
    return OfflineModeManager.instance;
  }

  /**
   * Initialize offline mode manager
   */
  async initialize(): Promise<void> {
    console.log('[OfflineModeManager] Initializing...');

    // Set initial mode based on network state
    const networkState = this.networkProvider.getState();
    this.updateMode(networkState.isConnected);

    // Listen for network changes
    this.networkProvider.addEventListener(this.handleNetworkEvent.bind(this));

    console.log('[OfflineModeManager] Initialized');
  }

  /**
   * Handle network state changes
   */
  private async handleNetworkEvent(event: NetworkEventData): Promise<void> {
    switch (event.type) {
      case NetworkEvent.CONNECTED:
        await this.handleOnline();
        break;

      case NetworkEvent.DISCONNECTED:
        await this.handleOffline();
        break;
    }
  }

  /**
   * Handle going online
   */
  private async handleOnline(): Promise<void> {
    console.log('[OfflineModeManager] Connection restored');

    this.mode = OfflineMode.SYNCING;
    this.lastOnlineTime = Date.now();

    // Calculate offline duration
    if (this.offlineSince) {
      const offlineDuration = Date.now() - this.offlineSince;
      console.log(`[OfflineModeManager] Was offline for ${offlineDuration}ms`);
    }

    this.offlineSince = undefined;

    try {
      // 1. Reconcile state if configured
      if (this.config.autoReconcile) {
        console.log('[OfflineModeManager] Reconciling state...');
        await this.stateReconciliation.reconcileAll();
      }

      // 2. Process operation queue
      if (this.config.autoQueue) {
        console.log('[OfflineModeManager] Processing queued operations...');
        const stats = await this.operationQueue.getStats();
        if (stats.pending > 0) {
          console.log(`[OfflineModeManager] Found ${stats.pending} pending operations`);
          // Operations will be processed by sync engine
        }
      }

      // 3. Trigger full sync
      console.log('[OfflineModeManager] Triggering sync...');
      await this.syncEngine.syncNow();

      this.mode = OfflineMode.ONLINE;

      console.log('[OfflineModeManager] Online sync complete');
    } catch (error: any) {
      console.error('[OfflineModeManager] Online sync failed:', error);
      this.mode = OfflineMode.ERROR;
    }
  }

  /**
   * Handle going offline
   */
  private async handleOffline(): Promise<void> {
    console.log('[OfflineModeManager] Connection lost');

    this.mode = OfflineMode.OFFLINE;
    this.offlineSince = Date.now();

    // Notify user if configured
    if (this.config.notifyOnOffline) {
      // UI would show offline banner
    }

    // Clean up any ongoing operations
    // ...
  }

  /**
   * Update mode
   */
  private updateMode(isOnline: boolean): void {
    this.mode = isOnline ? OfflineMode.ONLINE : OfflineMode.OFFLINE;

    if (!isOnline && !this.offlineSince) {
      this.offlineSince = Date.now();
    } else if (isOnline && this.offlineSince) {
      this.lastOnlineTime = Date.now();
      this.offlineSince = undefined;
    }
  }

  /**
   * Get current offline mode
   */
  getMode(): OfflineMode {
    return this.mode;
  }

  /**
   * Check if offline
   */
  isOffline(): boolean {
    return this.mode === OfflineMode.OFFLINE;
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return this.mode === OfflineMode.ONLINE;
  }

  /**
   * Check if syncing
   */
  isSyncing(): boolean {
    return this.mode === OfflineMode.SYNCING;
  }

  /**
   * Get offline capabilities
   */
  getCapabilities(): OfflineCapabilities {
    const ocrStats = this.ocrManager.getStats();
    const ocrBalance = ocrStats.ocrBalance;

    return {
      canSend: ocrBalance > 0, // Can only send if OCR has balance
      canReceive: true, // Can always receive offline
      canViewBalance: true, // Can view local balance
      canViewHistory: true, // Can view local history
      canGeneratePaymentRequest: true, // Can generate requests
      ocrAvailable: ocrBalance > 0,
      ocrBalance,
    };
  }

  /**
   * Get offline duration
   */
  getOfflineDuration(): number | null {
    if (!this.offlineSince) {
      return null;
    }

    return Date.now() - this.offlineSince;
  }

  /**
   * Get time since last online
   */
  getTimeSinceOnline(): number | null {
    if (!this.lastOnlineTime) {
      return null;
    }

    return Date.now() - this.lastOnlineTime;
  }

  /**
   * Queue operation for later execution
   */
  async queueOperation(
    type: OperationType,
    payload: any,
    priority: OperationPriority = OperationPriority.MEDIUM
  ): Promise<string> {
    if (!this.config.autoQueue) {
      throw new Error('Auto-queue is disabled');
    }

    const operationId = await this.operationQueue.enqueue(type, payload, priority);

    console.log(`[OfflineModeManager] Queued ${type} operation: ${operationId}`);

    return operationId;
  }

  /**
   * Get configuration
   */
  getConfig(): OfflineModeConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<OfflineModeConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    console.log('[OfflineModeManager] Config updated:', this.config);
  }

  /**
   * Get offline mode statistics
   */
  getStats(): {
    mode: OfflineMode;
    offlineDuration: number | null;
    timeSinceOnline: number | null;
    pendingOperations: number;
    ocrBalance: number;
    capabilities: OfflineCapabilities;
  } {
    const queueStats = this.operationQueue.getStats();
    const capabilities = this.getCapabilities();

    return {
      mode: this.mode,
      offlineDuration: this.getOfflineDuration(),
      timeSinceOnline: this.getTimeSinceOnline(),
      pendingOperations: queueStats.pending,
      ocrBalance: capabilities.ocrBalance,
      capabilities,
    };
  }

  /**
   * Force reconciliation
   */
  async forceReconcile(): Promise<void> {
    if (!this.networkProvider.isConnected()) {
      throw new Error('Cannot reconcile while offline');
    }

    this.mode = OfflineMode.SYNCING;

    try {
      await this.stateReconciliation.reconcileAll();
      this.mode = OfflineMode.ONLINE;
    } catch (error: any) {
      this.mode = OfflineMode.ERROR;
      throw error;
    }
  }

  /**
   * Check offline mode health
   */
  getHealth(): {
    healthy: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check OCR status
    const ocrStatus = this.ocrManager.getStatus();
    if (ocrStatus.currentBalance === 0) {
      issues.push('OCR is depleted - cannot send offline payments');
    } else if (ocrStatus.percentOfTarget < 20) {
      warnings.push('OCR is below 20% of target');
    }

    // Check offline duration
    const offlineDuration = this.getOfflineDuration();
    if (offlineDuration && offlineDuration > 24 * 60 * 60 * 1000) {
      warnings.push('Offline for more than 24 hours');
    }

    // Check pending operations
    const stats = this.operationQueue.getStats();
    if (stats.pending > 10) {
      warnings.push(`${stats.pending} operations pending`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      warnings,
    };
  }
}

/**
 * Singleton instance export
 */
export default OfflineModeManager.getInstance();
