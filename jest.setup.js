/**
 * Jest Setup
 *
 * Configures the testing environment before tests run.
 * Mocks native modules and sets up testing utilities.
 */

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() =>
    Promise.resolve({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: {
        isConnectionExpensive: false,
      },
    })
  ),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Note: Mocking only packages that are actually installed
// Additional mocks can be added when packages are installed:
// - react-native-ble-plx
// - react-native-nfc-manager
// - @react-native-camera-roll/camera-roll
// - react-native-quick-crypto

// Mock @cashu/cashu-ts (installed)
// Enhanced mocks for comprehensive testing of all Cashu operations
jest.mock('@cashu/cashu-ts', () => ({
  CashuWallet: jest.fn().mockImplementation(() => ({
    // Mint operations
    createMintQuote: jest.fn(() => Promise.resolve({
      quote: 'quote-123',
      request: 'lnbc100n1...',
    })),
    mintProofs: jest.fn(() => Promise.resolve([
      { amount: 64, secret: 'secret1', C: 'C1', id: 'keyset1' },
      { amount: 32, secret: 'secret2', C: 'C2', id: 'keyset1' },
    ])),
    // Send operations
    send: jest.fn(() => Promise.resolve({
      send: [{ amount: 64, secret: 'send-secret', C: 'send-C', id: 'keyset1' }],
      keep: [{ amount: 32, secret: 'keep-secret', C: 'keep-C', id: 'keyset1' }],
    })),
    // Receive operations
    receive: jest.fn(() => Promise.resolve([
      { amount: 100, secret: 'received-secret', C: 'received-C', id: 'keyset1' },
    ])),
    // Melt (Lightning payment) operations
    createMeltQuote: jest.fn(() => Promise.resolve({
      quote: 'melt-quote-123',
      amount: 100,
      fee_reserve: 2,
      state: 'UNPAID',
      expiry: Date.now() + 600000,
    })),
    checkMeltQuote: jest.fn(() => Promise.resolve({
      quote: 'melt-quote-123',
      amount: 100,
      fee_reserve: 2,
      state: 'UNPAID',
    })),
    meltProofs: jest.fn(() => Promise.resolve({
      quote: { state: 'PAID', payment_preimage: 'preimage-abc123' },
      change: [{ amount: 2, secret: 'change-secret', C: 'change-C', id: 'keyset1' }],
    })),
    // Proof state checking
    checkProofsStates: jest.fn(() => Promise.resolve([
      { state: 'UNSPENT' },
    ])),
    // Legacy methods (for backwards compatibility)
    requestTokens: jest.fn(() => Promise.resolve({ proofs: [] })),
    checkProofsSpent: jest.fn(() => Promise.resolve({ spent: [], pending: [] })),
    requestMint: jest.fn(() => Promise.resolve({ pr: 'lnbc...', hash: '...' })),
    melt: jest.fn(() => Promise.resolve({ isPaid: true, preimage: '...' })),
  })),
  CashuMint: jest.fn().mockImplementation(() => ({
    getInfo: jest.fn(() => Promise.resolve({
      name: 'Test Mint',
      pubkey: 'test-pubkey-123',
      version: '0.15.0',
      description: 'A test mint',
      nuts: {
        '4': { supported: true },
        '5': { supported: true },
      },
    })),
    getKeys: jest.fn(() => Promise.resolve({
      keysets: [
        { id: 'keyset1', unit: 'sat', keys: { '1': 'pubkey1', '2': 'pubkey2' }, active: true },
      ],
    })),
    getKeysets: jest.fn(() => Promise.resolve({
      keysets: [{ id: 'keyset1', unit: 'sat', active: true }],
    })),
  })),
  getEncodedToken: jest.fn((token) => 'cashuAeyJ0b2tlbiI6W119'),
  getDecodedToken: jest.fn((token) => ({
    token: [{
      mint: 'https://testmint.com',
      proofs: [{ amount: 100, secret: 'decoded-secret', C: 'decoded-C', id: 'keyset1' }],
    }],
    memo: '',
  })),
}));

// Global test utilities
global.testUtils = {
  // Create a mock proof
  createMockProof: (overrides = {}) => ({
    id: 'proof-123',
    amount: 100,
    secret: 'secret-123',
    C: 'C-value',
    mintUrl: 'https://testmint.com',
    keysetId: 'keyset-123',
    state: 'UNSPENT',
    isOCR: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }),

  // Create a mock transaction
  createMockTransaction: (overrides = {}) => ({
    id: 'tx-123',
    type: 'SEND',
    status: 'COMPLETED',
    amount: 1000,
    mintUrl: 'https://testmint.com',
    mintName: 'Test Mint',
    proofCount: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }),

  // Create a mock mint
  createMockMint: (overrides = {}) => ({
    id: 'mint-123',
    url: 'https://testmint.com',
    name: 'Test Mint',
    publicKey: 'pubkey-123',
    trustLevel: 'TRUSTED',
    isDefault: false,
    lastSyncedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }),

  // Wait for async operations
  wait: (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Flush promises
  flushPromises: () => new Promise((resolve) => setImmediate(resolve)),
};

// Suppress console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};
