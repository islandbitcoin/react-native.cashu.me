/**
 * StateReconciliation
 *
 * Reconciles local state with remote mint state after being offline.
 * Ensures data consistency and resolves conflicts.
 *
 * Reconciliation Process:
 * 1. Fetch remote state from mint
 * 2. Compare with local state
 * 3. Detect discrepancies
 * 4. Apply reconciliation strategies
 * 5. Update local state
 *
 * Strategies:
 * - Mint is always source of truth for proof validity
 * - Local optimistic updates reconciled against mint
 * - Conflicts resolved automatically where possible
 * - User notified of manual conflicts
 */

import ProofRepository from '../../data/repositories/ProofRepository';
import MintRepository from '../../data/repositories/MintRepository';
import TransactionRepository from '../../data/repositories/TransactionRepository';
import CashuWalletService from '../cashu/CashuWalletService';
import ConflictResolver from './ConflictResolver';
import { ProofState } from '../../types';

/**
 * Reconciliation result
 */
export interface ReconciliationResult {
  success: boolean;
  proofsChecked: number;
  proofsUpdated: number;
  conflictsResolved: number;
  errors: string[];
  duration: number;
}

/**
 * State snapshot
 */
export interface StateSnapshot {
  timestamp: number;
  totalProofs: number;
  unspentProofs: number;
  spentProofs: number;
  pendingProofs: number;
  totalBalance: number;
  ocrBalance: number;
}

/**
 * Reconciliation strategy
 */
export enum ReconciliationStrategy {
  CONSERVATIVE = 'conservative', // Only reconcile obvious discrepancies
  AGGRESSIVE = 'aggressive', // Reconcile all state differences
  MANUAL = 'manual', // Don't auto-reconcile, report conflicts only
}

/**
 * StateReconciliation class
 */
export class StateReconciliation {
  private static instance: StateReconciliation;

  private proofRepo: ProofRepository;
  private mintRepo: MintRepository;
  private txRepo: TransactionRepository;
  private walletService: CashuWalletService;
  private conflictResolver: ConflictResolver;

  private strategy: ReconciliationStrategy = ReconciliationStrategy.CONSERVATIVE;

  private constructor() {
    this.proofRepo = ProofRepository.getInstance();
    this.mintRepo = MintRepository.getInstance();
    this.txRepo = TransactionRepository.getInstance();
    this.walletService = CashuWalletService.getInstance();
    this.conflictResolver = ConflictResolver.getInstance();
  }

  static getInstance(): StateReconciliation {
    if (!StateReconciliation.instance) {
      StateReconciliation.instance = new StateReconciliation();
    }
    return StateReconciliation.instance;
  }

  /**
   * Set reconciliation strategy
   */
  setStrategy(strategy: ReconciliationStrategy): void {
    this.strategy = strategy;
    console.log(`[StateReconciliation] Strategy set to: ${strategy}`);
  }

  /**
   * Get current state snapshot
   */
  async getStateSnapshot(mintUrl?: string): Promise<StateSnapshot> {
    const stats = this.proofRepo.getStats();

    return {
      timestamp: Date.now(),
      totalProofs: stats.total,
      unspentProofs: stats.unspent,
      spentProofs: stats.spent,
      pendingProofs: stats.pending,
      totalBalance: stats.totalValue,
      ocrBalance: stats.ocrValue,
    };
  }

  /**
   * Reconcile state for a mint
   */
  async reconcileMint(mintUrl: string): Promise<ReconciliationResult> {
    const startTime = Date.now();
    const result: ReconciliationResult = {
      success: false,
      proofsChecked: 0,
      proofsUpdated: 0,
      conflictsResolved: 0,
      errors: [],
      duration: 0,
    };

    try {
      console.log(`[StateReconciliation] Starting reconciliation for ${mintUrl}...`);

      // Step 1: Get all local proofs for this mint
      const localProofs = await this.proofRepo.getAll({
        mintUrl,
        state: ProofState.UNSPENT,
      });

      result.proofsChecked = localProofs.length;

      if (localProofs.length === 0) {
        console.log('[StateReconciliation] No proofs to reconcile');
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Step 2: Check proof validity with mint
      const proofIds = localProofs.map(p => p.id);
      const spendableResult = await this.walletService.checkProofsSpendable(
        mintUrl,
        proofIds
      );

      // Step 3: Identify discrepancies
      const discrepancies: { proofId: string; isSpendable: boolean }[] = [];

      for (let i = 0; i < localProofs.length; i++) {
        const proof = localProofs[i];
        const isSpendable = spendableResult.spendable[i];

        if (!isSpendable) {
          // Proof marked unspent locally but spent on mint
          discrepancies.push({
            proofId: proof.id,
            isSpendable: false,
          });
        }
      }

      console.log(`[StateReconciliation] Found ${discrepancies.length} discrepancies`);

      // Step 4: Apply reconciliation strategy
      if (discrepancies.length > 0) {
        switch (this.strategy) {
          case ReconciliationStrategy.CONSERVATIVE:
          case ReconciliationStrategy.AGGRESSIVE:
            // Auto-resolve discrepancies
            for (const { proofId } of discrepancies) {
              try {
                // Mark proof as spent locally
                const success = await this.proofRepo.transitionState(
                  proofId,
                  ProofState.UNSPENT,
                  ProofState.SPENT
                );

                if (success) {
                  result.proofsUpdated++;
                }
              } catch (error: any) {
                result.errors.push(`Failed to update proof ${proofId}: ${error.message}`);
              }
            }
            break;

          case ReconciliationStrategy.MANUAL:
            // Don't auto-resolve, just detect conflicts
            console.log(
              `[StateReconciliation] Manual strategy: ${discrepancies.length} conflicts detected`
            );
            break;
        }
      }

      // Step 5: Resolve any conflicts
      const conflictReport = await this.conflictResolver.resolveAllConflicts(mintUrl);
      result.conflictsResolved = conflictReport.resolved;

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      console.log(
        `[StateReconciliation] Reconciliation complete: ${result.proofsUpdated} proofs updated, ${result.conflictsResolved} conflicts resolved`
      );

      return result;
    } catch (error: any) {
      result.errors.push(`Reconciliation failed: ${error.message}`);
      result.duration = Date.now() - startTime;
      console.error('[StateReconciliation] Reconciliation error:', error);
      return result;
    }
  }

  /**
   * Reconcile all mints
   */
  async reconcileAll(): Promise<Map<string, ReconciliationResult>> {
    const results = new Map<string, ReconciliationResult>();

    try {
      // Get all mints
      const mints = await this.mintRepo.getAll();

      console.log(`[StateReconciliation] Reconciling ${mints.length} mints...`);

      for (const mint of mints) {
        try {
          const result = await this.reconcileMint(mint.url);
          results.set(mint.url, result);
        } catch (error: any) {
          console.error(`[StateReconciliation] Failed to reconcile ${mint.url}:`, error);
          results.set(mint.url, {
            success: false,
            proofsChecked: 0,
            proofsUpdated: 0,
            conflictsResolved: 0,
            errors: [error.message],
            duration: 0,
          });
        }
      }

      return results;
    } catch (error: any) {
      console.error('[StateReconciliation] Reconcile all failed:', error);
      return results;
    }
  }

  /**
   * Verify proof ownership
   * Checks if we actually own the proofs we think we own
   */
  async verifyOwnership(mintUrl: string): Promise<{
    verified: number;
    invalid: number;
    proofIds: string[];
  }> {
    try {
      const localProofs = await this.proofRepo.getAll({
        mintUrl,
        state: ProofState.UNSPENT,
      });

      if (localProofs.length === 0) {
        return { verified: 0, invalid: 0, proofIds: [] };
      }

      const proofIds = localProofs.map(p => p.id);
      const spendableResult = await this.walletService.checkProofsSpendable(
        mintUrl,
        proofIds
      );

      let verified = 0;
      let invalid = 0;
      const invalidProofIds: string[] = [];

      for (let i = 0; i < localProofs.length; i++) {
        if (spendableResult.spendable[i]) {
          verified++;
        } else {
          invalid++;
          invalidProofIds.push(localProofs[i].id);
        }
      }

      return {
        verified,
        invalid,
        proofIds: invalidProofIds,
      };
    } catch (error: any) {
      console.error('[StateReconciliation] Ownership verification failed:', error);
      return { verified: 0, invalid: 0, proofIds: [] };
    }
  }

  /**
   * Compare local vs remote balance
   */
  async compareBalances(mintUrl: string): Promise<{
    localBalance: number;
    verifiedBalance: number;
    difference: number;
  }> {
    try {
      const localBalance = this.proofRepo.getBalance(mintUrl);

      const ownership = await this.verifyOwnership(mintUrl);

      // Calculate verified balance (only spendable proofs)
      const localProofs = await this.proofRepo.getAll({
        mintUrl,
        state: ProofState.UNSPENT,
      });

      const proofIds = localProofs.map(p => p.id);
      const spendableResult = await this.walletService.checkProofsSpendable(
        mintUrl,
        proofIds
      );

      let verifiedBalance = 0;
      for (let i = 0; i < localProofs.length; i++) {
        if (spendableResult.spendable[i]) {
          verifiedBalance += localProofs[i].amount;
        }
      }

      return {
        localBalance,
        verifiedBalance,
        difference: localBalance - verifiedBalance,
      };
    } catch (error: any) {
      console.error('[StateReconciliation] Balance comparison failed:', error);
      return {
        localBalance: 0,
        verifiedBalance: 0,
        difference: 0,
      };
    }
  }

  /**
   * Detect state drift
   * Identifies how far local state has drifted from remote
   */
  async detectDrift(mintUrl: string): Promise<{
    hasDrift: boolean;
    driftPercentage: number;
    invalidProofs: number;
    totalProofs: number;
  }> {
    try {
      const ownership = await this.verifyOwnership(mintUrl);
      const totalProofs = ownership.verified + ownership.invalid;

      const driftPercentage =
        totalProofs > 0 ? (ownership.invalid / totalProofs) * 100 : 0;

      return {
        hasDrift: ownership.invalid > 0,
        driftPercentage,
        invalidProofs: ownership.invalid,
        totalProofs,
      };
    } catch (error: any) {
      console.error('[StateReconciliation] Drift detection failed:', error);
      return {
        hasDrift: false,
        driftPercentage: 0,
        invalidProofs: 0,
        totalProofs: 0,
      };
    }
  }

  /**
   * Get reconciliation health
   */
  async getHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check all mints for drift
      const mints = await this.mintRepo.getAll();

      for (const mint of mints) {
        const drift = await this.detectDrift(mint.url);

        if (drift.hasDrift) {
          if (drift.driftPercentage > 10) {
            issues.push(
              `${mint.name || mint.url}: ${drift.driftPercentage.toFixed(1)}% state drift`
            );
            recommendations.push(`Reconcile ${mint.name || mint.url} state`);
          }
        }
      }

      return {
        healthy: issues.length === 0,
        issues,
        recommendations,
      };
    } catch (error: any) {
      return {
        healthy: false,
        issues: [`Health check failed: ${error.message}`],
        recommendations: ['Retry health check'],
      };
    }
  }
}

/**
 * Singleton instance export
 */
export default StateReconciliation.getInstance();
