# Cashu Wallet - Project Structure

## Overview

This is an offline-first React Native Cashu wallet with bearer-asset security, Offline Cash Reserve (OCR), and multi-transport payment support.

## Architecture

```
CashuWallet/
├── src/
│   ├── app/                      # App entry, navigation, providers
│   │   ├── navigation/          # React Navigation configuration
│   │   └── providers/           # Context providers
│   │
│   ├── core/                     # Core business logic (platform-agnostic)
│   │   ├── cashu/                # Cashu protocol implementation
│   │   │   ├── CashuWallet.ts
│   │   │   ├── MintClient.ts
│   │   │   ├── ProofManager.ts
│   │   │   └── TokenCodec.ts
│   │   │
│   │   ├── crypto/               # Cryptographic operations
│   │   │   ├── keys.ts
│   │   │   ├── bdhke.ts          # Blind Diffie-Hellman Key Exchange
│   │   │   └── secrets.ts
│   │   │
│   │   ├── ocr/                  # Offline Cash Reserve
│   │   │   ├── OCRManager.ts
│   │   │   ├── OCRConfig.ts
│   │   │   └── AutoReplenish.ts
│   │   │
│   │   ├── transport/            # Multi-transport payment layer
│   │   │   ├── TransportManager.ts
│   │   │   ├── NFCTransport.ts
│   │   │   ├── BluetoothTransport.ts
│   │   │   ├── QRTransport.ts
│   │   │   └── types.ts
│   │   │
│   │   └── sync/                 # Offline sync engine
│   │       ├── SyncEngine.ts
│   │       ├── TransactionQueue.ts
│   │       └── ConflictResolver.ts
│   │
│   ├── data/                     # Data layer
│   │   ├── database/
│   │   │   ├── schema.ts
│   │   │   ├── migrations/
│   │   │   └── Database.ts
│   │   │
│   │   ├── repositories/
│   │   │   ├── ProofRepository.ts
│   │   │   ├── MintRepository.ts
│   │   │   └── TransactionRepository.ts
│   │   │
│   │   └── secure/               # Secure storage layer
│   │       ├── SecureStorage.ts
│   │       └── KeyManager.ts
│   │
│   ├── features/                 # Feature modules
│   │   ├── wallet/              # Home/Balance screen
│   │   ├── send/                # Send flow
│   │   ├── receive/             # Receive flow
│   │   ├── mints/               # Mint management
│   │   └── settings/            # Settings
│   │
│   ├── hooks/                    # Shared React hooks
│   │   ├── useOfflineStatus.ts
│   │   ├── useOCR.ts
│   │   ├── useWallet.ts
│   │   └── useSyncQueue.ts
│   │
│   ├── types/                    # TypeScript type definitions
│   │   └── index.ts
│   │
│   └── utils/                    # Utilities
│       ├── polyfills.ts
│       ├── logger.ts
│       └── formatters.ts
│
├── android/                      # Android native code
├── ios/                          # iOS native code
├── __tests__/                    # Tests
└── package.json
```

## Key Technologies

### Core
- **React Native 0.82** (bare workflow)
- **TypeScript 5.8**
- **React Navigation v6**

### Native Modules (JSI)
- **react-native-quick-crypto** - 80x faster crypto via JSI
- **react-native-quick-sqlite** - Synchronous SQLite via JSI
- **react-native-keychain** - Secure Enclave/StrongBox
- **rn-secure-keystore** - Hardware-backed keys

### Cashu & Crypto
- **@cashu/cashu-ts** - Cashu protocol
- **@noble/secp256k1** - Elliptic curve operations

### Storage & State
- **SQLite** - Local database (encrypted)
- **Zustand** - State management
- **@react-native-community/netinfo** - Network state

### Transport Layer
- **react-native-nfc-manager** - NFC tap-to-pay
- **react-native-ble-plx** - Bluetooth LE
- **react-native-vision-camera** - QR scanning
- **react-native-qrcode-svg** - QR generation

## Development Phases

### ✅ Phase 0: Project Initialization (Week 1)
- [x] Initialize React Native bare project
- [x] Install and configure native modules
- [x] Configure Metro bundler for crypto polyfills
- [x] Configure Babel for crypto aliasing
- [x] Set up project structure
- [x] Create initial configuration files

### 📋 Phase 1: Core Infrastructure (Weeks 2-3)
- [ ] KeyManager with hardware-backed storage
- [ ] Database setup with migrations
- [ ] Repository pattern implementation
- [ ] Secure storage wrapper

### 🎯 Phase 2: Cashu Integration (Weeks 4-5)
- [ ] CashuWallet class
- [ ] ProofManager with state machine
- [ ] Blind signature crypto (BDHKE)
- [ ] Send/Receive/Mint/Melt operations

### 💰 Phase 3: Offline Cash Reserve (Weeks 6-7)
- [ ] OCRManager implementation
- [ ] Auto-replenishment logic
- [ ] OCR state management
- [ ] Configuration UI

### 📡 Phase 4: Multi-Transport Layer (Weeks 8-9)
- [ ] TransportManager
- [ ] QR Transport (with animated QR)
- [ ] NFC Transport
- [ ] Bluetooth Transport

### 🔄 Phase 5: Offline-First Sync Engine (Week 10)
- [ ] SyncEngine core
- [ ] Transaction queue
- [ ] Double-spend detection
- [ ] Conflict resolution

### 🌐 Phase 6: Network State Management (Week 11)
- [ ] useOfflineStatus hook
- [ ] useWallet hook
- [ ] useSyncQueue hook

### 🎨 Phase 7: UI/UX Implementation (Weeks 12-13)
- [ ] Home screen with balance
- [ ] Send/Receive flows
- [ ] Transaction history
- [ ] Settings screens

### 🧪 Phase 8: Testing & Optimization (Week 14)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Performance optimization
- [ ] Device testing

### 🔒 Phase 9: Security Audit (Week 15)
- [ ] Security review
- [ ] Edge case handling
- [ ] Error recovery

### 🚀 Phase 10: Production Deployment (Week 16)
- [ ] Build configuration
- [ ] Documentation
- [ ] Beta testing
- [ ] App store submission

## Running the Project

```bash
# Install dependencies
npm install

# iOS
cd ios && pod install && cd ..
npm run ios

# Android
npm run android

# Start Metro bundler
npm start
```

## Key Features

1. **Offline Cash Reserve (OCR)** - Automatic offline balance maintenance
2. **Multi-Transport Payments** - NFC, QR, Bluetooth support
3. **Hardware Security** - Secure Enclave/StrongBox key storage
4. **Proof State Machine** - Double-spend prevention
5. **Automatic Sync** - Seamless online/offline transitions
6. **Bearer Asset Security** - Production-grade security for ecash

## Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Secure Enclave / StrongBox (Hardware)            │
│  ├── Master encryption key                                  │
│  └── Biometric binding                                      │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Keychain / Keystore (OS-Protected)               │
│  ├── Seed phrase (encrypted)                                │
│  ├── Derived signing keys                                   │
│  └── Mint authentication tokens                             │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: SQLite (Encrypted at rest)                        │
│  ├── Proofs/ecash tokens                                    │
│  ├── Transaction history                                    │
│  └── Mint keysets                                           │
└─────────────────────────────────────────────────────────────┘
```

## License

MIT
