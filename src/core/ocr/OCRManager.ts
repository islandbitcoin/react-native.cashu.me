/**
 * OCRManager (Offline Cash Reserve)
 *
 * Manages the offline cash reserve - a balance of proofs always available for offline spending.
 * This is the KILLER FEATURE that sets this wallet apart.
 *
 * Features:
 * - Automatic OCR maintenance (swap proofs when online)
 * - Configurable OCR levels (Low/Medium/High: 10k/50k/100k sats)
 * - Smart proof selection for OCR
 * - OCR depletion alerts
 * - Automatic refill when online
 * - OCR status tracking (SYNCED, READY, OUT_OF_SYNC, DEPLETED)
 *
 * Architecture:
 * - Uses ProofRepository for proof storage
 * - Integrates with CashuWalletService for swaps
 * - Monitors network state for sync opportunities
 * - Prioritizes fresh proofs for OCR
 *
 * Strategy:
 * 1. Maintain target OCR balance based on level
 * 2. When online: swap proofs to reach target
 * 3. Mark swapped proofs as OCR
 * 4. When spending offline: use OCR proofs first
 * 5. Alert when OCR falls below threshold
 * 6. Auto-refill when connection restored
 */

import ProofRepository from '../../data/repositories/ProofRepository';
import MintRepository from '../../data/repositories/MintRepository';
import CashuWalletService from '../cashu/CashuWalletService';
import Database from '../../data/database/Database';
import { OCRLevel, OCRStatus, ProofState, Proof } from '../../types';
import { generateUUID } from '../../utils/uuid';

/**
 * OCR target amounts by level (in sats)
 */
export const OCR_TARGETS = {
  [OCRLevel.LOW]: 10000,      // 10k sats
  [OCRLevel.MEDIUM]: 50000,   // 50k sats
  [OCRLevel.HIGH]: 100000,    // 100k sats
};

/**
 * OCR configuration
 */
export interface OCRConfig {
  level: OCRLevel;
  targetAmount: number;
  autoRefill: boolean;
  alertThreshold: number; // Percentage (e.g., 20 = alert when below 20%)
}

/**
 * OCR sync result
 */
export interface OCRSyncResult {
  success: boolean;
  proofsAdded: number;
  proofsRemoved: number;
  newBalance: number;
  status: OCRStatus;
  error?: string;
}

/**
 * OCR status result
 */
export interface OCRStatusResult {
  status: OCRStatus;
  currentBalance: number;
  targetBalance: number;
  percentOfTarget: number;
  needsRefill: boolean;
  alertLevel: 'none' | 'low' | 'critical';
}

/**
 * OCRManager class
 */
export class OCRManager {
  private static instance: OCRManager;

  private proofRepo: ProofRepository;
  private mintRepo: MintRepository;
  private walletService: CashuWalletService;
  private db: Database;

  // Default configuration
  private config: OCRConfig = {
    level: OCRLevel.MEDIUM,
    targetAmount: OCR_TARGETS[OCRLevel.MEDIUM],
    autoRefill: true,
    alertThreshold: 20, // Alert when below 20% of target
  };

  private constructor() {
    this.proofRepo = ProofRepository.getInstance();
    this.mintRepo = MintRepository.getInstance();
    this.walletService = CashuWalletService.getInstance();
    this.db = Database.getInstance();

    // Load config from database
    this.loadConfig();
  }

  static getInstance(): OCRManager {
    if (!OCRManager.instance) {
      OCRManager.instance = new OCRManager();
    }
    return OCRManager.instance;
  }

  /**
   * Load OCR configuration from database
   */
  private loadConfig(): void {
    try {
      const result = this.db.querySync<any>(
        'SELECT * FROM ocr_config LIMIT 1'
      );

      if (result.length > 0) {
        const row = result[0];
        this.config = {
          level: row.ocr_level as OCRLevel,
          targetAmount: row.target_amount,
          autoRefill: row.auto_refill === 1,
          alertThreshold: row.alert_threshold,
        };
      }
    } catch (error) {
      console.error('[OCRManager] Failed to load config:', error);
    }
  }

  /**
   * Save OCR configuration to database
   */
  private async saveConfig(): Promise<void> {
    try {
      // Upsert config (delete old, insert new)
      await this.db.execute('DELETE FROM ocr_config');
      await this.db.execute(
        `INSERT INTO ocr_config (ocr_level, target_amount, auto_refill, alert_threshold)
         VALUES (?, ?, ?, ?)`,
        [
          this.config.level,
          this.config.targetAmount,
          this.config.autoRefill ? 1 : 0,
          this.config.alertThreshold,
        ]
      );
    } catch (error) {
      console.error('[OCRManager] Failed to save config:', error);
    }
  }

  /**
   * Get current OCR configuration
   */
  getConfig(): OCRConfig {
    return { ...this.config };
  }

  /**
   * Update OCR configuration
   */
  async setConfig(config: Partial<OCRConfig>): Promise<void> {
    // Update config
    if (config.level !== undefined) {
      this.config.level = config.level;
      this.config.targetAmount = OCR_TARGETS[config.level];
    }

    if (config.autoRefill !== undefined) {
      this.config.autoRefill = config.autoRefill;
    }

    if (config.alertThreshold !== undefined) {
      this.config.alertThreshold = config.alertThreshold;
    }

    if (config.targetAmount !== undefined) {
      this.config.targetAmount = config.targetAmount;
    }

    // Save to database
    await this.saveConfig();

    console.log('[OCRManager] Config updated:', this.config);
  }

  /**
   * Get current OCR status
   */
  getStatus(): OCRStatusResult {
    const currentBalance = this.proofRepo.getOCRBalance();
    const targetBalance = this.config.targetAmount;
    const percentOfTarget = (currentBalance / targetBalance) * 100;

    // Determine status
    let status: OCRStatus;
    if (percentOfTarget >= 95) {
      status = OCRStatus.SYNCED;
    } else if (percentOfTarget >= 50) {
      status = OCRStatus.OFFLINE_READY;
    } else if (percentOfTarget > 0) {
      status = OCRStatus.OUT_OF_SYNC;
    } else {
      status = OCRStatus.DEPLETED;
    }

    // Determine alert level
    let alertLevel: 'none' | 'low' | 'critical' = 'none';
    if (percentOfTarget < this.config.alertThreshold) {
      alertLevel = 'critical';
    } else if (percentOfTarget < this.config.alertThreshold * 2) {
      alertLevel = 'low';
    }

    return {
      status,
      currentBalance,
      targetBalance,
      percentOfTarget,
      needsRefill: percentOfTarget < 80,
      alertLevel,
    };
  }

  /**
   * Sync OCR balance (swap proofs to reach target)
   * This is the core OCR operation
   */
  async syncOCR(mintUrl: string): Promise<OCRSyncResult> {
    try {
      const status = this.getStatus();

      // If already synced, do nothing
      if (status.status === OCRStatus.SYNCED) {
        return {
          success: true,
          proofsAdded: 0,
          proofsRemoved: 0,
          newBalance: status.currentBalance,
          status: OCRStatus.SYNCED,
        };
      }

      const deficit = this.config.targetAmount - status.currentBalance;

      console.log(`[OCRManager] OCR deficit: ${deficit} sats`);

      // Get available non-OCR proofs
      const availableProofs = await this.proofRepo.getAll({
        mintUrl,
        state: ProofState.UNSPENT,
        isOCR: false,
      });

      const availableBalance = availableProofs.reduce((sum, p) => sum + p.amount, 0);

      if (availableBalance < deficit) {
        console.warn(`[OCRManager] Insufficient funds for OCR sync`);
        return {
          success: false,
          proofsAdded: 0,
          proofsRemoved: 0,
          newBalance: status.currentBalance,
          status: status.status,
          error: 'Insufficient funds for OCR sync',
        };
      }

      // Select proofs to convert to OCR
      const selection = await this.selectProofsForOCR(mintUrl, deficit);

      // Swap proofs for fresh ones
      const swapResult = await this.walletService.swapProofs(
        mintUrl,
        selection.map(p => p.id)
      );

      // Mark new proofs as OCR
      const ocrProofIds = swapResult.newProofs.map(p => p.id);
      await this.proofRepo.markAsOCR(ocrProofIds);

      const newStatus = this.getStatus();

      console.log(`[OCRManager] OCR synced: ${ocrProofIds.length} proofs added`);

      return {
        success: true,
        proofsAdded: ocrProofIds.length,
        proofsRemoved: selection.length,
        newBalance: newStatus.currentBalance,
        status: newStatus.status,
      };
    } catch (error: any) {
      console.error('[OCRManager] OCR sync failed:', error);
      return {
        success: false,
        proofsAdded: 0,
        proofsRemoved: 0,
        newBalance: this.getStatus().currentBalance,
        status: this.getStatus().status,
        error: error.message,
      };
    }
  }

  /**
   * Select proofs to convert to OCR
   * Prioritizes larger proofs for efficiency
   */
  private async selectProofsForOCR(
    mintUrl: string,
    amount: number
  ): Promise<Proof[]> {
    // Get all available non-OCR proofs
    const proofs = await this.proofRepo.getAll({
      mintUrl,
      state: ProofState.UNSPENT,
      isOCR: false,
    });

    // Sort by amount (largest first)
    proofs.sort((a, b) => b.amount - a.amount);

    // Greedy selection
    const selected: Proof[] = [];
    let total = 0;

    for (const proof of proofs) {
      if (total >= amount) break;
      selected.push(proof);
      total += proof.amount;
    }

    return selected;
  }

  /**
   * Refill OCR if needed
   * Called automatically when online
   */
  async refillIfNeeded(mintUrl: string): Promise<OCRSyncResult | null> {
    if (!this.config.autoRefill) {
      return null;
    }

    const status = this.getStatus();

    // Only refill if below 80% of target
    if (!status.needsRefill) {
      return null;
    }

    console.log('[OCRManager] Auto-refilling OCR...');

    return await this.syncOCR(mintUrl);
  }

  /**
   * Spend from OCR
   * Prioritizes OCR proofs for offline spending
   */
  async spendFromOCR(
    mintUrl: string,
    amount: number
  ): Promise<{ proofs: Proof[]; total: number } | null> {
    try {
      // Get OCR proofs
      const ocrProofs = await this.proofRepo.getAll({
        mintUrl,
        state: ProofState.UNSPENT,
        isOCR: true,
      });

      // Check if we have enough
      const ocrBalance = ocrProofs.reduce((sum, p) => sum + p.amount, 0);

      if (ocrBalance < amount) {
        console.warn('[OCRManager] Insufficient OCR balance');
        return null;
      }

      // Select proofs
      const transactionId = generateUUID();
      const selection = await this.proofRepo.selectProofsForAmount(
        mintUrl,
        amount,
        transactionId,
        true // Use OCR proofs
      );

      return {
        proofs: selection.proofs,
        total: selection.total,
      };
    } catch (error: any) {
      console.error('[OCRManager] Failed to spend from OCR:', error);
      return null;
    }
  }

  /**
   * Convert non-OCR proofs to OCR
   */
  async convertToOCR(proofIds: string[]): Promise<void> {
    await this.proofRepo.markAsOCR(proofIds);
  }

  /**
   * Remove proofs from OCR
   */
  async removeFromOCR(proofIds: string[]): Promise<void> {
    await this.proofRepo.unmarkAsOCR(proofIds);
  }

  /**
   * Get OCR statistics
   */
  getStats(): {
    ocrBalance: number;
    ocrProofCount: number;
    targetBalance: number;
    percentOfTarget: number;
    status: OCRStatus;
    level: OCRLevel;
  } {
    const status = this.getStatus();
    const stats = this.proofRepo.getStats();

    return {
      ocrBalance: stats.ocrValue,
      ocrProofCount: stats.ocr,
      targetBalance: this.config.targetAmount,
      percentOfTarget: status.percentOfTarget,
      status: status.status,
      level: this.config.level,
    };
  }

  /**
   * Get OCR health check
   */
  healthCheck(): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const status = this.getStatus();

    // Check if depleted
    if (status.status === OCRStatus.DEPLETED) {
      issues.push('OCR is depleted');
      recommendations.push('Connect to internet to refill OCR');
    }

    // Check if out of sync
    if (status.status === OCRStatus.OUT_OF_SYNC) {
      issues.push('OCR is out of sync');
      recommendations.push('Sync OCR when online');
    }

    // Check if below alert threshold
    if (status.alertLevel === 'critical') {
      issues.push(`OCR below ${this.config.alertThreshold}% of target`);
      recommendations.push('Refill OCR immediately');
    } else if (status.alertLevel === 'low') {
      recommendations.push('Consider refilling OCR soon');
    }

    // Check if target is realistic
    const totalBalance = this.proofRepo.getTotalBalance();
    if (this.config.targetAmount > totalBalance * 0.5) {
      issues.push('OCR target is more than 50% of total balance');
      recommendations.push('Consider lowering OCR level');
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Estimate time to refill OCR (in seconds)
   */
  estimateRefillTime(): number {
    const status = this.getStatus();
    const deficit = this.config.targetAmount - status.currentBalance;

    if (deficit <= 0) return 0;

    // Rough estimate: 2 seconds per swap operation
    // Assumes ~10 proofs per swap
    const estimatedSwaps = Math.ceil(deficit / 10000);
    return estimatedSwaps * 2;
  }

  /**
   * Get recommended OCR level based on usage patterns
   */
  getRecommendedLevel(): OCRLevel {
    // This would analyze spending patterns
    // For now, return current level
    return this.config.level;
  }
}

/**
 * Singleton instance export
 */
export default OCRManager.getInstance();
