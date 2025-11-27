# API Reference

## CashuWalletService

The main entry point for all Cashu operations.

### Getting the Instance
```typescript
import CashuWalletService from './src/core/cashu/CashuWalletService';
const cashu = CashuWalletService.getInstance();
```

### Minting (Receive from Lightning)
```typescript
// Step 1: Get quote
const { quote, request } = await cashu.requestMintQuote(mintUrl, 10000);
// request = Lightning invoice to pay

// Step 2: After invoice paid, mint tokens
const { proofs, total, transactionId } = await cashu.mintTokens(mintUrl, 10000, quote);
```

### Sending Tokens
```typescript
// Prepare proofs for sending
const { proofs, change, transactionId } = await cashu.send(mintUrl, 500);

// Encode as shareable token
const token = cashu.encodeToken(proofs);

// After recipient confirms
await cashu.confirmSend(proofs.map(p => p.id), transactionId);
```

### Receiving Tokens
```typescript
const { proofs, total, transactionId } = await cashu.receive(tokenString);
```

### Melting (Pay Lightning)
```typescript
// Get quote
const { quote, amount, fee } = await cashu.getMeltQuote(mintUrl, invoice);

// Pay invoice
const { isPaid, preimage, change } = await cashu.melt(mintUrl, invoice, proofIds);
```

---

## OCRManager

Manages offline cash reserve.

```typescript
import OCRManager from './src/core/ocr/OCRManager';
const ocr = OCRManager.getInstance();

// Get status
const status = ocr.getStatus();
// { status, currentBalance, targetBalance, percentOfTarget, needsRefill, alertLevel }

// Set configuration
await ocr.setConfig({ level: OCRLevel.HIGH, autoRefill: true });

// Sync OCR
const result = await ocr.syncOCR(mintUrl);
```

---

## SyncEngine

Orchestrates offline-first synchronization.

```typescript
import SyncEngine from './src/core/sync/SyncEngine';
const sync = SyncEngine.getInstance();

// Initialize (start network monitoring)
await sync.initialize();

// Manual sync
const result = await sync.syncNow();

// Get status
const status = sync.getStatus();
// { isSyncing, lastSync, networkState, canSync }
```

---

## TransportManager

Manages payment transports.

```typescript
import TransportManager from './src/core/transport/TransportInterface';
const transport = TransportManager.getInstance();

// Get available transports
const available = await transport.getAvailableTransports();

// Get best transport
const best = await transport.getBestTransport();

// Send via transport
const result = await best.send(tokenString);
```

---

## ProofRepository

Manages proof storage with state machine.

```typescript
import ProofRepository from './src/data/repositories/ProofRepository';
const proofRepo = ProofRepository.getInstance();

// Get balance
const balance = proofRepo.getBalance(mintUrl);
const ocrBalance = proofRepo.getOCRBalance();

// Get proofs
const proofs = await proofRepo.getAll({ mintUrl, state: ProofState.UNSPENT });

// Select proofs for spending
const { proofs, total, change } = await proofRepo.selectProofsForAmount(
  mintUrl, amount, transactionId, useOCR
);
```

---

## Types

### Proof
```typescript
interface Proof {
  id: string;
  secret: string;
  C: string;
  amount: number;
  mintUrl: string;
  keysetId: string;
  state: ProofState;
  isOCR: boolean;
  createdAt: number;
}

enum ProofState {
  UNSPENT = 'unspent',
  PENDING_SEND = 'pending_send',
  PENDING_SWAP = 'pending_swap',
  SPENT = 'spent',
  INVALID = 'invalid',
}
```

### OCR
```typescript
enum OCRLevel {
  LOW = 'low',      // 10,000 sats
  MEDIUM = 'medium', // 50,000 sats
  HIGH = 'high',    // 100,000 sats
}

enum OCRStatus {
  SYNCED = 'synced',
  OFFLINE_READY = 'offline_ready',
  OUT_OF_SYNC = 'out_of_sync',
  DEPLETED = 'depleted',
}
```

### Transport
```typescript
enum TransportType {
  NFC = 'nfc',
  BLUETOOTH = 'bluetooth',
  QR_CODE = 'qr_code',
}
```
