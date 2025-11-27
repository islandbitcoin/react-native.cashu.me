/**
 * Global TypeScript Type Definitions
 * Core types used throughout the Cashu Wallet application
 */

// ============================================================================
// Proof Types (Cashu Tokens)
// ============================================================================

export enum ProofState {
  UNSPENT = 'unspent',           // Available for spending
  PENDING_SEND = 'pending_send', // Locked for outgoing transfer
  PENDING_SWAP = 'pending_swap', // Awaiting mint confirmation
  SPENT = 'spent',               // Confirmed spent
  INVALID = 'invalid',           // Failed validation
}

export interface Proof {
  id: string;
  secret: string;
  C: string;                      // Blinded signature
  amount: number;
  mintUrl: string;
  keysetId: string;
  state: ProofState;
  isOCR: boolean;                 // Part of Offline Cash Reserve
  lockedAt?: number;              // Timestamp when locked
  lockedFor?: string;             // Transaction ID
  createdAt: number;
}

// ============================================================================
// Offline Cash Reserve (OCR) Types
// ============================================================================

export enum OCRLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export const OCR_TARGETS: Record<OCRLevel, number> = {
  [OCRLevel.LOW]: 10000,      // 10,000 sats
  [OCRLevel.MEDIUM]: 50000,   // 50,000 sats
  [OCRLevel.HIGH]: 100000,    // 100,000 sats
};

export enum OCRStatus {
  SYNCED = 'synced',                  // Online, OCR at target
  OFFLINE_READY = 'offline_ready',    // Offline, OCR available
  OUT_OF_SYNC = 'out_of_sync',        // Needs replenishment
  DEPLETED = 'depleted',              // OCR empty
}

export interface OCRState {
  status: OCRStatus;
  currentBalance: number;
  targetBalance: number;
  level: OCRLevel;
  lastReplenishAt: Date | null;
  proofCount: number;
}

export interface OCRConfig {
  id: number;  // Always 1 (singleton)
  targetLevel: OCRLevel;
  targetAmount: number;
  autoReplenish: boolean;
  lastReplenishAt?: number;
  createdAt: number;
}

// ============================================================================
// Transaction Types
// ============================================================================

export type TransactionType = 'send' | 'receive' | 'swap' | 'melt' | 'mint';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type TransportMethod = 'nfc' | 'qr' | 'bluetooth' | 'lightning' | 'online';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  unit: string;  // 'sat', 'usd', etc.
  mintUrl: string;
  status: TransactionStatus;
  token?: string;              // Serialized token for sends
  memo?: string;
  transportMethod?: TransportMethod;
  isOffline: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface PendingTransaction {
  id: string;
  type: TransactionType;
  payload: unknown;  // JSON serialized payload
  status: TransactionStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  updatedAt: number;
  errorMessage?: string;
}

// ============================================================================
// Mint Types
// ============================================================================

export interface MintKeyset {
  id: string;
  mintUrl: string;
  unit: string;
  keys: Record<string, string>;  // denomination -> public key
  active: boolean;
  createdAt: number;
}

export interface Mint {
  url: string;
  name?: string;
  description?: string;
  info?: MintInfo;
  trusted: boolean;
  lastSynced?: number;
  createdAt: number;
}

export interface MintInfo {
  name?: string;
  pubkey?: string;
  version?: string;
  description?: string;
  description_long?: string;
  contact?: Array<[string, string]>;
  nuts?: Record<string, unknown>;
  motd?: string;
}

// ============================================================================
// Transport Layer Types
// ============================================================================

export enum TransportType {
  NFC = 'nfc',
  QR = 'qr',
  BLUETOOTH = 'bluetooth',
}

export interface TransportPayload {
  type: 'token' | 'request';
  data: string;              // Encoded Cashu token
  amount: number;
  unit: string;
  senderId?: string;
  timestamp: number;
}

export interface TransportResult {
  success: boolean;
  transport: TransportType;
  payload?: TransportPayload;
  error?: string;
  duration: number;
}

export interface AnimatedQRFrame {
  index: number;
  total: number;
  data: string;
  checksum: string;
}

// ============================================================================
// Sync Engine Types
// ============================================================================

export interface QueuedTransaction {
  id: string;
  type: TransactionType;
  payload: unknown;
  status?: TransactionStatus;
  retryCount?: number;
  error?: string;
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
}

// ============================================================================
// Wallet Types
// ============================================================================

export interface WalletBalance {
  confirmed: number;
  pending: number;
  unit: string;
  mintUrl: string;
}

export interface WalletState {
  balances: Map<string, WalletBalance>;
  totalBalance: number;
  isInitialized: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export class CashuError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'CashuError';
  }
}

export class InsufficientFundsError extends CashuError {
  constructor(requested: number, available: number) {
    super(
      `Insufficient funds: requested ${requested} sats, available ${available} sats`,
      'INSUFFICIENT_FUNDS'
    );
  }
}

export class InsufficientOCRError extends CashuError {
  constructor(requested: number, available: number) {
    super(
      `Insufficient offline cash: requested ${requested} sats, available ${available} sats`,
      'INSUFFICIENT_OCR'
    );
  }
}

export class DoubleSpendError extends CashuError {
  constructor(proofId: string) {
    super(
      `Proof ${proofId} has already been spent`,
      'DOUBLE_SPEND'
    );
  }
}

export class MintConnectionError extends CashuError {
  constructor(mintUrl: string, originalError?: Error) {
    super(
      `Failed to connect to mint: ${mintUrl}. ${originalError?.message || ''}`,
      'MINT_CONNECTION_ERROR'
    );
  }
}
