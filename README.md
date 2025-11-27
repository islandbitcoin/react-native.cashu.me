# Cashu Wallet - Offline-First Bitcoin Wallet

A production-ready React Native mobile wallet implementing the Cashu ecash protocol with offline-first architecture, multi-transport support, and automatic state synchronization.

## Overview

Cashu Wallet enables offline Bitcoin payments through ecash tokens backed by Lightning Network. The wallet maintains an Offline Cash Reserve (OCR) for sending payments without network connectivity, and supports multiple transport methods including NFC, Bluetooth, and QR codes.

### Key Features

- **Offline-First**: Send and receive payments without internet connectivity
- **OCR System**: Automatic offline cash reserve with configurable targets
- **Multi-Transport**: NFC, Bluetooth Low Energy, QR codes
- **Multi-Mint**: Support for multiple Cashu mints with trust levels
- **State Reconciliation**: Automatic conflict resolution and sync
- **Security**: Encrypted storage, secure key management, no trust required
- **Modern UX**: Dark theme, smooth animations, intuitive interface

### Architecture Highlights

- React Native 0.82 with TypeScript
- Offline-first data layer with SQLite
- Operation queue with automatic retry
- Event-driven state management
- Modular transport system
- Comprehensive error handling

---

## Quick Start

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+ or yarn 1.22+
- Xcode 14.3+ (for iOS development on macOS)
- Android Studio Electric Eel+ (for Android development)
- CocoaPods 1.12+ (for iOS dependencies)

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/cashu-wallet.git
cd cashu-wallet

# Install dependencies
npm install

# iOS: Install CocoaPods dependencies
cd ios
pod install
cd ..

# Android: No additional steps needed
```

### Running the App

**iOS**:
```bash
npx react-native run-ios
```

**Android**:
```bash
npx react-native run-android
```

**With specific configuration**:
```bash
# iOS Release build
npx react-native run-ios --configuration Release

# Android Release build
npx react-native run-android --variant=release
```

---

## Project Structure

```
CashuWallet/
├── src/
│   ├── app/                    # Application layer (UI, navigation)
│   │   ├── components/         # Reusable UI components
│   │   ├── screens/            # Screen components
│   │   ├── navigation/         # Navigation structure
│   │   ├── providers/          # React Context providers
│   │   └── theme/              # Design system (colors, typography, spacing)
│   │
│   ├── core/                   # Core business logic
│   │   ├── cashu/              # Cashu protocol implementation
│   │   ├── crypto/             # Cryptographic utilities
│   │   ├── network/            # Network state management
│   │   ├── ocr/                # Offline Cash Reserve system
│   │   ├── sync/               # State synchronization
│   │   └── transport/          # Multi-transport (NFC, BLE, QR)
│   │
│   ├── data/                   # Data layer
│   │   ├── database/           # SQLite database
│   │   ├── repositories/       # Data access patterns
│   │   └── secure/             # Secure storage
│   │
│   └── features/               # Feature modules (future)
│
├── android/                    # Android native code
├── ios/                        # iOS native code
├── docs/                       # Documentation
└── __tests__/                  # Tests
```

---

## Architecture

### Layered Architecture

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│   (UI, Navigation, Providers)           │
├─────────────────────────────────────────┤
│         Core Business Logic             │
│  (Cashu, OCR, Sync, Network, Transport) │
├─────────────────────────────────────────┤
│         Data Layer                      │
│   (Database, Repositories, Storage)     │
├─────────────────────────────────────────┤
│         Platform Layer                  │
│     (React Native, Native Modules)      │
└─────────────────────────────────────────┘
```

### Key Systems

#### 1. Cashu Protocol (`src/core/cashu/`)

Implements the Cashu ecash protocol for Bitcoin payments:

- **CashuClient**: Mint communication and token operations
- **ProofManager**: Proof lifecycle management
- **TokenManager**: Token generation and validation
- **MintManager**: Multi-mint support with trust levels

**Key concepts**:
- Proofs = ecash tokens (bearer assets)
- Mints = trusted servers that back proofs with Lightning
- Tokens = encoded proofs for sharing

#### 2. Offline Cash Reserve (`src/core/ocr/`)

Automatic system for maintaining offline payment capability:

- **OCRManager**: Core OCR logic
- **Auto-allocation**: Converts wallet balance to offline-ready proofs
- **Target management**: User-configurable OCR targets
- **Status tracking**: Synced, low, depleted states

**How it works**:
```
1. User sets OCR target (e.g., 50,000 sats)
2. When online, system swaps regular proofs for OCR proofs
3. OCR proofs stored separately, ready for offline use
4. During offline send, OCR balance is used
5. Upon reconnect, system reconciles and refills OCR
```

#### 3. Multi-Transport System (`src/core/transport/`)

Pluggable transport layer for offline payments:

- **NFCTransport**: Near-field communication
- **BLETransport**: Bluetooth Low Energy
- **QRTransport**: QR code scanning/display
- **TransportManager**: Unified interface

**Transport selection**:
- QR: Always available (fallback)
- NFC: Fast, tap-to-pay (iOS/Android)
- BLE: Medium range, background support

#### 4. State Synchronization (`src/core/sync/`)

Handles online/offline state reconciliation:

- **StateReconciliationEngine**: Conflict resolution
- **OperationQueue**: Retry failed operations
- **ConflictResolver**: Merge strategies
- **SyncCoordinator**: Orchestrates sync process

**Sync strategies**:
- Last-write-wins (timestamps)
- Proof verification (check with mint)
- User confirmation (for conflicts)

#### 5. Network Management (`src/core/network/`)

Monitors and adapts to network conditions:

- **NetworkStateProvider**: Real-time network status
- **Connection quality tracking**: Good, poor, offline
- **Reachability testing**: Ping mint servers
- **Event system**: React to network changes

---

## Development Guide

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- Button.test.tsx

# Watch mode
npm test -- --watch
```

### Code Style

We use ESLint and Prettier for consistent code style:

```bash
# Lint code
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix

# Format code
npm run format
```

### TypeScript

This project uses strict TypeScript:

```bash
# Type check
npm run type-check

# Type check in watch mode
npm run type-check -- --watch
```

### Debugging

**React Native Debugger**:
```bash
# Install React Native Debugger
brew install --cask react-native-debugger

# Enable debug mode
# iOS: Cmd+D in simulator
# Android: Cmd+M in emulator
```

**Flipper**:
```bash
# Flipper is pre-configured for:
# - React DevTools
# - Network inspector
# - Database viewer
# - Layout inspector
```

**Console Logs**:
```bash
# View Metro bundler logs
npm start

# View native logs (iOS)
npx react-native log-ios

# View native logs (Android)
npx react-native log-android
```

---

## Configuration

### Environment Variables

Create a `.env` file:

```bash
# Environment
ENV=development

# API Configuration
API_TIMEOUT=10000
DEFAULT_MINT_URL=https://testnut.cashu.space

# Features
ENABLE_LOGGING=true
ENABLE_CRASHLYTICS=false
ENABLE_ANALYTICS=false

# OCR Settings
DEFAULT_OCR_TARGET=50000
OCR_AUTO_ALLOCATION=true
```

---

## Testing

### Test Structure

```
__tests__/
├── unit/                       # Unit tests
│   ├── components/             # Component tests
│   ├── core/                   # Core logic tests
│   └── utils/                  # Utility tests
│
├── integration/                # Integration tests
│   ├── cashu/                  # Cashu protocol tests
│   ├── ocr/                    # OCR system tests
│   └── sync/                   # Sync tests
│
└── e2e/                        # End-to-end tests
    ├── flows/                  # User flow tests
    └── scenarios/              # Complete scenarios
```

### Coverage Targets

- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

**Quick deployment commands**:

```bash
# iOS
cd ios
xcodebuild archive -workspace CashuWallet.xcworkspace -scheme CashuWallet

# Android
cd android
./gradlew bundleRelease
```

---

## Security

### Threat Model

This wallet handles real Bitcoin value. Security priorities:

1. **Private key protection**: Keys stored in secure enclave
2. **Proof management**: Proofs treated as bearer assets
3. **Network security**: TLS for all mint communication
4. **State integrity**: Cryptographic verification of proofs
5. **Offline security**: OCR proofs protected at rest

### Vulnerability Reporting

Report security issues privately to: security@cashuwallet.com

---

## Troubleshooting

### Common Issues

**"Unable to resolve module" error**:
```bash
# Clear Metro cache
npm start -- --reset-cache

# Reinstall dependencies
rm -rf node_modules
npm install
```

**"Command PhaseScriptExecution failed" (iOS)**:
```bash
# Clean and rebuild
cd ios
rm -rf build Pods
pod install
cd ..
npx react-native run-ios
```

**"Execution failed for task" (Android)**:
```bash
# Clean Android build
cd android
./gradlew clean
./gradlew assembleDebug
```

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add NFC payment support
fix: resolve offline sync issue
docs: update README
test: add OCR tests
refactor: simplify proof manager
```

---

## Roadmap

### Phase 1-5: Core Development (Complete)
- [x] Cashu protocol integration
- [x] Offline Cash Reserve system
- [x] Multi-transport support (NFC, BLE, QR)
- [x] UI/UX implementation
- [x] Testing & polish

### Phase 6: Production (In Progress)
- [x] Deployment documentation
- [x] App Store preparation
- [ ] Beta testing
- [ ] Public launch

### Future Features
- [ ] Multi-currency support
- [ ] Contact book
- [ ] Payment requests
- [ ] Backup/restore
- [ ] Hardware wallet support
- [ ] Lightning integration
- [ ] Privacy features

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## Support

- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/cashu-wallet/issues)
- **Discord**: [Cashu Discord](https://discord.gg/cashu)
- **Email**: support@cashuwallet.com

---

## Acknowledgments

- [Cashu Protocol](https://github.com/cashubtc) - Chaumian ecash for Bitcoin
- [@cashu/cashu-ts](https://github.com/cashubtc/cashu-ts) - JavaScript Cashu library
- [React Native](https://reactnative.dev) - Mobile app framework
- Bitcoin & Lightning Network communities

---

## Project Status

**Current Version**: 1.0.0
**Status**: Production Ready
**Last Updated**: 2025-11-27

Built with TypeScript, React Native, and Bitcoin.
