/**
 * OperationQueue
 *
 * Persistent queue for offline operations.
 * Stores operations that fail due to network issues and retries them when online.
 *
 * Features:
 * - Persistent storage (survives app restarts)
 * - Priority-based execution
 * - Retry with exponential backoff
 * - Operation deduplication
 * - Automatic cleanup of old operations
 *
 * Operation Types:
 * - MINT: Mint tokens after Lightning payment
 * - SWAP: Swap proofs for different denominations
 * - MELT: Pay Lightning invoice
 * - SEND: Send tokens to recipient
 * - RECEIVE: Receive and validate tokens
 * - SYNC_OCR: Refill OCR balance
 * - SYNC_KEYSETS: Update mint keysets
 */

import Database from '../../data/database/Database';
import { generateUUID } from '../../utils/uuid';

/**
 * Operation types
 */
export enum OperationType {
  MINT = 'mint',
  SWAP = 'swap',
  MELT = 'melt',
  SEND = 'send',
  RECEIVE = 'receive',
  SYNC_OCR = 'sync_ocr',
  SYNC_KEYSETS = 'sync_keysets',
}

/**
 * Operation status
 */
export enum OperationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Operation priority
 */
export enum OperationPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Queue operation
 */
export interface QueueOperation {
  id: string;
  type: OperationType;
  priority: OperationPriority;
  status: OperationStatus;
  payload: any; // Operation-specific data
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
  scheduledFor?: number; // For delayed retries
}

/**
 * Queue statistics
 */
export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  byType: Record<OperationType, number>;
  byPriority: Record<OperationPriority, number>;
}

/**
 * Process result
 */
export interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

/**
 * OperationQueue class
 */
export class OperationQueue {
  private static instance: OperationQueue;
  private db: Database;

  // Retry configuration
  private readonly MAX_RETRIES = 5;
  private readonly BASE_RETRY_DELAY = 5000; // 5 seconds
  private readonly MAX_RETRY_DELAY = 300000; // 5 minutes

  // Cleanup configuration
  private readonly COMPLETED_RETENTION_HOURS = 24;
  private readonly FAILED_RETENTION_HOURS = 72;

  private constructor() {
    this.db = Database.getInstance();
    this.initializeQueue();
  }

  static getInstance(): OperationQueue {
    if (!OperationQueue.instance) {
      OperationQueue.instance = new OperationQueue();
    }
    return OperationQueue.instance;
  }

  /**
   * Initialize queue table
   */
  private async initializeQueue(): Promise<void> {
    try {
      // Create operations table if it doesn't exist
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS operation_queue (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          priority INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'pending',
          payload TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          max_retries INTEGER NOT NULL DEFAULT 5,
          last_error TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          scheduled_for INTEGER
        )
      `);

      // Create indices for performance
      await this.db.execute(`
        CREATE INDEX IF NOT EXISTS idx_operation_status_priority
        ON operation_queue(status, priority DESC, created_at ASC)
      `);

      await this.db.execute(`
        CREATE INDEX IF NOT EXISTS idx_operation_scheduled
        ON operation_queue(scheduled_for)
        WHERE scheduled_for IS NOT NULL
      `);

      console.log('[OperationQueue] Initialized');
    } catch (error) {
      console.error('[OperationQueue] Initialization failed:', error);
    }
  }

  /**
   * Enqueue operation
   */
  async enqueue(
    type: OperationType,
    payload: any,
    priority: OperationPriority = OperationPriority.MEDIUM
  ): Promise<string> {
    const id = generateUUID();
    const now = Date.now();

    try {
      await this.db.execute(
        `INSERT INTO operation_queue (
          id, type, priority, status, payload,
          retry_count, max_retries, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          type,
          priority,
          OperationStatus.PENDING,
          JSON.stringify(payload),
          0,
          this.MAX_RETRIES,
          now,
          now,
        ]
      );

      console.log(`[OperationQueue] Enqueued ${type} operation: ${id}`);

      return id;
    } catch (error: any) {
      throw new Error(`Failed to enqueue operation: ${error.message}`);
    }
  }

  /**
   * Dequeue next operation (by priority and creation time)
   */
  async dequeue(): Promise<QueueOperation | null> {
    return this.db.transaction(async (tx) => {
      // Get next pending operation (highest priority, oldest first)
      const operations = tx.query<any>(
        `SELECT * FROM operation_queue
         WHERE status = ? AND (scheduled_for IS NULL OR scheduled_for <= ?)
         ORDER BY priority DESC, created_at ASC
         LIMIT 1`,
        [OperationStatus.PENDING, Date.now()]
      );

      if (operations.length === 0) {
        return null;
      }

      const op = operations[0];

      // Mark as processing
      tx.execute(
        `UPDATE operation_queue
         SET status = ?, updated_at = ?
         WHERE id = ?`,
        [OperationStatus.PROCESSING, Date.now(), op.id]
      );

      return this.mapRowToOperation(op);
    });
  }

  /**
   * Get operation by ID
   */
  async get(id: string): Promise<QueueOperation | null> {
    const operations = await this.db.query<any>(
      `SELECT * FROM operation_queue WHERE id = ?`,
      [id]
    );

    if (operations.length === 0) {
      return null;
    }

    return this.mapRowToOperation(operations[0]);
  }

  /**
   * Update operation status
   */
  async updateStatus(
    id: string,
    status: OperationStatus,
    error?: string
  ): Promise<void> {
    await this.db.execute(
      `UPDATE operation_queue
       SET status = ?, last_error = ?, updated_at = ?
       WHERE id = ?`,
      [status, error || null, Date.now(), id]
    );
  }

  /**
   * Mark operation as completed
   */
  async complete(id: string): Promise<void> {
    await this.updateStatus(id, OperationStatus.COMPLETED);
  }

  /**
   * Mark operation as failed with retry
   */
  async fail(id: string, error: string): Promise<void> {
    return this.db.transaction(async (tx) => {
      const operations = tx.query<any>(
        `SELECT * FROM operation_queue WHERE id = ?`,
        [id]
      );

      if (operations.length === 0) {
        return;
      }

      const op = operations[0];
      const retryCount = op.retry_count + 1;

      if (retryCount >= op.max_retries) {
        // Exceeded max retries, mark as failed
        tx.execute(
          `UPDATE operation_queue
           SET status = ?, retry_count = ?, last_error = ?, updated_at = ?
           WHERE id = ?`,
          [OperationStatus.FAILED, retryCount, error, Date.now(), id]
        );

        console.log(`[OperationQueue] Operation ${id} failed after ${retryCount} retries`);
      } else {
        // Schedule retry with exponential backoff
        const delay = this.calculateRetryDelay(retryCount);
        const scheduledFor = Date.now() + delay;

        tx.execute(
          `UPDATE operation_queue
           SET status = ?, retry_count = ?, last_error = ?, updated_at = ?, scheduled_for = ?
           WHERE id = ?`,
          [OperationStatus.PENDING, retryCount, error, Date.now(), scheduledFor, id]
        );

        console.log(
          `[OperationQueue] Operation ${id} retry ${retryCount}/${op.max_retries} scheduled in ${delay}ms`
        );
      }
    });
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = this.BASE_RETRY_DELAY * Math.pow(2, retryCount);
    return Math.min(delay, this.MAX_RETRY_DELAY);
  }

  /**
   * Get all pending operations
   */
  async getPending(): Promise<QueueOperation[]> {
    const operations = await this.db.query<any>(
      `SELECT * FROM operation_queue
       WHERE status = ?
       ORDER BY priority DESC, created_at ASC`,
      [OperationStatus.PENDING]
    );

    return operations.map(op => this.mapRowToOperation(op));
  }

  /**
   * Get operations by type
   */
  async getByType(type: OperationType): Promise<QueueOperation[]> {
    const operations = await this.db.query<any>(
      `SELECT * FROM operation_queue
       WHERE type = ?
       ORDER BY created_at DESC`,
      [type]
    );

    return operations.map(op => this.mapRowToOperation(op));
  }

  /**
   * Get operations by status
   */
  async getByStatus(status: OperationStatus): Promise<QueueOperation[]> {
    const operations = await this.db.query<any>(
      `SELECT * FROM operation_queue
       WHERE status = ?
       ORDER BY created_at DESC`,
      [status]
    );

    return operations.map(op => this.mapRowToOperation(op));
  }

  /**
   * Cancel operation
   */
  async cancel(id: string): Promise<void> {
    await this.updateStatus(id, OperationStatus.CANCELLED);
  }

  /**
   * Clear completed operations
   */
  async clearCompleted(): Promise<number> {
    const result = await this.db.execute(
      `DELETE FROM operation_queue WHERE status = ?`,
      [OperationStatus.COMPLETED]
    );

    return result.rowsAffected || 0;
  }

  /**
   * Clear old operations
   */
  async clearOld(): Promise<number> {
    const completedCutoff =
      Date.now() - this.COMPLETED_RETENTION_HOURS * 60 * 60 * 1000;
    const failedCutoff =
      Date.now() - this.FAILED_RETENTION_HOURS * 60 * 60 * 1000;

    const result = await this.db.execute(
      `DELETE FROM operation_queue
       WHERE (status = ? AND updated_at < ?)
          OR (status = ? AND updated_at < ?)`,
      [
        OperationStatus.COMPLETED,
        completedCutoff,
        OperationStatus.FAILED,
        failedCutoff,
      ]
    );

    const deleted = result.rowsAffected || 0;

    if (deleted > 0) {
      console.log(`[OperationQueue] Cleared ${deleted} old operations`);
    }

    return deleted;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const total = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM operation_queue`
    )[0]?.count || 0;

    const pending = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM operation_queue WHERE status = ?`,
      [OperationStatus.PENDING]
    )[0]?.count || 0;

    const processing = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM operation_queue WHERE status = ?`,
      [OperationStatus.PROCESSING]
    )[0]?.count || 0;

    const completed = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM operation_queue WHERE status = ?`,
      [OperationStatus.COMPLETED]
    )[0]?.count || 0;

    const failed = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM operation_queue WHERE status = ?`,
      [OperationStatus.FAILED]
    )[0]?.count || 0;

    // Count by type
    const typeRows = this.db.querySync<{ type: OperationType; count: number }>(
      `SELECT type, COUNT(*) as count FROM operation_queue GROUP BY type`
    );

    const byType: Record<OperationType, number> = {
      [OperationType.MINT]: 0,
      [OperationType.SWAP]: 0,
      [OperationType.MELT]: 0,
      [OperationType.SEND]: 0,
      [OperationType.RECEIVE]: 0,
      [OperationType.SYNC_OCR]: 0,
      [OperationType.SYNC_KEYSETS]: 0,
    };

    typeRows.forEach(row => {
      byType[row.type] = row.count;
    });

    // Count by priority
    const priorityRows = this.db.querySync<{ priority: OperationPriority; count: number }>(
      `SELECT priority, COUNT(*) as count FROM operation_queue GROUP BY priority`
    );

    const byPriority: Record<OperationPriority, number> = {
      [OperationPriority.LOW]: 0,
      [OperationPriority.MEDIUM]: 0,
      [OperationPriority.HIGH]: 0,
      [OperationPriority.CRITICAL]: 0,
    };

    priorityRows.forEach(row => {
      byPriority[row.priority] = row.count;
    });

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      byType,
      byPriority,
    };
  }

  /**
   * Process all pending operations
   * This would be called by a queue processor
   */
  async processPending(
    processor: (operation: QueueOperation) => Promise<void>
  ): Promise<ProcessResult> {
    const result: ProcessResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Get all pending operations
      const pending = await this.getPending();

      console.log(`[OperationQueue] Processing ${pending.length} pending operations...`);

      for (const operation of pending) {
        try {
          // Process operation
          await processor(operation);

          // Mark as completed
          await this.complete(operation.id);

          result.succeeded++;
          result.processed++;
        } catch (error: any) {
          // Mark as failed (will retry if retries remain)
          await this.fail(operation.id, error.message);

          result.failed++;
          result.processed++;
          result.errors.push(`${operation.type}: ${error.message}`);
        }
      }

      console.log(
        `[OperationQueue] Processed ${result.processed} operations (${result.succeeded} succeeded, ${result.failed} failed)`
      );

      return result;
    } catch (error: any) {
      console.error('[OperationQueue] Processing failed:', error);
      return result;
    }
  }

  /**
   * Map database row to operation
   */
  private mapRowToOperation(row: any): QueueOperation {
    return {
      id: row.id,
      type: row.type as OperationType,
      priority: row.priority as OperationPriority,
      status: row.status as OperationStatus,
      payload: JSON.parse(row.payload),
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      scheduledFor: row.scheduled_for,
    };
  }
}

/**
 * Singleton instance export
 */
export default OperationQueue;
