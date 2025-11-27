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
jest.mock('@cashu/cashu-ts', () => ({
  CashuWallet: jest.fn().mockImplementation(() => ({
    requestTokens: jest.fn(() => Promise.resolve({ proofs: [] })),
    send: jest.fn(() => Promise.resolve({ proofs: [], send: [] })),
    receive: jest.fn(() => Promise.resolve({ proofs: [] })),
    checkProofsSpent: jest.fn(() => Promise.resolve({ spent: [], pending: [] })),
    requestMint: jest.fn(() => Promise.resolve({ pr: 'lnbc...', hash: '...' })),
    melt: jest.fn(() => Promise.resolve({ isPaid: true, preimage: '...' })),
  })),
  CashuMint: jest.fn().mockImplementation(() => ({
    getInfo: jest.fn(() => Promise.resolve({
      name: 'Test Mint',
      pubkey: '...',
      version: '0.1.0',
    })),
    getKeys: jest.fn(() => Promise.resolve({})),
    getKeysets: jest.fn(() => Promise.resolve({ keysets: [] })),
  })),
  getEncodedToken: jest.fn(() => 'cashuA...'),
  getDecodedToken: jest.fn(() => ({ token: [], memo: '' })),
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
