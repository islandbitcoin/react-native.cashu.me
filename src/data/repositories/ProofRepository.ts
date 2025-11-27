/**
 * ProofRepository
 *
 * Manages Cashu proofs (ecash tokens) with state machine to prevent double-spending.
 * Implements pessimistic locking for concurrent operations.
 *
 * State Machine:
 * UNSPENT → PENDING_SEND → SPENT
 * UNSPENT → PENDING_SWAP → UNSPENT (new proofs)
 * UNSPENT → INVALID (failed validation)
 *
 * Critical Security:
 * - Row-level locking prevents race conditions
 * - Stale lock cleanup (5-minute timeout)
 * - Atomic state transitions
 * - Coin selection optimization
 */

import Database from '../database/Database';
import { Proof, ProofState } from '../../types';
import { generateUUID } from '../../utils/uuid';

/**
 * Coin selection result
 */
export interface CoinSelectionResult {
  proofs: Proof[];
  total: number;
  change: number;
}

/**
 * Proof filter options
 */
export interface ProofFilter {
  mintUrl?: string;
  state?: ProofState;
  isOCR?: boolean;
  keysetId?: string;
}

/**
 * ProofRepository class
 */
export class ProofRepository {
  private static instance: ProofRepository;
  private db: Database;

  // Stale lock timeout (5 minutes)
  private readonly LOCK_TIMEOUT_MS = 5 * 60 * 1000;

  private constructor() {
    this.db = Database.getInstance();
  }

  static getInstance(): ProofRepository {
    if (!ProofRepository.instance) {
      ProofRepository.instance = new ProofRepository();
    }
    return ProofRepository.instance;
  }

  /**
   * Store a new proof
   */
  async create(proof: Omit<Proof, 'id' | 'createdAt'>): Promise<Proof> {
    const id = generateUUID();
    const createdAt = Date.now();

    await this.db.execute(
      `INSERT INTO proofs (
        id, secret, C, amount, mint_url, keyset_id,
        state, is_ocr, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        proof.secret,
        proof.C,
        proof.amount,
        proof.mintUrl,
        proof.keysetId,
        proof.state || ProofState.UNSPENT,
        proof.isOCR ? 1 : 0,
        createdAt,
      ]
    );

    return {
      id,
      ...proof,
      state: proof.state || ProofState.UNSPENT,
      createdAt,
    };
  }

  /**
   * Store multiple proofs in a transaction
   */
  async createMany(proofs: Array<Omit<Proof, 'id' | 'createdAt'>>): Promise<Proof[]> {
    return this.db.transaction(async (tx) => {
      const createdProofs: Proof[] = [];

      for (const proof of proofs) {
        const id = generateUUID();
        const createdAt = Date.now();

        tx.execute(
          `INSERT INTO proofs (
            id, secret, C, amount, mint_url, keyset_id,
            state, is_ocr, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            proof.secret,
            proof.C,
            proof.amount,
            proof.mintUrl,
            proof.keysetId,
            proof.state || ProofState.UNSPENT,
            proof.isOCR ? 1 : 0,
            createdAt,
          ]
        );

        createdProofs.push({
          id,
          ...proof,
          state: proof.state || ProofState.UNSPENT,
          createdAt,
        });
      }

      return createdProofs;
    });
  }

  /**
   * Get proof by ID
   */
  async getById(id: string): Promise<Proof | null> {
    const proofs = await this.db.query<any>(
      `SELECT * FROM proofs WHERE id = ?`,
      [id]
    );

    if (proofs.length === 0) {
      return null;
    }

    return this.mapRowToProof(proofs[0]);
  }

  /**
   * Get proof by secret (unique identifier)
   */
  async getBySecret(secret: string): Promise<Proof | null> {
    const proofs = await this.db.query<any>(
      `SELECT * FROM proofs WHERE secret = ?`,
      [secret]
    );

    if (proofs.length === 0) {
      return null;
    }

    return this.mapRowToProof(proofs[0]);
  }

  /**
   * Get all proofs with filters
   */
  async getAll(filter: ProofFilter = {}): Promise<Proof[]> {
    let sql = 'SELECT * FROM proofs WHERE 1=1';
    const params: any[] = [];

    if (filter.mintUrl) {
      sql += ' AND mint_url = ?';
      params.push(filter.mintUrl);
    }

    if (filter.state) {
      sql += ' AND state = ?';
      params.push(filter.state);
    }

    if (filter.isOCR !== undefined) {
      sql += ' AND is_ocr = ?';
      params.push(filter.isOCR ? 1 : 0);
    }

    if (filter.keysetId) {
      sql += ' AND keyset_id = ?';
      params.push(filter.keysetId);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = await this.db.query<any>(sql, params);
    return rows.map(row => this.mapRowToProof(row));
  }

  /**
   * Get balance for a mint
   */
  getBalance(mintUrl: string): number {
    const result = this.db.querySync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM proofs
       WHERE mint_url = ? AND state = ?`,
      [mintUrl, ProofState.UNSPENT]
    );

    return result[0]?.total || 0;
  }

  /**
   * Get total balance across all mints
   */
  getTotalBalance(): number {
    const result = this.db.querySync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM proofs
       WHERE state = ?`,
      [ProofState.UNSPENT]
    );

    return result[0]?.total || 0;
  }

  /**
   * Get OCR balance
   */
  getOCRBalance(): number {
    const result = this.db.querySync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM proofs
       WHERE is_ocr = 1 AND state = ?`,
      [ProofState.UNSPENT]
    );

    return result[0]?.total || 0;
  }

  /**
   * Atomic state transition with pessimistic locking
   *
   * This is CRITICAL for preventing double-spends
   */
  async transitionState(
    proofId: string,
    fromState: ProofState,
    toState: ProofState,
    transactionId?: string
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      // Lock row for update (prevents concurrent modifications)
      const proofs = tx.query<any>(
        `SELECT * FROM proofs WHERE id = ? AND state = ?`,
        [proofId, fromState]
      );

      if (proofs.length === 0) {
        return false; // State already changed or proof doesn't exist
      }

      const proof = proofs[0];

      // Check for stale locks (release after timeout)
      if (proof.locked_at && Date.now() - proof.locked_at > this.LOCK_TIMEOUT_MS) {
        console.warn(`[ProofRepository] Releasing stale lock for proof ${proofId}`);
        toState = ProofState.UNSPENT;
      }

      // Update state
      tx.execute(
        `UPDATE proofs
         SET state = ?, locked_at = ?, locked_for = ?
         WHERE id = ?`,
        [toState, Date.now(), transactionId, proofId]
      );

      return true;
    });
  }

  /**
   * Select proofs for spending (greedy coin selection)
   *
   * Locks selected proofs to prevent double-spending
   */
  async selectProofsForAmount(
    mintUrl: string,
    amount: number,
    transactionId: string,
    useOCR: boolean = false
  ): Promise<CoinSelectionResult> {
    return this.db.transaction(async (tx) => {
      // Get available proofs ordered for optimal selection (largest first)
      let sql = `SELECT * FROM proofs
                 WHERE mint_url = ? AND state = ?`;
      const params: any[] = [mintUrl, ProofState.UNSPENT];

      if (useOCR) {
        sql += ' AND is_ocr = 1';
      }

      sql += ' ORDER BY amount DESC';

      const availableProofs = tx.query<any>(sql, params);

      // Greedy coin selection
      const selected: Proof[] = [];
      let total = 0;

      for (const row of availableProofs) {
        if (total >= amount) break;

        const proof = this.mapRowToProof(row);
        selected.push(proof);
        total += proof.amount;
      }

      // Check if we have enough
      if (total < amount) {
        throw new Error(
          `Insufficient funds: requested ${amount}, available ${total}`
        );
      }

      // Lock selected proofs
      for (const proof of selected) {
        tx.execute(
          `UPDATE proofs
           SET state = ?, locked_at = ?, locked_for = ?
           WHERE id = ?`,
          [ProofState.PENDING_SEND, Date.now(), transactionId, proof.id]
        );
      }

      return {
        proofs: selected,
        total,
        change: total - amount,
      };
    });
  }

  /**
   * Mark proofs as OCR (Offline Cash Reserve)
   */
  async markAsOCR(proofIds: string[]): Promise<void> {
    if (proofIds.length === 0) return;

    const placeholders = proofIds.map(() => '?').join(',');

    await this.db.execute(
      `UPDATE proofs SET is_ocr = 1 WHERE id IN (${placeholders})`,
      proofIds
    );
  }

  /**
   * Unmark proofs as OCR
   */
  async unmarkAsOCR(proofIds: string[]): Promise<void> {
    if (proofIds.length === 0) return;

    const placeholders = proofIds.map(() => '?').join(',');

    await this.db.execute(
      `UPDATE proofs SET is_ocr = 0 WHERE id IN (${placeholders})`,
      proofIds
    );
  }

  /**
   * Delete proof (use with caution - usually mark as SPENT instead)
   */
  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM proofs WHERE id = ?', [id]);
  }

  /**
   * Delete proofs by secret (for cleanup after swap)
   */
  async deleteBySecrets(secrets: string[]): Promise<void> {
    if (secrets.length === 0) return;

    const placeholders = secrets.map(() => '?').join(',');

    await this.db.execute(
      `DELETE FROM proofs WHERE secret IN (${placeholders})`,
      secrets
    );
  }

  /**
   * Get proof count by state
   */
  getCountByState(state: ProofState): number {
    const result = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM proofs WHERE state = ?`,
      [state]
    );

    return result[0]?.count || 0;
  }

  /**
   * Release stale locks
   * Call this periodically to clean up abandoned locks
   */
  async releaseStaleLocks(): Promise<number> {
    const cutoffTime = Date.now() - this.LOCK_TIMEOUT_MS;

    const result = await this.db.execute(
      `UPDATE proofs
       SET state = ?, locked_at = NULL, locked_for = NULL
       WHERE state IN (?, ?) AND locked_at < ?`,
      [ProofState.UNSPENT, ProofState.PENDING_SEND, ProofState.PENDING_SWAP, cutoffTime]
    );

    const releasedCount = result.rowsAffected || 0;

    if (releasedCount > 0) {
      console.log(`[ProofRepository] Released ${releasedCount} stale locks`);
    }

    return releasedCount;
  }

  /**
   * Get proofs by transaction ID (locked for specific transaction)
   */
  async getByTransactionId(transactionId: string): Promise<Proof[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM proofs WHERE locked_for = ?`,
      [transactionId]
    );

    return rows.map(row => this.mapRowToProof(row));
  }

  /**
   * Map database row to Proof object
   */
  private mapRowToProof(row: any): Proof {
    return {
      id: row.id,
      secret: row.secret,
      C: row.C,
      amount: row.amount,
      mintUrl: row.mint_url,
      keysetId: row.keyset_id,
      state: row.state as ProofState,
      isOCR: row.is_ocr === 1,
      lockedAt: row.locked_at,
      lockedFor: row.locked_for,
      createdAt: row.created_at,
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    unspent: number;
    pending: number;
    spent: number;
    ocr: number;
    totalValue: number;
    ocrValue: number;
  } {
    const totalCount = this.db.querySync<{ count: number }>(
      'SELECT COUNT(*) as count FROM proofs'
    )[0]?.count || 0;

    const unspentCount = this.getCountByState(ProofState.UNSPENT);
    const pendingCount =
      this.getCountByState(ProofState.PENDING_SEND) +
      this.getCountByState(ProofState.PENDING_SWAP);
    const spentCount = this.getCountByState(ProofState.SPENT);

    const ocrCount = this.db.querySync<{ count: number }>(
      'SELECT COUNT(*) as count FROM proofs WHERE is_ocr = 1'
    )[0]?.count || 0;

    const totalValue = this.getTotalBalance();
    const ocrValue = this.getOCRBalance();

    return {
      total: totalCount,
      unspent: unspentCount,
      pending: pendingCount,
      spent: spentCount,
      ocr: ocrCount,
      totalValue,
      ocrValue,
    };
  }
}

/**
 * Singleton instance export
 */
export default ProofRepository.getInstance();
