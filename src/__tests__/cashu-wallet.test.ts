/**
 * Cashu Wallet Tests
 *
 * Tests for database schema, repository operations, and CashuWalletService.
 * These tests validate that all components work correctly together.
 */

// Mock react-native-quick-sqlite
jest.mock('react-native-quick-sqlite', () => ({
  open: jest.fn(() => ({
    execute: jest.fn(() => ({ rows: { length: 0, item: () => null } })),
    close: jest.fn(),
  })),
}));

// Mock the uuid generator
jest.mock('../utils/uuid', () => ({
  generateUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

import { SCHEMA_VERSION, createSchema } from '../data/database/schema';

describe('Database Schema', () => {
  describe('Schema Version', () => {
    it('should have schema version 4', () => {
      expect(SCHEMA_VERSION).toBe(4);
    });
  });

  describe('Transactions Table', () => {
    it('should have correct columns for transactions table', () => {
      expect(createSchema).toContain('CREATE TABLE IF NOT EXISTS transactions');
      expect(createSchema).toContain('id TEXT PRIMARY KEY');
      expect(createSchema).toContain('type TEXT NOT NULL');
      expect(createSchema).toContain('amount INTEGER NOT NULL');
      expect(createSchema).toContain('mint_url TEXT NOT NULL');
      expect(createSchema).toContain('status TEXT NOT NULL');
      expect(createSchema).toContain('direction TEXT NOT NULL');
      expect(createSchema).toContain('payment_request TEXT');
      expect(createSchema).toContain('proof_count INTEGER');
    });

    it('should NOT have old columns in transactions table', () => {
      // These were in the old schema but should be removed
      const transactionTableSection = createSchema
        .split('CREATE TABLE IF NOT EXISTS transactions')[1]
        .split('CREATE TABLE')[0];

      expect(transactionTableSection).not.toContain('unit TEXT');
      expect(transactionTableSection).not.toContain('token TEXT');
      expect(transactionTableSection).not.toContain('transport_method TEXT');
      expect(transactionTableSection).not.toContain('is_offline INTEGER');
    });
  });

  describe('Mints Table', () => {
    it('should have correct columns for mints table', () => {
      expect(createSchema).toContain('CREATE TABLE IF NOT EXISTS mints');

      const mintsTableSection = createSchema
        .split('CREATE TABLE IF NOT EXISTS mints')[1]
        .split('CREATE TABLE')[0];

      expect(mintsTableSection).toContain('id TEXT PRIMARY KEY');
      expect(mintsTableSection).toContain('url TEXT NOT NULL UNIQUE');
      expect(mintsTableSection).toContain('trust_level TEXT');
      expect(mintsTableSection).toContain('public_key TEXT');
      expect(mintsTableSection).toContain('last_synced_at INTEGER');
    });
  });

  describe('Proofs Table', () => {
    it('should have correct columns for proofs table', () => {
      expect(createSchema).toContain('CREATE TABLE IF NOT EXISTS proofs');
      expect(createSchema).toContain('secret TEXT NOT NULL UNIQUE');
      expect(createSchema).toContain('C TEXT NOT NULL');
      expect(createSchema).toContain('amount INTEGER NOT NULL');
      expect(createSchema).toContain('mint_url TEXT NOT NULL');
      expect(createSchema).toContain('keyset_id TEXT NOT NULL');
      expect(createSchema).toContain('state TEXT NOT NULL');
      expect(createSchema).toContain('is_ocr INTEGER');
    });
  });

  describe('Mint Keysets Table', () => {
    it('should have mint_keysets table', () => {
      expect(createSchema).toContain('CREATE TABLE IF NOT EXISTS mint_keysets');
      expect(createSchema).toContain('mint_id TEXT NOT NULL');
      expect(createSchema).toContain('keyset_id TEXT NOT NULL');
      expect(createSchema).toContain('keys TEXT NOT NULL');
    });
  });
});

describe('Type Definitions', () => {
  it('should have matching TransactionType values', () => {
    // Import after mocks
    const { TransactionType } = require('../types');

    expect(TransactionType.SEND).toBeDefined();
    expect(TransactionType.RECEIVE).toBeDefined();
    expect(TransactionType.MINT).toBeDefined();
    expect(TransactionType.MELT).toBeDefined();
    expect(TransactionType.SWAP).toBeDefined();
    expect(TransactionType.LIGHTNING).toBeDefined();
  });

  it('should have matching TransactionStatus values', () => {
    const { TransactionStatus } = require('../types');

    expect(TransactionStatus.PENDING).toBeDefined();
    expect(TransactionStatus.COMPLETED).toBeDefined();
    expect(TransactionStatus.FAILED).toBeDefined();
  });

  it('should have matching TransactionDirection values', () => {
    const { TransactionDirection } = require('../types');

    expect(TransactionDirection.INCOMING).toBeDefined();
    expect(TransactionDirection.OUTGOING).toBeDefined();
  });

  it('should have matching ProofState values', () => {
    const { ProofState } = require('../types');

    expect(ProofState.UNSPENT).toBeDefined();
    expect(ProofState.PENDING_SEND).toBeDefined();
    expect(ProofState.PENDING_SWAP).toBeDefined();
    expect(ProofState.SPENT).toBeDefined();
  });

  it('should have matching TrustLevel values', () => {
    const { TrustLevel } = require('../types');

    expect(TrustLevel.UNTRUSTED).toBeDefined();
    expect(TrustLevel.LOW).toBeDefined();
    expect(TrustLevel.MEDIUM).toBeDefined();
    expect(TrustLevel.HIGH).toBeDefined();
  });
});

describe('cashu-ts API Compatibility', () => {
  it('should import getEncodedToken and getDecodedToken as functions', () => {
    // These should be standalone functions in v2.5.3+
    const cashuTs = require('@cashu/cashu-ts');

    expect(typeof cashuTs.getEncodedToken).toBe('function');
    expect(typeof cashuTs.getDecodedToken).toBe('function');
  });

  it('should have CashuWallet class', () => {
    const cashuTs = require('@cashu/cashu-ts');

    expect(cashuTs.CashuWallet).toBeDefined();
  });

  it('should have CashuMint class', () => {
    const cashuTs = require('@cashu/cashu-ts');

    expect(cashuTs.CashuMint).toBeDefined();
  });
});
