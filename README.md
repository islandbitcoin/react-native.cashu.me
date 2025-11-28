# Cashu Wallet

A React Native mobile wallet implementing the [Cashu ecash protocol](https://github.com/cashubtc/nuts) with **offline-first architecture**.

########################  NUTNOVEMBER 2025 ########################

This repo was made specifically for the #NutNovember Cashu hackathon challenge.

######################## ----------------- ########################

## Key Features

- **Offline Payments** - Send/receive Bitcoin without internet via Offline Cash Reserve (OCR)
- **Multi-Transport** - NFC tap-to-pay, Bluetooth, and QR codes
- **Privacy** - Chaumian blind signatures prevent payment tracking
- **Multi-Mint** - Support for multiple Cashu mints

## Quick Start

```bash
# Install dependencies
npm install

# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

**Requirements:** Node.js 18+, Xcode 14.3+ (iOS), Android Studio (Android)

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./docs/ARCHITECTURE.md) | System design & data flow |
| [API Reference](./docs/API.md) | Service & repository APIs |
| [Contributing](./docs/CONTRIBUTING.md) | Development setup & guidelines |
| [Deployment](./docs/DEPLOYMENT.md) | Build & release instructions |

## Project Structure

```
src/
├── app/        # UI (screens, components, navigation)
├── core/       # Business logic (cashu, ocr, sync, transport)
├── data/       # Storage (repositories, database, secure)
└── types/      # TypeScript definitions
```

## Tech Stack

- React Native 0.82 + TypeScript
- @cashu/cashu-ts (Cashu protocol)
- SQLite (react-native-quick-sqlite)
- Secure storage (react-native-keychain)

## License

MIT - See [LICENSE](./LICENSE)

## Links

- [Cashu Protocol](https://github.com/cashubtc/nuts)
- [cashu-ts Library](https://github.com/cashubtc/cashu-ts)
- [Report Issues](https://github.com/your-org/cashu-wallet/issues)
