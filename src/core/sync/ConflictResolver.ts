/**
 * ConflictResolver
 *
 * Handles conflicts that arise from offline operations.
 * Resolves proof state conflicts, detects double-spends, and ensures data consistency.
 *
 * Conflict Types:
 * 1. Proof State Conflicts - Proof marked as spent locally but unspent on mint
 * 2. Double-Spend Detection - Proof spent in two different transactions
 * 3. Keyset Mismatches - Local keyset differs from mint keyset
 * 4. Transaction Conflicts - Pending transaction already processed
 *
 * Resolution Strategies:
 * - Mint is source of truth for proof validity
 * - Local state updated to match mint
 * - Failed transactions marked accordingly
 * - User notified of conflicts
 */

import ProofRepository from '../../data/repositories/ProofRepository';
import TransactionRepository from '../../data/repositories/TransactionRepository';
import CashuWalletService from '../cashu/CashuWalletService';
import { Proof, ProofState, TransactionStatus } from '../../types';

/**
 * Conflict types
 */
export enum ConflictType {
  PROOF_STATE_MISMATCH = 'proof_state_mismatch',
  DOUBLE_SPEND_DETECTED = 'double_spend_detected',
  KEYSET_MISMATCH = 'keyset_mismatch',
  TRANSACTION_CONFLICT = 'transaction_conflict',
  PROOF_NOT_FOUND = 'proof_not_found',
}

/**
 * Conflict details
 */
export interface Conflict {
  type: ConflictType;
  proofId?: string;
  transactionId?: string;
  localState?: ProofState;
  remoteState?: ProofState;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoResolvable: boolean;
}

/**
 * Resolution result
 */
export interface ResolutionResult {
  success: boolean;
  conflict: Conflict;
  action: string;
  error?: string;
}

/**
 * Conflict resolution report
 */
export interface ConflictReport {
  totalConflicts: number;
  resolved: number;
  failed: number;
  results: ResolutionResult[];
  timestamp: number;
}

/**
 * ConflictResolver class
 */
export class ConflictResolver {
  private static instance: ConflictResolver;

  private proofRepo: ProofRepository;
  private txRepo: TransactionRepository;
  private walletService: CashuWalletService;

  private constructor() {
    this.proofRepo = ProofRepository.getInstance();
    this.txRepo = TransactionRepository.getInstance();
    this.walletService = CashuWalletService.getInstance();
  }

  static getInstance(): ConflictResolver {
    if (!ConflictResolver.instance) {
      ConflictResolver.instance = new ConflictResolver();
    }
    return ConflictResolver.instance;
  }

  /**
   * Detect conflicts by checking proofs against mint
   */
  async detectConflicts(mintUrl: string): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    try {
      // Get all non-spent proofs from database
      const localProofs = await this.proofRepo.getAll({
        mintUrl,
        state: ProofState.UNSPENT,
      });

      if (localProofs.length === 0) {
        return conflicts;
      }

      console.log(`[ConflictResolver] Checking ${localProofs.length} proofs for conflicts...`);

      // Check proof validity with mint
      const proofIds = localProofs.map(p => p.id);
      const spendableResult = await this.walletService.checkProofsSpendable(
        mintUrl,
        proofIds
      );

      // Check each proof
      for (let i = 0; i < localProofs.length; i++) {
        const proof = localProofs[i];
        const isSpendable = spendableResult.spendable[i];

        if (!isSpendable) {
          // Proof is marked unspent locally but spent on mint
          conflicts.push({
            type: ConflictType.PROOF_STATE_MISMATCH,
            proofId: proof.id,
            localState: ProofState.UNSPENT,
            remoteState: ProofState.SPENT,
            description: `Proof ${proof.id.substring(0, 8)}... is spent on mint but marked unspent locally`,
            severity: 'high',
            autoResolvable: true,
          });
        }
      }

      // Check for duplicate secrets (double-spend attempts)
      const duplicateConflicts = await this.detectDoubleSpends(localProofs);
      conflicts.push(...duplicateConflicts);

      console.log(`[ConflictResolver] Found ${conflicts.length} conflicts`);

      return conflicts;
    } catch (error: any) {
      console.error('[ConflictResolver] Conflict detection failed:', error);
      return conflicts;
    }
  }

  /**
   * Detect double-spend attempts
   */
  private async detectDoubleSpends(proofs: Proof[]): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const secretMap = new Map<string, Proof[]>();

    // Group proofs by secret
    for (const proof of proofs) {
      const existing = secretMap.get(proof.secret) || [];
      existing.push(proof);
      secretMap.set(proof.secret, existing);
    }

    // Find duplicates
    for (const [secret, duplicates] of secretMap.entries()) {
      if (duplicates.length > 1) {
        conflicts.push({
          type: ConflictType.DOUBLE_SPEND_DETECTED,
          description: `Secret ${secret.substring(0, 16)}... appears in ${duplicates.length} proofs`,
          severity: 'critical',
          autoResolvable: false, // Requires manual intervention
        });
      }
    }

    return conflicts;
  }

  /**
   * Resolve a single conflict
   */
  async resolveConflict(conflict: Conflict): Promise<ResolutionResult> {
    try {
      switch (conflict.type) {
        case ConflictType.PROOF_STATE_MISMATCH:
          return await this.resolveProofStateMismatch(conflict);

        case ConflictType.DOUBLE_SPEND_DETECTED:
          return await this.resolveDoubleSpend(conflict);

        case ConflictType.TRANSACTION_CONFLICT:
          return await this.resolveTransactionConflict(conflict);

        default:
          return {
            success: false,
            conflict,
            action: 'No resolution strategy',
            error: 'Unknown conflict type',
          };
      }
    } catch (error: any) {
      return {
        success: false,
        conflict,
        action: 'Resolution failed',
        error: error.message,
      };
    }
  }

  /**
   * Resolve proof state mismatch
   * Strategy: Mint is source of truth, update local state
   */
  private async resolveProofStateMismatch(conflict: Conflict): Promise<ResolutionResult> {
    if (!conflict.proofId) {
      return {
        success: false,
        conflict,
        action: 'Missing proof ID',
        error: 'Cannot resolve without proof ID',
      };
    }

    try {
      // Update local proof to match mint (mark as spent)
      const success = await this.proofRepo.transitionState(
        conflict.proofId,
        ProofState.UNSPENT,
        ProofState.SPENT
      );

      if (success) {
        console.log(`[ConflictResolver] Resolved proof state mismatch for ${conflict.proofId}`);

        // Find and fail any pending transactions using this proof
        const transactions = await this.txRepo.getByTransactionId(conflict.proofId);
        for (const tx of transactions) {
          if (tx.status === TransactionStatus.PENDING) {
            await this.txRepo.markFailed(tx.id);
          }
        }

        return {
          success: true,
          conflict,
          action: 'Updated local proof state to SPENT',
        };
      }

      return {
        success: false,
        conflict,
        action: 'Failed to update proof state',
        error: 'State transition failed',
      };
    } catch (error: any) {
      return {
        success: false,
        conflict,
        action: 'Resolution error',
        error: error.message,
      };
    }
  }

  /**
   * Resolve double-spend
   * Strategy: Keep newest proof, mark others as invalid
   */
  private async resolveDoubleSpend(conflict: Conflict): Promise<ResolutionResult> {
    // This requires manual intervention in most cases
    // Auto-resolution would delete all but the most recent proof
    console.warn('[ConflictResolver] Double-spend detected, manual intervention required');

    return {
      success: false,
      conflict,
      action: 'Manual intervention required',
      error: 'Cannot auto-resolve double-spend',
    };
  }

  /**
   * Resolve transaction conflict
   * Strategy: Check transaction status on mint, update local
   */
  private async resolveTransactionConflict(conflict: Conflict): Promise<ResolutionResult> {
    if (!conflict.transactionId) {
      return {
        success: false,
        conflict,
        action: 'Missing transaction ID',
        error: 'Cannot resolve without transaction ID',
      };
    }

    try {
      // Mark transaction as failed
      await this.txRepo.markFailed(conflict.transactionId);

      return {
        success: true,
        conflict,
        action: 'Marked transaction as failed',
      };
    } catch (error: any) {
      return {
        success: false,
        conflict,
        action: 'Resolution error',
        error: error.message,
      };
    }
  }

  /**
   * Resolve all conflicts for a mint
   */
  async resolveAllConflicts(mintUrl: string): Promise<ConflictReport> {
    const startTime = Date.now();
    const conflicts = await this.detectConflicts(mintUrl);
    const results: ResolutionResult[] = [];

    console.log(`[ConflictResolver] Resolving ${conflicts.length} conflicts...`);

    for (const conflict of conflicts) {
      if (conflict.autoResolvable) {
        const result = await this.resolveConflict(conflict);
        results.push(result);
      } else {
        results.push({
          success: false,
          conflict,
          action: 'Skipped (not auto-resolvable)',
        });
      }
    }

    const resolved = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    const report: ConflictReport = {
      totalConflicts: conflicts.length,
      resolved,
      failed,
      results,
      timestamp: Date.now(),
    };

    console.log(`[ConflictResolver] Resolved ${resolved}/${conflicts.length} conflicts`);

    return report;
  }

  /**
   * Verify proof ownership
   * Ensures we actually own a proof by checking with mint
   */
  async verifyProofOwnership(proofId: string): Promise<boolean> {
    try {
      const proof = await this.proofRepo.getById(proofId);
      if (!proof) {
        return false;
      }

      const result = await this.walletService.checkProofsSpendable(
        proof.mintUrl,
        [proofId]
      );

      return result.spendable[0];
    } catch (error) {
      console.error('[ConflictResolver] Ownership verification failed:', error);
      return false;
    }
  }

  /**
   * Clean up invalid proofs
   * Removes proofs that are spent on mint but marked unspent locally
   */
  async cleanupInvalidProofs(mintUrl: string): Promise<number> {
    try {
      const conflicts = await this.detectConflicts(mintUrl);
      let cleaned = 0;

      for (const conflict of conflicts) {
        if (
          conflict.type === ConflictType.PROOF_STATE_MISMATCH &&
          conflict.proofId
        ) {
          await this.proofRepo.transitionState(
            conflict.proofId,
            ProofState.UNSPENT,
            ProofState.SPENT
          );
          cleaned++;
        }
      }

      console.log(`[ConflictResolver] Cleaned up ${cleaned} invalid proofs`);

      return cleaned;
    } catch (error: any) {
      console.error('[ConflictResolver] Cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Get conflict summary
   */
  async getConflictSummary(mintUrl: string): Promise<{
    total: number;
    byType: Record<ConflictType, number>;
    bySeverity: Record<string, number>;
    autoResolvable: number;
  }> {
    const conflicts = await this.detectConflicts(mintUrl);

    const byType: Record<ConflictType, number> = {
      [ConflictType.PROOF_STATE_MISMATCH]: 0,
      [ConflictType.DOUBLE_SPEND_DETECTED]: 0,
      [ConflictType.KEYSET_MISMATCH]: 0,
      [ConflictType.TRANSACTION_CONFLICT]: 0,
      [ConflictType.PROOF_NOT_FOUND]: 0,
    };

    const bySeverity: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let autoResolvable = 0;

    for (const conflict of conflicts) {
      byType[conflict.type]++;
      bySeverity[conflict.severity]++;
      if (conflict.autoResolvable) autoResolvable++;
    }

    return {
      total: conflicts.length,
      byType,
      bySeverity,
      autoResolvable,
    };
  }
}

/**
 * Singleton instance export
 */
export default ConflictResolver.getInstance();
