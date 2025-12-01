# Cashu Wallet - Development Roadmap

**Version Target:** 1.0.0
**Last Updated:** December 2024
**Status:** Alpha Development

---

## Current Progress Overview

### Test Coverage
- **133 tests passing** across 8 test suites
- Core wallet service, mint discovery, parsing, UI components covered

### Build Status
- iOS: Building and running
- Android: Building and running (network config fixed)

---

## Implemented Features

### Core Wallet (100% Complete)
| Feature | File | Status |
|---------|------|--------|
| Token minting (Lightning → ecash) | `src/core/cashu/CashuWalletService.ts` | Done |
| Token sending | `src/core/cashu/CashuWalletService.ts` | Done |
| Token receiving | `src/core/cashu/CashuWalletService.ts` | Done |
| Token encoding/decoding | `src/core/cashu/CashuWalletService.ts` | Done |
| Proof validation (DLEQ) | `src/core/cashu/ProofValidator.ts` | Done |
| Multi-mint support | `src/core/cashu/CashuWalletService.ts` | Done |
| Lightning melt (ecash → Lightning) | `src/core/cashu/CashuWalletService.ts` | Done |

### Mint Management (100% Complete)
| Feature | File | Status |
|---------|------|--------|
| Mint discovery | `src/core/cashu/MintDiscovery.ts` | Done |
| Keyset synchronization | `src/core/cashu/MintDiscovery.ts` | Done |
| Trust level management | `src/core/cashu/MintDiscovery.ts` | Done |
| Curated mint directory | `src/core/cashu/MintDirectory.ts` | Done |
| Health checking | `src/core/cashu/MintDiscovery.ts` | Done |

### OCR - Offline Cash Reserve (100% Complete)
| Feature | File | Status |
|---------|------|--------|
| Pre-allocated proof pool | `src/core/ocr/OCRManager.ts` | Done |
| Configurable levels (10k/50k/100k sats) | `src/core/ocr/OCRManager.ts` | Done |
| Offline spending | `src/core/ocr/OCRManager.ts` | Done |
| Auto-refill when online | `src/core/ocr/OCRManager.ts` | Done |
| Status monitoring | `src/core/ocr/OCRManager.ts` | Done |

### Sync Engine (100% Complete)
| Feature | File | Status |
|---------|------|--------|
| Network state monitoring | `src/core/sync/SyncEngine.ts` | Done |
| Priority-based sync | `src/core/sync/SyncEngine.ts` | Done |
| Operation queue | `src/core/sync/OperationQueue.ts` | Done |
| Conflict resolution | `src/core/sync/ConflictResolver.ts` | Done |
| State reconciliation | `src/core/sync/StateReconciliation.ts` | Done |

### Transport Layers (100% Complete)
| Feature | File | Status |
|---------|------|--------|
| QR code (static + animated) | `src/core/transport/QRTransport.ts` | Done |
| NFC (HCE + tag reading) | `src/core/transport/NFCTransport.ts` | Done |
| Bluetooth LE | `src/core/transport/BluetoothTransport.ts` | Done |

### Data Layer (100% Complete)
| Feature | File | Status |
|---------|------|--------|
| SQLite database (WAL mode) | `src/data/database/Database.ts` | Done |
| Proof repository | `src/data/repositories/ProofRepository.ts` | Done |
| Transaction repository | `src/data/repositories/TransactionRepository.ts` | Done |
| Mint repository | `src/data/repositories/MintRepository.ts` | Done |
| Secure storage | `src/data/secure/SecureStorage.ts` | Done |

### UI Screens (80% Complete)
| Screen | File | Status |
|--------|------|--------|
| Home (balance, recent tx) | `src/app/screens/Home/HomeScreen.tsx` | Done |
| Send flow | `src/app/screens/Send/SendScreen.tsx` | Partial |
| Receive flow | `src/app/screens/Receive/ReceiveScreen.tsx` | Partial |
| QR Scanner | `src/app/screens/Scan/ScanScreen.tsx` | Done |
| Transaction history | `src/app/screens/History/HistoryScreen.tsx` | Done |
| Mint management | `src/app/screens/Mints/MintManagementScreen.tsx` | Done |
| Mint discovery | `src/app/screens/Mints/MintDiscoveryScreen.tsx` | Done |
| Add custom mint | `src/app/screens/Mints/MintAddScreen.tsx` | Done |
| OCR configuration | `src/app/screens/OCR/OCRConfigurationScreen.tsx` | Done |
| Settings | `src/app/screens/Settings/SettingsScreen.tsx` | Done |
| Security settings | `src/app/screens/Settings/SecurityScreen.tsx` | Partial |
| Backup/recovery | `src/app/screens/Settings/BackupRecoveryScreen.tsx` | Skeleton |
| Onboarding | `src/app/screens/Onboarding/*.tsx` | Skeleton |

---

## Remaining Work for v1.0.0

### P0 - Critical (Must Have)

#### Security & Authentication
- [ ] **PIN code enforcement** - Require PIN for sends over threshold
- [ ] **Biometric authentication** - Face ID / fingerprint unlock
- [ ] **Auto-lock timeout** - Lock wallet after inactivity
- [ ] **Wallet encryption** - Encrypt backup data
- [ ] **Input validation** - Sanitize all user inputs

#### Wallet Creation & Recovery
- [ ] **Create wallet flow** - Generate new wallet with seed
- [ ] **Import wallet flow** - Restore from backup
- [ ] **Backup export** - Export wallet data securely
- [ ] **Recovery verification** - Test recovery before confirming

#### Error Handling
- [ ] **Network error recovery** - Retry logic with user feedback
- [ ] **Mint rejection handling** - Clear error messages
- [ ] **Transaction failure recovery** - Rollback and retry options
- [ ] **Crash reporting** - Sentry/Bugsnag integration

### P1 - High Priority

#### Send Flow Improvements
- [ ] **Amount validation** - Min/max limits, balance checks
- [ ] **Fee estimation** - Show Lightning fees before melt
- [ ] **Confirmation screen** - Review before sending
- [ ] **Payment receipts** - Shareable transaction proof

#### Receive Flow Improvements
- [ ] **Invoice expiry handling** - Timer and refresh option
- [ ] **Payment confirmation** - Success animation and details
- [ ] **Amount presets** - Quick amount selection

#### Transaction Management
- [ ] **Transaction details screen** - Full transaction info
- [ ] **Transaction filtering** - By date, type, mint, status
- [ ] **Transaction search** - Find specific transactions
- [ ] **Export transactions** - CSV/JSON export

#### UX Polish
- [ ] **Loading states** - Skeleton screens, spinners
- [ ] **Success/error animations** - Lottie animations
- [ ] **Haptic feedback** - Touch feedback on actions
- [ ] **Pull-to-refresh** - On all list screens

### P2 - Medium Priority

#### Advanced Features
- [ ] **Contact list** - Save frequently used npubs
- [ ] **Payment requests** - Generate shareable requests
- [ ] **Recurring payments** - Scheduled sends
- [ ] **Spending limits** - Daily/weekly limits

#### Accessibility
- [ ] **VoiceOver support** - iOS screen reader
- [ ] **TalkBack support** - Android screen reader
- [ ] **Dynamic type** - Respect system font size
- [ ] **High contrast mode** - For visibility

#### Localization
- [ ] **i18n framework** - react-native-i18n setup
- [ ] **English (default)** - Complete all strings
- [ ] **Spanish** - Translation
- [ ] **Portuguese** - Translation

### P3 - Nice to Have

#### Analytics & Monitoring
- [ ] **Usage analytics** - Privacy-respecting telemetry
- [ ] **Performance monitoring** - Track slow operations
- [ ] **A/B testing** - Feature experimentation

#### Additional Features
- [ ] **Widget support** - iOS/Android home widgets
- [ ] **Watch app** - Apple Watch companion
- [ ] **Notifications** - Payment received alerts
- [ ] **Deep linking** - cashu:// URL handling

---

## Known Issues

### Bugs
1. ~~Navigation error after adding mint~~ - Fixed (uses goBack())
2. ~~"Mint unavailable" for all mints~~ - Fixed (network config)
3. Jest cache causing false test failures - Run with `--clearCache`

### Technical Debt
1. Some TODO comments need addressing (see below)
2. Mock data in onboarding screens
3. Hardcoded BLE service UUIDs
4. Limited error boundary coverage

---

## TODO Comments in Codebase

```
src/data/repositories/ProofRepository.ts:726
  TODO: Add signature validation checks

src/core/sync/SyncEngine.ts:2088
  TODO: Actual transaction retry logic

src/app/components/ErrorBoundary.tsx:71
  TODO: Log to error reporting service

src/app/screens/Onboarding/CreateWalletScreen.tsx:22
  TODO: Implement wallet creation

src/app/screens/Onboarding/ImportWalletScreen.tsx:31
  TODO: Implement wallet import

src/app/screens/OCR/OCRAlertScreen.tsx:47
  TODO: Implement OCR refill/sync
```

---

## Security Checklist

### Implemented
- [x] Secure storage (Keychain/Keystore)
- [x] Proof state locking (prevents double-spend)
- [x] DLEQ proof verification
- [x] Blind signature validation
- [x] Database WAL mode (transaction safety)
- [x] Foreign key constraints

### Not Implemented
- [ ] PIN code on sensitive operations
- [ ] Biometric fallback
- [ ] Certificate pinning for HTTPS
- [ ] Rate limiting on operations
- [ ] Secure clipboard handling
- [ ] Screenshot prevention

---

## Test Coverage Gaps

### Needs Tests
- [ ] End-to-end transaction flows
- [ ] Offline sync behavior
- [ ] Transport layers (QR, NFC, Bluetooth)
- [ ] OCR refill logic
- [ ] Conflict resolution scenarios
- [ ] Network state transitions
- [ ] Error recovery paths
- [ ] UI integration tests

---

## Dependencies

### Core
```json
{
  "@cashu/cashu-ts": "^2.5.3",
  "react-native": "0.82.1",
  "react-native-quick-sqlite": "^8.2.7",
  "react-native-keychain": "^10.0.0"
}
```

### Transport
```json
{
  "react-native-vision-camera": "^4.7.3",
  "react-native-nfc-manager": "^3.17.1",
  "react-native-ble-plx": "^3.5.0"
}
```

### Navigation
```json
{
  "@react-navigation/native": "^7.1.6",
  "@react-navigation/native-stack": "^7.3.10",
  "@react-navigation/bottom-tabs": "^7.3.10"
}
```

---

## Release Milestones

### Alpha (Current)
- Core wallet functionality working
- Basic UI complete
- 133 tests passing

### Beta
- Security features complete
- Wallet creation/recovery working
- Error handling polished
- 200+ tests passing

### RC (Release Candidate)
- All P0 and P1 items complete
- Performance optimized
- Accessibility compliant
- Localization ready

### v1.0.0 Production
- App store approved (iOS + Android)
- Security audit passed
- Documentation complete
- Support channels ready

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  Home   │ │  Send   │ │ Receive │ │ History │ ...       │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
└───────┼──────────┼──────────┼──────────┼───────────────────┘
        │          │          │          │
┌───────┴──────────┴──────────┴──────────┴───────────────────┐
│                     Service Layer                           │
│  ┌────────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │ CashuWallet    │ │ SyncEngine  │ │ MintDiscovery   │   │
│  │ Service        │ │             │ │                 │   │
│  └───────┬────────┘ └──────┬──────┘ └────────┬────────┘   │
│          │                 │                  │            │
│  ┌───────┴─────────────────┴──────────────────┴───────┐   │
│  │                   OCR Manager                       │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────┬───────────────────────────────┘
                             │
┌────────────────────────────┴───────────────────────────────┐
│                      Data Layer                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ ProofRepo    │ │ MintRepo     │ │ TxRepo       │       │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘       │
│         │                │                │                │
│  ┌──────┴────────────────┴────────────────┴───────┐       │
│  │              SQLite Database                    │       │
│  │  (WAL mode, indexed, foreign keys)             │       │
│  └─────────────────────────────────────────────────┘       │
│                                                             │
│  ┌─────────────────────────────────────────────────┐       │
│  │          Secure Storage (Keychain)              │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┴───────────────────────────────┐
│                    Transport Layer                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │    QR    │    │   NFC    │    │Bluetooth │             │
│  └──────────┘    └──────────┘    └──────────┘             │
└─────────────────────────────────────────────────────────────┘
```

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open Pull Request

---

## License

MIT License - see LICENSE file for details
