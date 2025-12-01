/**
 * Database Schema for Cashu Wallet
 * SQLite database structure with offline-first design
 */

export const SCHEMA_VERSION = 4;

/**
 * SQL statements to create all tables
 * Designed for offline-first operation with efficient indexing
 */
export const createSchema = `
  -- ============================================================================
  -- Proofs Table (eCash Tokens)
  -- ============================================================================
  -- Note: No foreign key on keyset_id since we may receive proofs from
  -- keysets we haven't stored locally (e.g., from other wallets)
  CREATE TABLE IF NOT EXISTS proofs (
    id TEXT PRIMARY KEY,
    secret TEXT NOT NULL UNIQUE,
    C TEXT NOT NULL,
    amount INTEGER NOT NULL,
    mint_url TEXT NOT NULL,
    keyset_id TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'unspent',
    is_ocr INTEGER NOT NULL DEFAULT 0,       -- Part of Offline Cash Reserve
    locked_at INTEGER,
    locked_for TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_proofs_mint_state ON proofs(mint_url, state);
  CREATE INDEX IF NOT EXISTS idx_proofs_keyset ON proofs(keyset_id);
  CREATE INDEX IF NOT EXISTS idx_proofs_ocr ON proofs(is_ocr, state);
  CREATE INDEX IF NOT EXISTS idx_proofs_locked ON proofs(locked_for);

  -- ============================================================================
  -- Offline Cash Reserve Configuration (Singleton Table)
  -- ============================================================================
  CREATE TABLE IF NOT EXISTS ocr_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),   -- Singleton
    target_level TEXT NOT NULL DEFAULT 'medium',  -- low, medium, high
    target_amount INTEGER NOT NULL DEFAULT 50000, -- sats
    auto_replenish INTEGER NOT NULL DEFAULT 1,
    last_replenish_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- ============================================================================
  -- Pending Transactions (Offline Queue)
  -- ============================================================================
  CREATE TABLE IF NOT EXISTS pending_transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,  -- 'send', 'receive', 'swap', 'melt', 'mint'
    payload TEXT NOT NULL,  -- JSON serialized
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 5,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    error_message TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_transactions(status);
  CREATE INDEX IF NOT EXISTS idx_pending_created ON pending_transactions(created_at);

  -- ============================================================================
  -- Mint Keysets (Cached Public Keys)
  -- ============================================================================
  CREATE TABLE IF NOT EXISTS keysets (
    id TEXT PRIMARY KEY,
    mint_url TEXT NOT NULL,
    unit TEXT NOT NULL,
    keys TEXT NOT NULL,  -- JSON serialized public keys
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_keysets_mint ON keysets(mint_url);
  CREATE INDEX IF NOT EXISTS idx_keysets_active ON keysets(active);

  -- ============================================================================
  -- Transaction History
  -- ============================================================================
  CREATE TABLE IF NOT EXISTS transactions (
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

  CREATE INDEX IF NOT EXISTS idx_transactions_mint_time ON transactions(mint_url, created_at);
  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  CREATE INDEX IF NOT EXISTS idx_transactions_direction ON transactions(direction);

  -- ============================================================================
  -- Mints
  -- ============================================================================
  CREATE TABLE IF NOT EXISTS mints (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    name TEXT,
    description TEXT,
    public_key TEXT,
    trust_level TEXT NOT NULL DEFAULT 'untrusted',
    last_synced_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_mints_trust_level ON mints(trust_level);
  CREATE INDEX IF NOT EXISTS idx_mints_url ON mints(url);

  -- ============================================================================
  -- Mint Keysets (for MintRepository)
  -- ============================================================================
  CREATE TABLE IF NOT EXISTS mint_keysets (
    id TEXT PRIMARY KEY,
    mint_id TEXT NOT NULL,
    keyset_id TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'sat',
    active INTEGER NOT NULL DEFAULT 1,
    keys TEXT NOT NULL,  -- JSON serialized public keys
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (mint_id) REFERENCES mints(id) ON DELETE CASCADE,
    UNIQUE(mint_id, keyset_id)
  );

  CREATE INDEX IF NOT EXISTS idx_mint_keysets_mint ON mint_keysets(mint_id);
  CREATE INDEX IF NOT EXISTS idx_mint_keysets_active ON mint_keysets(active);

  -- ============================================================================
  -- Initialize OCR Config (Singleton)
  -- ============================================================================
  INSERT OR IGNORE INTO ocr_config (id, target_level, target_amount, auto_replenish)
  VALUES (1, 'medium', 50000, 1);
`;

/**
 * SQL statements to drop all tables (for testing/development)
 */
export const dropSchema = `
  DROP TABLE IF EXISTS transactions;
  DROP TABLE IF EXISTS pending_transactions;
  DROP TABLE IF EXISTS proofs;
  DROP TABLE IF EXISTS keysets;
  DROP TABLE IF EXISTS mint_keysets;
  DROP TABLE IF EXISTS mints;
  DROP TABLE IF EXISTS ocr_config;
`;

/**
 * Validate database schema integrity
 */
export const validateSchema = `
  PRAGMA integrity_check;
  PRAGMA foreign_key_check;
`;

/**
 * Database configuration
 */
export const DATABASE_CONFIG = {
  name: 'cashu_wallet.db',
  location: 'default',
  enableWAL: true,  // Write-Ahead Logging for better concurrency
  foreignKeys: true,
};
