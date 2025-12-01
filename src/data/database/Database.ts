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
    // Inline migrations for each version
    const migrations: Record<number, string> = {
      2: `
        -- Migration v2: Update mints table schema and add mint_keysets

        -- Create new mints table with correct schema
        CREATE TABLE IF NOT EXISTS mints_new (
          id TEXT PRIMARY KEY,
          url TEXT NOT NULL UNIQUE,
          name TEXT,
          description TEXT,
          public_key TEXT,
          trust_level TEXT NOT NULL DEFAULT 'untrusted',
          last_synced_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );

        -- Migrate existing data (if any) - generate UUIDs for old records
        INSERT OR IGNORE INTO mints_new (id, url, name, description, trust_level, created_at)
        SELECT
          lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
                substr(hex(randomblob(2)),2) || '-' ||
                substr('89ab', abs(random()) % 4 + 1, 1) ||
                substr(hex(randomblob(2)),2) || '-' ||
                hex(randomblob(6))) as id,
          url,
          name,
          description,
          CASE WHEN trusted = 1 THEN 'medium' ELSE 'untrusted' END as trust_level,
          created_at
        FROM mints;

        -- Drop old table and rename new one
        DROP TABLE IF EXISTS mints;
        ALTER TABLE mints_new RENAME TO mints;

        -- Create indexes for mints
        CREATE INDEX IF NOT EXISTS idx_mints_trust_level ON mints(trust_level);
        CREATE INDEX IF NOT EXISTS idx_mints_url ON mints(url);

        -- Create mint_keysets table
        CREATE TABLE IF NOT EXISTS mint_keysets (
          id TEXT PRIMARY KEY,
          mint_id TEXT NOT NULL,
          keyset_id TEXT NOT NULL,
          unit TEXT NOT NULL DEFAULT 'sat',
          active INTEGER NOT NULL DEFAULT 1,
          keys TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          FOREIGN KEY (mint_id) REFERENCES mints(id) ON DELETE CASCADE,
          UNIQUE(mint_id, keyset_id)
        );

        CREATE INDEX IF NOT EXISTS idx_mint_keysets_mint ON mint_keysets(mint_id);
        CREATE INDEX IF NOT EXISTS idx_mint_keysets_active ON mint_keysets(active);
      `,
      3: `
        -- Migration v3: Update transactions table schema

        -- Create new transactions table with correct schema
        CREATE TABLE IF NOT EXISTS transactions_new (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          mint_url TEXT NOT NULL,
          status TEXT NOT NULL,
          direction TEXT NOT NULL DEFAULT 'outgoing',
          payment_request TEXT,
          proof_count INTEGER NOT NULL DEFAULT 0,
          memo TEXT,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          completed_at INTEGER
        );

        -- Migrate existing data
        INSERT OR IGNORE INTO transactions_new (id, type, amount, mint_url, status, direction, memo, created_at, completed_at)
        SELECT
          id,
          type,
          amount,
          mint_url,
          status,
          'outgoing' as direction,
          memo,
          created_at,
          completed_at
        FROM transactions;

        -- Drop old table and rename new one
        DROP TABLE IF EXISTS transactions;
        ALTER TABLE transactions_new RENAME TO transactions;

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_transactions_mint_time ON transactions(mint_url, created_at);
        CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
        CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
        CREATE INDEX IF NOT EXISTS idx_transactions_direction ON transactions(direction);
      `,
      4: `
        -- Migration v4: Remove foreign key constraint from proofs table
        -- The keyset_id FK was causing INSERT failures since we don't always
        -- have the keyset in our local database (e.g., proofs from other wallets)

        -- Create new proofs table without FK constraint
        CREATE TABLE IF NOT EXISTS proofs_new (
          id TEXT PRIMARY KEY,
          secret TEXT NOT NULL UNIQUE,
          C TEXT NOT NULL,
          amount INTEGER NOT NULL,
          mint_url TEXT NOT NULL,
          keyset_id TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'unspent',
          is_ocr INTEGER NOT NULL DEFAULT 0,
          locked_at INTEGER,
          locked_for TEXT,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );

        -- Migrate existing data (if any)
        INSERT OR IGNORE INTO proofs_new (id, secret, C, amount, mint_url, keyset_id, state, is_ocr, locked_at, locked_for, created_at)
        SELECT id, secret, C, amount, mint_url, keyset_id, state, is_ocr, locked_at, locked_for, created_at
        FROM proofs;

        -- Drop old table and rename new one
        DROP TABLE IF EXISTS proofs;
        ALTER TABLE proofs_new RENAME TO proofs;

        -- Recreate indexes
        CREATE INDEX IF NOT EXISTS idx_proofs_mint_state ON proofs(mint_url, state);
        CREATE INDEX IF NOT EXISTS idx_proofs_keyset ON proofs(keyset_id);
        CREATE INDEX IF NOT EXISTS idx_proofs_ocr ON proofs(is_ocr, state);
        CREATE INDEX IF NOT EXISTS idx_proofs_locked ON proofs(locked_for);
      `,
    };

    return migrations[version] || null;
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
 * Export Database class as default
 * Use Database.getInstance() to get the singleton instance
 */
export default Database;
