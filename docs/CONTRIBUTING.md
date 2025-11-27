# Contributing Guide

## Getting Started

### Prerequisites
- Node.js 18+
- Xcode 14.3+ (iOS)
- Android Studio Electric Eel+ (Android)
- CocoaPods 1.12+ (iOS)

### Setup
```bash
git clone https://github.com/your-org/cashu-wallet.git
cd cashu-wallet
npm install

# iOS
cd ios && pod install && cd ..

# Run
npx react-native run-ios
npx react-native run-android
```

## Code Organization

```
src/
├── app/          # UI layer (screens, components, navigation)
├── core/         # Business logic (cashu, ocr, sync, transport)
├── data/         # Data layer (repositories, database, secure storage)
├── types/        # TypeScript type definitions
└── utils/        # Shared utilities
```

## Development Guidelines

### TypeScript
- Strict mode enabled
- All functions must have return types
- No `any` types (use `unknown` if needed)

### Comments
This codebase has extensive inline documentation. Please:
- Add JSDoc comments to all public methods
- Explain complex logic inline
- Document security implications

### Code Style
```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
npm run format      # Format with Prettier
```

### Testing
```bash
npm test                    # Run all tests
npm test -- --coverage      # With coverage
npm test -- Button.test.tsx # Single file
```

## Pull Request Process

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes with clear commits
3. Run tests: `npm test`
4. Run lint: `npm run lint`
5. Create PR with description

### Commit Convention
```
feat: add NFC payment support
fix: resolve offline sync issue
docs: update architecture docs
test: add OCR tests
refactor: simplify proof manager
```

## Key Areas for Contribution

### High Priority
- [ ] E2E tests with Detox
- [ ] Additional transport implementations
- [ ] Multi-currency support
- [ ] Backup/restore functionality

### Good First Issues
- Improve error messages
- Add accessibility labels
- Expand test coverage
- Documentation improvements

## Questions?
- Open an issue on GitHub
- Join [Cashu Discord](https://discord.gg/cashu)

## Security
Report vulnerabilities privately. See security policy.
