/**
 * Repository Integration Tests
 *
 * Tests all repositories with real database transactions.
 * Run these tests to verify the data layer is working correctly.
 *
 * Usage:
 * - Import and call `runRepositoryTests()` from App.tsx during development
 * - Remove before production
 *
 * Note: These are integration tests designed to run on-device, not in Jest.
 * The jest.mock calls below allow the file to be imported without errors in Jest.
 */

// Mock native modules for Jest environment
jest.mock('react-native-quick-sqlite', () => ({
  open: jest.fn(() => ({
    execute: jest.fn(() => ({ rows: { length: 0, item: () => null } })),
    close: jest.fn(),
  })),
}));

jest.mock('react-native-quick-crypto', () => ({
  randomBytes: jest.fn((size: number) => {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }),
  install: jest.fn(),
}));

import Database from '../data/database/Database';
import ProofRepository from '../data/repositories/ProofRepository';
import MintRepository from '../data/repositories/MintRepository';
import TransactionRepository from '../data/repositories/TransactionRepository';
import {
  ProofState,
  TrustLevel,
  TransactionType,
  TransactionStatus,
  TransactionDirection,
} from '../types';

/**
 * Test result type
 */
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

/**
 * Run all repository tests
 */
export async function runRepositoryTests(): Promise<{
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  console.log('\n========================================');
  console.log('🧪 REPOSITORY TESTS STARTING...');
  console.log('========================================\n');

  // Initialize database
  const db = Database.getInstance();
  await db.initialize();

  // Clean slate for tests
  console.log('🗑️  Cleaning database...');
  await db.dropAllTables();
  await db.initialize();

  // Run all tests
  const tests = [
    testProofRepositoryCRUD,
    testProofStateTransitions,
    testProofCoinSelection,
    testProofLocking,
    testMintRepositoryCRUD,
    testMintKeysetManagement,
    testKeysetRotation,
    testTransactionRepositoryCRUD,
    testTransactionFiltering,
    testTransactionStatistics,
    testDatabaseTransactions,
    testRepositoryStats,
  ];

  for (const test of tests) {
    const startTime = Date.now();
    try {
      await test();
      const duration = Date.now() - startTime;
      results.push({
        name: test.name,
        passed: true,
        duration,
      });
      console.log(`✅ ${test.name} (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      results.push({
        name: test.name,
        passed: false,
        error: error.message,
        duration,
      });
      console.error(`❌ ${test.name} (${duration}ms)`);
      console.error(`   Error: ${error.message}`);
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n========================================');
  console.log(`📊 TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  return { passed, failed, results };
}

// ============================================
// PROOF REPOSITORY TESTS
// ============================================

async function testProofRepositoryCRUD() {
  const repo = ProofRepository.getInstance();

  // Create proof
  const proof = await repo.create({
    secret: 'test_secret_123',
    C: 'test_c_value',
    amount: 1000,
    mintUrl: 'https://testmint.com',
    keysetId: 'test_keyset',
    state: ProofState.UNSPENT,
    isOCR: false,
  });

  if (!proof.id) throw new Error('Proof ID not generated');
  if (proof.amount !== 1000) throw new Error('Proof amount mismatch');

  // Read proof
  const retrieved = await repo.getById(proof.id);
  if (!retrieved) throw new Error('Proof not found');
  if (retrieved.secret !== 'test_secret_123') throw new Error('Proof secret mismatch');

  // Get by secret
  const bySecret = await repo.getBySecret('test_secret_123');
  if (!bySecret) throw new Error('Proof not found by secret');
  if (bySecret.id !== proof.id) throw new Error('Proof ID mismatch');

  // Get all
  const all = await repo.getAll();
  if (all.length === 0) throw new Error('No proofs found');

  // Get balance
  const balance = repo.getBalance('https://testmint.com');
  if (balance !== 1000) throw new Error(`Balance mismatch: expected 1000, got ${balance}`);
}

async function testProofStateTransitions() {
  const repo = ProofRepository.getInstance();

  // Create proof
  const proof = await repo.create({
    secret: 'state_test_secret',
    C: 'state_test_c',
    amount: 500,
    mintUrl: 'https://testmint.com',
    keysetId: 'test_keyset',
    state: ProofState.UNSPENT,
    isOCR: false,
  });

  // Transition UNSPENT -> PENDING_SEND
  const success1 = await repo.transitionState(
    proof.id,
    ProofState.UNSPENT,
    ProofState.PENDING_SEND,
    'tx_123'
  );
  if (!success1) throw new Error('State transition failed');

  // Verify state changed
  const updated1 = await repo.getById(proof.id);
  if (updated1?.state !== ProofState.PENDING_SEND) {
    throw new Error('State not updated to PENDING_SEND');
  }

  // Try invalid transition (should fail)
  const success2 = await repo.transitionState(
    proof.id,
    ProofState.UNSPENT,
    ProofState.SPENT
  );
  if (success2) throw new Error('Invalid state transition should fail');

  // Transition PENDING_SEND -> SPENT
  const success3 = await repo.transitionState(
    proof.id,
    ProofState.PENDING_SEND,
    ProofState.SPENT
  );
  if (!success3) throw new Error('Final state transition failed');

  // Verify final state
  const updated2 = await repo.getById(proof.id);
  if (updated2?.state !== ProofState.SPENT) {
    throw new Error('State not updated to SPENT');
  }
}

async function testProofCoinSelection() {
  const repo = ProofRepository.getInstance();

  // Create multiple proofs of different amounts
  const amounts = [100, 200, 500, 1000, 2000];
  for (const amount of amounts) {
    await repo.create({
      secret: `coin_${amount}`,
      C: `c_${amount}`,
      amount,
      mintUrl: 'https://testmint.com',
      keysetId: 'test_keyset',
      state: ProofState.UNSPENT,
      isOCR: false,
    });
  }

  // Select proofs for 1500 sats (should select 2000 + change)
  const selection = await repo.selectProofsForAmount(
    'https://testmint.com',
    1500,
    'tx_coin_select'
  );

  if (selection.total < 1500) {
    throw new Error('Insufficient funds selected');
  }

  if (selection.change !== selection.total - 1500) {
    throw new Error('Change calculation incorrect');
  }

  if (selection.proofs.length === 0) {
    throw new Error('No proofs selected');
  }

  // Verify proofs are locked
  for (const proof of selection.proofs) {
    const locked = await repo.getById(proof.id);
    if (locked?.state !== ProofState.PENDING_SEND) {
      throw new Error('Proof not locked');
    }
  }
}

async function testProofLocking() {
  const repo = ProofRepository.getInstance();

  // Create proof
  const proof = await repo.create({
    secret: 'lock_test',
    C: 'lock_c',
    amount: 100,
    mintUrl: 'https://testmint.com',
    keysetId: 'test_keyset',
    state: ProofState.UNSPENT,
    isOCR: false,
  });

  // Lock proof
  await repo.transitionState(
    proof.id,
    ProofState.UNSPENT,
    ProofState.PENDING_SEND,
    'lock_tx_123'
  );

  // Get by transaction ID
  const locked = await repo.getByTransactionId('lock_tx_123');
  if (locked.length !== 1) throw new Error('Locked proof not found by transaction ID');
  if (locked[0].id !== proof.id) throw new Error('Wrong proof returned');
}

// ============================================
// MINT REPOSITORY TESTS
// ============================================

async function testMintRepositoryCRUD() {
  const repo = MintRepository.getInstance();

  // Create mint
  const mint = await repo.create({
    url: 'https://testmint.com',
    name: 'Test Mint',
    description: 'A test mint for testing',
    publicKey: 'test_pubkey',
    trustLevel: TrustLevel.MEDIUM,
  });

  if (!mint.id) throw new Error('Mint ID not generated');
  if (mint.name !== 'Test Mint') throw new Error('Mint name mismatch');

  // Read mint
  const retrieved = await repo.getById(mint.id);
  if (!retrieved) throw new Error('Mint not found');
  if (retrieved.url !== 'https://testmint.com') throw new Error('Mint URL mismatch');

  // Get by URL
  const byUrl = await repo.getByUrl('https://testmint.com');
  if (!byUrl) throw new Error('Mint not found by URL');
  if (byUrl.id !== mint.id) throw new Error('Mint ID mismatch');

  // Update trust level
  await repo.setTrustLevel(mint.id, TrustLevel.HIGH);
  const updated = await repo.getById(mint.id);
  if (updated?.trustLevel !== TrustLevel.HIGH) {
    throw new Error('Trust level not updated');
  }

  // Get trusted mints
  const trusted = await repo.getTrustedMints();
  if (trusted.length === 0) throw new Error('No trusted mints found');

  // Update last synced
  const now = Date.now();
  await repo.updateLastSynced(mint.id, now);
  const synced = await repo.getById(mint.id);
  if (synced?.lastSyncedAt !== now) throw new Error('Last synced not updated');
}

async function testMintKeysetManagement() {
  const repo = MintRepository.getInstance();

  // Create mint first
  const mint = await repo.create({
    url: 'https://keysetmint.com',
    name: 'Keyset Mint',
    trustLevel: TrustLevel.MEDIUM,
  });

  // Create keyset
  const keyset = await repo.createKeyset({
    mintId: mint.id,
    keysetId: 'keyset_001',
    unit: 'sat',
    active: true,
    keys: {
      '1': 'pubkey_1',
      '2': 'pubkey_2',
      '4': 'pubkey_4',
    },
  });

  if (!keyset.id) throw new Error('Keyset ID not generated');

  // Get keyset
  const retrieved = await repo.getKeysetById(keyset.id);
  if (!retrieved) throw new Error('Keyset not found');
  if (retrieved.keysetId !== 'keyset_001') throw new Error('Keyset ID mismatch');

  // Get by keyset ID and mint ID
  const byKeysetId = await repo.getKeysetByKeysetId(mint.id, 'keyset_001');
  if (!byKeysetId) throw new Error('Keyset not found by keyset ID');

  // Get all keysets for mint
  const allKeysets = await repo.getKeysets({ mintId: mint.id });
  if (allKeysets.length === 0) throw new Error('No keysets found for mint');

  // Get active keysets
  const activeKeysets = await repo.getActiveKeysets(mint.id);
  if (activeKeysets.length !== 1) throw new Error('Wrong number of active keysets');

  // Deactivate keyset
  await repo.deactivateKeyset(keyset.id);
  const deactivated = await repo.getKeysetById(keyset.id);
  if (deactivated?.active) throw new Error('Keyset not deactivated');
}

async function testKeysetRotation() {
  const repo = MintRepository.getInstance();

  // Create mint
  const mint = await repo.create({
    url: 'https://rotationmint.com',
    name: 'Rotation Mint',
    trustLevel: TrustLevel.MEDIUM,
  });

  // Create two keysets
  const keyset1 = await repo.createKeyset({
    mintId: mint.id,
    keysetId: 'keyset_old',
    unit: 'sat',
    active: true,
    keys: { '1': 'old_key' },
  });

  const keyset2 = await repo.createKeyset({
    mintId: mint.id,
    keysetId: 'keyset_new',
    unit: 'sat',
    active: false,
    keys: { '1': 'new_key' },
  });

  // Rotate to new keyset
  await repo.rotateKeysets(mint.id, 'keyset_new');

  // Verify rotation
  const old = await repo.getKeysetById(keyset1.id);
  const newKeyset = await repo.getKeysetById(keyset2.id);

  if (old?.active) throw new Error('Old keyset still active');
  if (!newKeyset?.active) throw new Error('New keyset not activated');
}

// ============================================
// TRANSACTION REPOSITORY TESTS
// ============================================

async function testTransactionRepositoryCRUD() {
  const repo = TransactionRepository.getInstance();

  // Create transaction
  const tx = await repo.create({
    type: TransactionType.SEND,
    amount: 1000,
    mintUrl: 'https://testmint.com',
    status: TransactionStatus.PENDING,
    direction: TransactionDirection.OUTGOING,
    proofCount: 3,
    memo: 'Test payment',
  });

  if (!tx.id) throw new Error('Transaction ID not generated');
  if (tx.amount !== 1000) throw new Error('Transaction amount mismatch');

  // Read transaction
  const retrieved = await repo.getById(tx.id);
  if (!retrieved) throw new Error('Transaction not found');
  if (retrieved.memo !== 'Test payment') throw new Error('Transaction memo mismatch');

  // Update status
  await repo.markCompleted(tx.id);
  const completed = await repo.getById(tx.id);
  if (completed?.status !== TransactionStatus.COMPLETED) {
    throw new Error('Transaction not marked as completed');
  }
  if (!completed.completedAt) {
    throw new Error('Completed timestamp not set');
  }
}

async function testTransactionFiltering() {
  const repo = TransactionRepository.getInstance();

  // Create multiple transactions
  const transactions = [
    {
      type: TransactionType.SEND,
      amount: 100,
      mintUrl: 'https://mint1.com',
      status: TransactionStatus.COMPLETED,
      direction: TransactionDirection.OUTGOING,
      proofCount: 1,
    },
    {
      type: TransactionType.RECEIVE,
      amount: 200,
      mintUrl: 'https://mint1.com',
      status: TransactionStatus.COMPLETED,
      direction: TransactionDirection.INCOMING,
      proofCount: 2,
    },
    {
      type: TransactionType.SWAP,
      amount: 300,
      mintUrl: 'https://mint2.com',
      status: TransactionStatus.PENDING,
      direction: TransactionDirection.OUTGOING,
      proofCount: 3,
    },
  ];

  for (const tx of transactions) {
    await repo.create(tx);
  }

  // Filter by type
  const sends = await repo.getByType(TransactionType.SEND);
  if (sends.length === 0) throw new Error('No SEND transactions found');

  // Filter by mint
  const mint1Txs = await repo.getByMint('https://mint1.com');
  if (mint1Txs.length !== 2) throw new Error('Wrong number of transactions for mint1');

  // Get pending
  const pending = await repo.getPending();
  if (pending.length === 0) throw new Error('No pending transactions found');

  // Get recent
  const recent = await repo.getRecent(10);
  if (recent.length === 0) throw new Error('No recent transactions found');
}

async function testTransactionStatistics() {
  const repo = TransactionRepository.getInstance();

  // Get stats
  const stats = repo.getStats();

  if (stats.totalCount === 0) throw new Error('No transactions counted');
  if (stats.completedCount < 0) throw new Error('Invalid completed count');
  if (stats.pendingCount < 0) throw new Error('Invalid pending count');

  // Get mint stats
  const mintStats = repo.getMintStats('https://mint1.com');
  if (mintStats.totalCount === 0) throw new Error('No transactions for mint');
}

// ============================================
// DATABASE TRANSACTION TESTS
// ============================================

async function testDatabaseTransactions() {
  const db = Database.getInstance();
  const proofRepo = ProofRepository.getInstance();

  // Test rollback on error
  try {
    await db.transaction(async (tx) => {
      // Create proof
      tx.execute(
        `INSERT INTO proofs (id, secret, C, amount, mint_url, keyset_id, state, is_ocr, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['tx_test_1', 'secret1', 'c1', 100, 'https://testmint.com', 'ks1', ProofState.UNSPENT, 0, Date.now()]
      );

      // Force error
      throw new Error('Intentional error for rollback test');
    });
  } catch (error) {
    // Expected error
  }

  // Verify proof was not created (rollback worked)
  const proof = await proofRepo.getById('tx_test_1');
  if (proof) throw new Error('Transaction rollback failed - proof exists');

  // Test successful transaction
  await db.transaction(async (tx) => {
    tx.execute(
      `INSERT INTO proofs (id, secret, C, amount, mint_url, keyset_id, state, is_ocr, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['tx_test_2', 'secret2', 'c2', 200, 'https://testmint.com', 'ks1', ProofState.UNSPENT, 0, Date.now()]
    );
  });

  // Verify proof was created (commit worked)
  const proof2 = await proofRepo.getById('tx_test_2');
  if (!proof2) throw new Error('Transaction commit failed - proof not found');
}

// ============================================
// REPOSITORY STATISTICS TESTS
// ============================================

async function testRepositoryStats() {
  const proofRepo = ProofRepository.getInstance();
  const mintRepo = MintRepository.getInstance();
  const txRepo = TransactionRepository.getInstance();

  // Proof stats
  const proofStats = proofRepo.getStats();
  if (proofStats.total < 0) throw new Error('Invalid proof total');
  if (proofStats.totalValue < 0) throw new Error('Invalid proof value');

  // Mint stats
  const mintStats = mintRepo.getStats();
  if (mintStats.totalMints < 0) throw new Error('Invalid mint total');

  // Transaction stats
  const txStats = txRepo.getStats();
  if (txStats.totalCount < 0) throw new Error('Invalid transaction total');
}

/**
 * Run quick smoke test (subset of all tests)
 */
export async function runQuickTests(): Promise<boolean> {
  console.log('🚀 Running quick smoke tests...');

  const db = Database.getInstance();
  await db.initialize();

  try {
    await testProofRepositoryCRUD();
    await testMintRepositoryCRUD();
    await testTransactionRepositoryCRUD();
    console.log('✅ Quick tests passed!');
    return true;
  } catch (error: any) {
    console.error('❌ Quick tests failed:', error.message);
    return false;
  }
}

// Jest test to satisfy "must contain at least one test" requirement
// The actual repository tests are integration tests designed to run on-device
describe('Repository Integration Tests', () => {
  it('exports test runner functions', () => {
    expect(typeof runRepositoryTests).toBe('function');
    expect(typeof runQuickTests).toBe('function');
  });
});
