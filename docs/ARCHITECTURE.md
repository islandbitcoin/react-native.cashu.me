# Architecture Overview

## System Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION LAYER                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │   Screens   │ │ Components  │ │  Navigation │ │  Providers  │       │
│  │ (Home,Send, │ │ (Button,    │ │ (Tab-based, │ │ (Network,   │       │
│  │  Receive)   │ │  Input,OCR) │ │   Stacks)   │ │  Offline)   │       │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘       │
│         └────────────────┼──────────────┴────────────────┘              │
│                          │                                              │
├──────────────────────────┼──────────────────────────────────────────────┤
│                     CORE BUSINESS LOGIC                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │      CASHU      │  │       OCR       │  │    TRANSPORT    │        │
│  │ WalletService   │  │    Manager      │  │ NFC/BLE/QR      │        │
│  │ ProofValidator  │  │ Auto-Refill     │  │ Manager         │        │
│  │ MintDiscovery   │  │ Status Tracking │  │ Interface       │        │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘        │
│           │                    │                    │                   │
│  ┌────────┴────────┐  ┌────────┴────────┐                              │
│  │      SYNC       │  │     NETWORK     │                              │
│  │ SyncEngine      │  │ StateProvider   │                              │
│  │ OperationQueue  │  │ OfflineMode     │                              │
│  │ ConflictResolve │  │ Manager         │                              │
│  └────────┬────────┘  └────────┬────────┘                              │
│           └──────────────┬─────┴───────────────────────────────────────┤
│                          │                                              │
├──────────────────────────┼──────────────────────────────────────────────┤
│                       DATA LAYER                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │   Repositories  │  │    Database     │  │  SecureStorage  │        │
│  │ Proof/Mint/Tx   │  │ SQLite (Quick)  │  │ Keychain/Store  │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                        ┌─────────────────┐
                        │   Cashu Mint    │ (External Server)
                        │   (Lightning)   │
                        └─────────────────┘
```

## Core Concepts

### 1. Cashu Protocol
Cashu is a Chaumian ecash protocol for Bitcoin:
- **Proofs**: Bearer tokens representing satoshis
- **Mints**: Servers that issue/redeem ecash
- **Blind Signatures**: Privacy-preserving cryptography

### 2. Offline Cash Reserve (OCR)
The killer feature - automatic offline payment capability:
- Maintains configurable reserve (10k/50k/100k sats)
- Auto-refills when online
- Uses dedicated proofs for offline spending

### 3. Multi-Transport
Flexible payment delivery:
- **NFC**: Tap-to-pay (~200ms)
- **Bluetooth**: Medium-range transfers
- **QR**: Universal fallback

### 4. Offline-First Sync
Seamless online/offline transitions:
- Operation queue for failed requests
- Conflict resolution strategies
- Automatic reconciliation

## Data Flow

```
User Action → Screen → Service → Repository → Database
                 ↓
            Transport → Recipient
                 ↓
         Mint Verification
                 ↓
            State Update
```

## Key Files

| File | Purpose |
|------|---------|
| `CashuWalletService.ts` | Main Cashu operations |
| `OCRManager.ts` | Offline cash reserve |
| `SyncEngine.ts` | State synchronization |
| `ProofRepository.ts` | Proof storage & state machine |
| `TransportInterface.ts` | Payment transport abstraction |

## Security Model

```
┌───────────────────────────────────────────────────┐
│ Layer 1: Secure Enclave / StrongBox (Master Key) │
├───────────────────────────────────────────────────┤
│ Layer 2: Keychain / Keystore (Seed, Keys)        │
├───────────────────────────────────────────────────┤
│ Layer 3: SQLite Encrypted (Proofs, Transactions) │
└───────────────────────────────────────────────────┘
```

See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for detailed file organization.
