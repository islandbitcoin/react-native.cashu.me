/**
 * Database Manager
 *
 * SQLite database wrapper using react-native-quick-sqlite (JSI-based).
 * Provides synchronous queries for fast UI updates and async operations
 * for background tasks.
 *
 * Features:
 * - WAL (Write-Ahead Logging) mode for better concurrency
 * - Foreign key constraints enforced
 * - Transaction support with automatic rollback
 * - Migration system
 * - Synchronous queries via JSI
 */

import { open, QuickSQLite } from 'react-native-quick-sqlite';
import { createSchema, dropSchema, validateSchema, DATABASE_CONFIG, SCHEMA_VERSION } from './schema';

/**
 * Transaction context for database operations
 */
export interface TransactionContext {
  execute: (sql: string, params?: any[]) => QuickSQLite.QueryResult;
  query: <T = any>(sql: string, params?: any[]) => T[];
  executeBatch: (statements: Array<{ sql: string; params?: any[] }>) => void;
}

/**
 * Query result type
 */
export interface QueryResult<T = any> {
  rows: T[];
  rowsAffected: number;
  insertId?: number;
}

/**
 * Database class
 *
 * Singleton pattern ensures only one database connection
 */
export class Database {
  private static instance: Database;
  private db: QuickSQLite.DB | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * Initialize database connection
   * Sets up WAL mode, foreign keys, and runs migrations
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[Database] Already initialized');
      return;
    }

    try {
      console.log('[Database] Initializing...');

      // Open database connection
      this.db = open({
        name: DATABASE_CONFIG.name,
        location: DATABASE_CONFIG.location,
      });

      // Enable WAL mode for better concurrency
      if (DATABASE_CONFIG.enableWAL) {
        this.executeSync('PRAGMA journal_mode = WAL');
        console.log('[Database] WAL mode enabled');
      }

      // Enable foreign key constraints
      if (DATABASE_CONFIG.foreignKeys) {
        this.executeSync('PRAGMA foreign_keys = ON');
        console.log('[Database] Foreign keys enabled');
      }

      // Run migrations
      await this.runMigrations();

      this.isInitialized = true;
      console.log('[Database] Initialization complete');
    } catch (error: any) {
      console.error('[Database] Initialization failed:', error);
      throw new Error(`Failed to initialize database: ${error.message}`);
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('[Database] Connection closed');
    }
  }

  /**
   * Check if database is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Execute SQL synchronously (no return data)
   * Fast for UI-blocking operations
   */
  executeSync(sql: string, params?: any[]): QuickSQLite.QueryResult {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      return this.db.execute(sql, params);
    } catch (error: any) {
      console.error('[Database] Execute failed:', sql, error);
      throw new Error(`SQL execution failed: ${error.message}`);
    }
  }

  /**
   * Query database synchronously
   * Returns array of results
   * Use for fast UI updates
   */
  querySync<T = any>(sql: string, params?: any[]): T[] {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = this.db.execute(sql, params);

      // Extract rows from result
      if (!result.rows) {
        return [];
      }

      // Convert to array
      const rows: T[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        rows.push(result.rows.item(i) as T);
      }

      return rows;
    } catch (error: any) {
      console.error('[Database] Query failed:', sql, error);
      throw new Error(`SQL query failed: ${error.message}`);
    }
  }

  /**
   * Query database asynchronously
   * Use for background operations
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return Promise.resolve(this.querySync<T>(sql, params));
  }

  /**
   * Execute SQL asynchronously
   */
  async execute(sql: string, params?: any[]): Promise<QuickSQLite.QueryResult> {
    return Promise.resolve(this.executeSync(sql, params));
  }

  /**
   * Execute multiple SQL statements in a transaction
   * Automatically rolls back on error
   */
  async transaction<T>(
    callback: (tx: TransactionContext) => Promise<T>
  ): Promise<T> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Begin transaction
    this.executeSync('BEGIN IMMEDIATE');

    try {
      // Create transaction context
      const txContext: TransactionContext = {
        execute: (sql: string, params?: any[]) => this.executeSync(sql, params),
        query: <T>(sql: string, params?: any[]) => this.querySync<T>(sql, params),
        executeBatch: (statements: Array<{ sql: string; params?: any[] }>) => {
          statements.forEach(({ sql, params }) => this.executeSync(sql, params));
        },
      };

      // Execute callback with transaction context
      const result = await callback(txContext);

      // Commit transaction
      this.executeSync('COMMIT');

      return result;
    } catch (error: any) {
      // Rollback on error
      try {
        this.executeSync('ROLLBACK');
      } catch (rollbackError) {
        console.error('[Database] Rollback failed:', rollbackError);
      }

      console.error('[Database] Transaction failed:', error);
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  /**
   * Run database migrations
   * Creates schema and applies version updates
   */
  private async runMigrations(): Promise<void> {
    try {
      console.log('[Database] Running migrations...');

      // Check current schema version
      const currentVersion = this.getCurrentSchemaVersion();
      console.log(`[Database] Current version: ${currentVersion}, Target: ${SCHEMA_VERSION}`);

      if (currentVersion === 0) {
        // Fresh database - create schema
        await this.createInitialSchema();
      } else if (currentVersion < SCHEMA_VERSION) {
        // Run incremental migrations
        await this.runIncrementalMigrations(currentVersion, SCHEMA_VERSION);
      }

      console.log('[Database] Migrations complete');
    } catch (error: any) {
      console.error('[Database] Migration failed:', error);
      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  /**
   * Get current schema version
   */
  private getCurrentSchemaVersion(): number {
    try {
      const result = this.querySync<{ user_version: number }>(
        'PRAGMA user_version'
      );

      return result[0]?.user_version || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Set schema version
   */
  private setSchemaVersion(version: number): void {
    this.executeSync(`PRAGMA user_version = ${version}`);
  }

  /**
   * Create initial database schema
   */
  private async createInitialSchema(): Promise<void> {
    console.log('[Database] Creating initial schema...');

    await this.transaction(async (tx) => {
      // Execute all schema creation statements
      const statements = createSchema.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          tx.execute(statement);
        }
      }

      // Validate schema
      const validation = tx.query(validateSchema);
      console.log('[Database] Schema validation:', validation);
    });

    // Set schema version
    this.setSchemaVersion(SCHEMA_VERSION);

    console.log('[Database] Initial schema created');
  }

  /**
   * Run incremental migrations
   */
  private async runIncrementalMigrations(
    fromVersion: number,
    toVersion: number
  ): Promise<void> {
    console.log(`[Database] Running migrations from v${fromVersion} to v${toVersion}`);

    for (let version = fromVersion + 1; version <= toVersion; version++) {
      await this.runMigration(version);
    }
  }

  /**
   * Run a specific migration version
   */
  private async runMigration(version: number): Promise<void> {
    console.log(`[Database] Applying migration v${version}`);

    await this.transaction(async (tx) => {
      // Load migration file
      const migration = await this.loadMigration(version);

      if (!migration) {
        throw new Error(`Migration v${version} not found`);
      }

      // Execute migration
      const statements = migration.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          tx.execute(statement);
        }
      }
    });

    // Update version
    this.setSchemaVersion(version);

    console.log(`[Database] Migration v${version} complete`);
  }

  /**
   * Load migration file
   */
  private async loadMigration(version: number): Promise<string | null> {
    try {
      // In production, load from migrations folder
      // For now, return null (no incremental migrations yet)
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Drop all tables (DANGEROUS - for testing only)
   */
  async dropAllTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    console.warn('[Database] Dropping all tables...');

    await this.transaction(async (tx) => {
      const statements = dropSchema.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          tx.execute(statement);
        }
      }
    });

    this.setSchemaVersion(0);

    console.log('[Database] All tables dropped');
  }

  /**
   * Get database statistics
   */
  getStats(): {
    proofCount: number;
    transactionCount: number;
    mintCount: number;
    dbSize: number;
  } {
    const proofCount = this.querySync<{ count: number }>(
      'SELECT COUNT(*) as count FROM proofs'
    )[0]?.count || 0;

    const transactionCount = this.querySync<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions'
    )[0]?.count || 0;

    const mintCount = this.querySync<{ count: number }>(
      'SELECT COUNT(*) as count FROM mints'
    )[0]?.count || 0;

    const dbSize = this.querySync<{ page_count: number; page_size: number }>(
      'PRAGMA page_count, page_size'
    ).reduce((total, row) => total + (row.page_count * row.page_size), 0);

    return {
      proofCount,
      transactionCount,
      mintCount,
      dbSize,
    };
  }

  /**
   * Optimize database (VACUUM)
   */
  async optimize(): Promise<void> {
    console.log('[Database] Optimizing...');
    this.executeSync('VACUUM');
    console.log('[Database] Optimization complete');
  }

  /**
   * Check database integrity
   */
  async checkIntegrity(): Promise<boolean> {
    try {
      const result = this.querySync<{ integrity_check: string }>(
        'PRAGMA integrity_check'
      );

      const isOk = result.length === 1 && result[0].integrity_check === 'ok';

      if (!isOk) {
        console.error('[Database] Integrity check failed:', result);
      }

      return isOk;
    } catch (error) {
      console.error('[Database] Integrity check error:', error);
      return false;
    }
  }
}

/**
 * Singleton instance export
 */
export default Database.getInstance();
