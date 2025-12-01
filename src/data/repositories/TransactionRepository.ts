/**
 * TransactionRepository
 *
 * Manages transaction history and pending operations.
 * Tracks payments, swaps, and OCR operations across all mints.
 *
 * Features:
 * - Transaction history with filtering
 * - Pending transaction queue for offline operations
 * - Status tracking (pending, completed, failed)
 * - Direction tracking (incoming, outgoing)
 * - Rich filtering (date range, type, mint, status)
 */

import Database from '../database/Database';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  TransactionDirection,
} from '../../types';
import { generateUUID } from '../../utils/uuid';

/**
 * Transaction filter options
 */
export interface TransactionFilter {
  type?: TransactionType;
  status?: TransactionStatus;
  direction?: TransactionDirection;
  mintUrl?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

/**
 * Transaction statistics
 */
export interface TransactionStats {
  totalCount: number;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  totalReceived: number;
  totalSent: number;
  totalSwapped: number;
}

/**
 * TransactionRepository class
 */
export class TransactionRepository {
  private static instance: TransactionRepository;
  private db: Database;

  private constructor() {
    this.db = Database.getInstance();
  }

  static getInstance(): TransactionRepository {
    if (!TransactionRepository.instance) {
      TransactionRepository.instance = new TransactionRepository();
    }
    return TransactionRepository.instance;
  }

  /**
   * Create a new transaction
   */
  async create(
    transaction: Omit<Transaction, 'id' | 'createdAt'>
  ): Promise<Transaction> {
    const id = generateUUID();
    const createdAt = Date.now();

    await this.db.execute(
      `INSERT INTO transactions (
        id, type, amount, mint_url, status, direction,
        payment_request, proof_count, memo, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        transaction.type,
        transaction.amount,
        transaction.mintUrl,
        transaction.status || TransactionStatus.PENDING,
        transaction.direction,
        transaction.paymentRequest || null,
        transaction.proofCount || 0,
        transaction.memo || null,
        createdAt,
        transaction.completedAt || null,
      ]
    );

    return {
      id,
      ...transaction,
      status: transaction.status || TransactionStatus.PENDING,
      createdAt,
    };
  }

  /**
   * Get transaction by ID
   */
  async getById(id: string): Promise<Transaction | null> {
    const transactions = await this.db.query<any>(
      `SELECT * FROM transactions WHERE id = ?`,
      [id]
    );

    if (transactions.length === 0) {
      return null;
    }

    return this.mapRowToTransaction(transactions[0]);
  }

  /**
   * Get all transactions with filters
   */
  async getAll(filter: TransactionFilter = {}): Promise<Transaction[]> {
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params: any[] = [];

    if (filter.type) {
      sql += ' AND type = ?';
      params.push(filter.type);
    }

    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter.direction) {
      sql += ' AND direction = ?';
      params.push(filter.direction);
    }

    if (filter.mintUrl) {
      sql += ' AND mint_url = ?';
      params.push(filter.mintUrl);
    }

    if (filter.startDate) {
      sql += ' AND created_at >= ?';
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      sql += ' AND created_at <= ?';
      params.push(filter.endDate);
    }

    sql += ' ORDER BY created_at DESC';

    if (filter.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }

    if (filter.offset) {
      sql += ' OFFSET ?';
      params.push(filter.offset);
    }

    const rows = await this.db.query<any>(sql, params);
    return rows.map(row => this.mapRowToTransaction(row));
  }

  /**
   * Get recent transactions
   */
  async getRecent(limit: number = 20): Promise<Transaction[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM transactions
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );

    return rows.map(row => this.mapRowToTransaction(row));
  }

  /**
   * Get pending transactions (for offline queue processing)
   */
  async getPending(): Promise<Transaction[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM transactions
       WHERE status = ?
       ORDER BY created_at ASC`,
      [TransactionStatus.PENDING]
    );

    return rows.map(row => this.mapRowToTransaction(row));
  }

  /**
   * Get transactions for a specific mint
   */
  async getByMint(mintUrl: string, limit?: number): Promise<Transaction[]> {
    let sql = `SELECT * FROM transactions
               WHERE mint_url = ?
               ORDER BY created_at DESC`;
    const params: any[] = [mintUrl];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const rows = await this.db.query<any>(sql, params);
    return rows.map(row => this.mapRowToTransaction(row));
  }

  /**
   * Get transactions potentially associated with a proof ID
   * Note: This is used by ConflictResolver to find pending transactions
   * that might need to be failed when a proof conflict is detected.
   */
  async getByTransactionId(proofId: string): Promise<Transaction[]> {
    // Since we don't directly link transactions to specific proofs,
    // return pending transactions that could be affected
    // The caller will filter by status
    return this.getPending();
  }

  /**
   * Get transactions by type
   */
  async getByType(type: TransactionType, limit?: number): Promise<Transaction[]> {
    let sql = `SELECT * FROM transactions
               WHERE type = ?
               ORDER BY created_at DESC`;
    const params: any[] = [type];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const rows = await this.db.query<any>(sql, params);
    return rows.map(row => this.mapRowToTransaction(row));
  }

  /**
   * Get transactions in date range
   */
  async getByDateRange(
    startDate: number,
    endDate: number,
    limit?: number
  ): Promise<Transaction[]> {
    let sql = `SELECT * FROM transactions
               WHERE created_at BETWEEN ? AND ?
               ORDER BY created_at DESC`;
    const params: any[] = [startDate, endDate];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const rows = await this.db.query<any>(sql, params);
    return rows.map(row => this.mapRowToTransaction(row));
  }

  /**
   * Update transaction status
   */
  async updateStatus(
    id: string,
    status: TransactionStatus,
    completedAt?: number
  ): Promise<void> {
    const completedTimestamp =
      status === TransactionStatus.COMPLETED || status === TransactionStatus.FAILED
        ? completedAt || Date.now()
        : null;

    await this.db.execute(
      `UPDATE transactions
       SET status = ?, completed_at = ?
       WHERE id = ?`,
      [status, completedTimestamp, id]
    );
  }

  /**
   * Mark transaction as completed
   */
  async markCompleted(id: string, completedAt: number = Date.now()): Promise<void> {
    await this.updateStatus(id, TransactionStatus.COMPLETED, completedAt);
  }

  /**
   * Mark transaction as failed
   */
  async markFailed(id: string, completedAt: number = Date.now()): Promise<void> {
    await this.updateStatus(id, TransactionStatus.FAILED, completedAt);
  }

  /**
   * Update transaction
   */
  async update(
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>
  ): Promise<void> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.type !== undefined) {
      fields.push('type = ?');
      params.push(updates.type);
    }

    if (updates.amount !== undefined) {
      fields.push('amount = ?');
      params.push(updates.amount);
    }

    if (updates.mintUrl !== undefined) {
      fields.push('mint_url = ?');
      params.push(updates.mintUrl);
    }

    if (updates.status !== undefined) {
      fields.push('status = ?');
      params.push(updates.status);
    }

    if (updates.direction !== undefined) {
      fields.push('direction = ?');
      params.push(updates.direction);
    }

    if (updates.paymentRequest !== undefined) {
      fields.push('payment_request = ?');
      params.push(updates.paymentRequest);
    }

    if (updates.proofCount !== undefined) {
      fields.push('proof_count = ?');
      params.push(updates.proofCount);
    }

    if (updates.memo !== undefined) {
      fields.push('memo = ?');
      params.push(updates.memo);
    }

    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      params.push(updates.completedAt);
    }

    if (fields.length === 0) {
      return;
    }

    params.push(id);

    await this.db.execute(
      `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  }

  /**
   * Delete transaction
   */
  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM transactions WHERE id = ?', [id]);
  }

  /**
   * Delete old transactions (cleanup)
   */
  async deleteOlderThan(timestamp: number): Promise<number> {
    const result = await this.db.execute(
      `DELETE FROM transactions
       WHERE created_at < ? AND status IN (?, ?)`,
      [timestamp, TransactionStatus.COMPLETED, TransactionStatus.FAILED]
    );

    return result.rowsAffected || 0;
  }

  /**
   * Delete failed transactions older than X days
   */
  async cleanupOldFailedTransactions(daysOld: number = 30): Promise<number> {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

    const result = await this.db.execute(
      `DELETE FROM transactions
       WHERE created_at < ? AND status = ?`,
      [cutoffTime, TransactionStatus.FAILED]
    );

    const deletedCount = result.rowsAffected || 0;

    if (deletedCount > 0) {
      console.log(`[TransactionRepository] Cleaned up ${deletedCount} old failed transactions`);
    }

    return deletedCount;
  }

  /**
   * Get transaction count
   */
  getCount(): number {
    const result = this.db.querySync<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions'
    );

    return result[0]?.count || 0;
  }

  /**
   * Get pending transaction count
   */
  getPendingCount(): number {
    const result = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE status = ?`,
      [TransactionStatus.PENDING]
    );

    return result[0]?.count || 0;
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get transaction statistics
   */
  getStats(): TransactionStats {
    const totalCount = this.db.querySync<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions'
    )[0]?.count || 0;

    const pendingCount = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE status = ?`,
      [TransactionStatus.PENDING]
    )[0]?.count || 0;

    const completedCount = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE status = ?`,
      [TransactionStatus.COMPLETED]
    )[0]?.count || 0;

    const failedCount = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE status = ?`,
      [TransactionStatus.FAILED]
    )[0]?.count || 0;

    const receivedResult = this.db.querySync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE direction = ? AND status = ?`,
      [TransactionDirection.INCOMING, TransactionStatus.COMPLETED]
    );
    const totalReceived = receivedResult[0]?.total || 0;

    const sentResult = this.db.querySync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE direction = ? AND status = ?`,
      [TransactionDirection.OUTGOING, TransactionStatus.COMPLETED]
    );
    const totalSent = sentResult[0]?.total || 0;

    const swappedResult = this.db.querySync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE type = ? AND status = ?`,
      [TransactionType.SWAP, TransactionStatus.COMPLETED]
    );
    const totalSwapped = swappedResult[0]?.total || 0;

    return {
      totalCount,
      pendingCount,
      completedCount,
      failedCount,
      totalReceived,
      totalSent,
      totalSwapped,
    };
  }

  /**
   * Get statistics for a specific mint
   */
  getMintStats(mintUrl: string): {
    totalCount: number;
    totalReceived: number;
    totalSent: number;
  } {
    const totalCount = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE mint_url = ?`,
      [mintUrl]
    )[0]?.count || 0;

    const receivedResult = this.db.querySync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE mint_url = ? AND direction = ? AND status = ?`,
      [mintUrl, TransactionDirection.INCOMING, TransactionStatus.COMPLETED]
    );
    const totalReceived = receivedResult[0]?.total || 0;

    const sentResult = this.db.querySync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE mint_url = ? AND direction = ? AND status = ?`,
      [mintUrl, TransactionDirection.OUTGOING, TransactionStatus.COMPLETED]
    );
    const totalSent = sentResult[0]?.total || 0;

    return {
      totalCount,
      totalReceived,
      totalSent,
    };
  }

  /**
   * Get daily transaction volume (last N days)
   */
  async getDailyVolume(days: number = 7): Promise<Array<{
    date: string;
    received: number;
    sent: number;
    count: number;
  }>> {
    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);

    const rows = await this.db.query<any>(
      `SELECT
         DATE(created_at / 1000, 'unixepoch') as date,
         SUM(CASE WHEN direction = ? THEN amount ELSE 0 END) as received,
         SUM(CASE WHEN direction = ? THEN amount ELSE 0 END) as sent,
         COUNT(*) as count
       FROM transactions
       WHERE created_at >= ? AND status = ?
       GROUP BY date
       ORDER BY date DESC`,
      [
        TransactionDirection.INCOMING,
        TransactionDirection.OUTGOING,
        startDate,
        TransactionStatus.COMPLETED,
      ]
    );

    return rows.map(row => ({
      date: row.date,
      received: row.received || 0,
      sent: row.sent || 0,
      count: row.count || 0,
    }));
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Map database row to Transaction object
   */
  private mapRowToTransaction(row: any): Transaction {
    return {
      id: row.id,
      type: row.type as TransactionType,
      amount: row.amount,
      mintUrl: row.mint_url,
      status: row.status as TransactionStatus,
      direction: row.direction as TransactionDirection,
      paymentRequest: row.payment_request,
      proofCount: row.proof_count,
      memo: row.memo,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }
}

/**
 * Singleton instance export
 */
export default TransactionRepository;
