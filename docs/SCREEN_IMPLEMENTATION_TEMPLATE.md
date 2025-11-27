# Screen Implementation Templates

This document provides templates and structure for all Phase 7 screens.

## Completed Screens

### 1. HomeScreen.tsx ✅
**Location**: `src/app/screens/Home/HomeScreen.tsx`
**Features**:
- Total balance display
- OCR status indicator
- Recent transactions list
- Quick Send/Receive buttons
- Pull-to-refresh

### 2. SendAmountScreen.tsx ✅
**Location**: `src/app/screens/Send/SendAmountScreen.tsx`
**Features**:
- AmountInput component with sats/USD conversion
- Available balance display
- Quick amount buttons
- Max button
- Validation

## Screen Templates (To Implement)

### Send Flow Screens

#### SendMainScreen.tsx
```typescript
/**
 * Send Main Screen
 * Entry point for send flow - select mint and initiate send
 */
- Mint selector dropdown
- Available balance per mint
- Continue to amount screen
```

#### SendConfirmScreen.tsx
```typescript
/**
 * Send Confirm Screen
 * Confirm send details before executing
 */
- Amount confirmation
- Selected mint
- Fee display (if any)
- Confirm button
- Navigate to transport selection
```

#### SendTransportScreen.tsx
```typescript
/**
 * Send Transport Screen
 * Choose transport method (NFC, Bluetooth, QR)
 */
- Transport options (NFC, BT, QR)
- Availability indicators
- Transport icons with status
- Execute send with selected transport
- Navigate to success screen
```

#### SendSuccessScreen.tsx
```typescript
/**
 * Send Success Screen
 * Success confirmation with transaction details
 */
- Success checkmark animation
- Amount sent
- Transaction ID
- Done button (navigate home)
```

### Receive Flow Screens

#### ReceiveMainScreen.tsx
```typescript
/**
 * Receive Main Screen
 * Entry point for receive flow
 */
- Quick receive (generate QR for any amount)
- Request specific amount button
```

#### ReceiveAmountScreen.tsx
```typescript
/**
 * Receive Amount Screen
 * Enter amount to request
 */
- Similar to SendAmountScreen
- AmountInput component
- Generate QR with amount
```

#### ReceiveQRScreen.tsx
```typescript
/**
 * Receive QR Screen
 * Display QR code for payment request
 */
- Large QR code display
- Amount (if specified)
- Payment request string
- Copy button
- Share button
- Listen for payment (via transports)
```

#### ReceiveSuccessScreen.tsx
```typescript
/**
 * Receive Success Screen
 * Success confirmation
 */
- Success animation
- Amount received
- From mint
- Done button
```

### Scan Flow Screens

#### ScanMainScreen.tsx
```typescript
/**
 * Scan Main Screen
 * Camera view for QR scanning
 */
- Full-screen camera
- QR code scanner
- Torch toggle
- Manual entry button
- Parse scanned data (token, payment request, mint URL)
- Navigate to result screen
```

#### ScanResultScreen.tsx
```typescript
/**
 * Scan Result Screen
 * Display scan results and actions
 */
- Result type indicator (token/request/mint)
- Parsed data display
- Action buttons based on type:
  - Token: Receive/Redeem
  - Payment Request: Pay
  - Mint URL: Add Mint
```

### History Flow Screens

#### HistoryMainScreen.tsx
```typescript
/**
 * History Main Screen
 * Transaction history list
 */
- TransactionListItem for each transaction
- Filter button (top-right)
- Pull-to-refresh
- Infinite scroll / pagination
- Tap to view transaction details
```

#### HistoryFilterScreen.tsx
```typescript
/**
 * History Filter Screen (Modal)
 * Filter transactions by type, status, date, mint
 */
- Type filter (Send/Receive/Mint/Melt/Swap)
- Status filter (Pending/Completed/Failed)
- Date range picker
- Mint filter (dropdown)
- Apply/Reset buttons
```

#### TransactionDetailsScreen.tsx
```typescript
/**
 * Transaction Details Screen
 * Detailed view of single transaction
 */
- Transaction type & status
- Amount with +/-
- Timestamp
- Mint info
- Proof count
- Transaction ID (copyable)
- Proof IDs (expandable list)
```

#### ProofDetailsScreen.tsx
```typescript
/**
 * Proof Details Screen
 * Detailed view of single proof
 */
- Proof ID (copyable)
- Amount
- Keyset ID
- Mint URL
- State (UNSPENT/SPENT/PENDING)
- OCR flag
- Created/Updated timestamps
- Secret (blurred, reveal button)
- C value
```

### Settings Flow Screens

#### SettingsMainScreen.tsx
```typescript
/**
 * Settings Main Screen
 * Main settings menu
 */
- List of settings sections:
  - OCR Configuration
  - Manage Mints
  - Payment Transports
  - Backup & Recovery
  - Security
  - About
- Each row navigates to respective screen
```

#### OCRConfigurationScreen.tsx
```typescript
/**
 * OCR Configuration Screen
 * Configure Offline Cash Reserve
 */
- OCR status indicator
- Target level selector (Low 10k / Medium 50k / High 100k)
- Custom target input
- Auto-refill toggle
- Min refill threshold slider
- Sync now button
- OCR statistics (total allocated, last sync, etc.)
```

#### MintManagementScreen.tsx
```typescript
/**
 * Mint Management Screen
 * List of mints with management options
 */
- List of mints with:
  - Mint name
  - Balance at mint
  - Trust level indicator
  - Last synced time
- Add mint button
- Tap mint to view details
```

#### MintAddScreen.tsx
```typescript
/**
 * Mint Add Screen
 * Add new mint by URL or scan QR
 */
- Input for mint URL
- Scan QR button
- Trust level selector
- Discover button (fetch mint info)
- Add button
```

#### MintDetailsScreen.tsx
```typescript
/**
 * Mint Details Screen
 * Detailed mint information and actions
 */
- Mint name & URL
- Balance at this mint
- Trust level (editable)
- Public key
- Keysets count
- Last synced time
- Sync now button
- Set as default toggle
- Remove mint button (danger)
```

#### TransportSelectionScreen.tsx
```typescript
/**
 * Transport Selection Screen
 * Configure payment transport preferences
 */
- Transport availability:
  - NFC (check if supported)
  - Bluetooth (check permissions)
  - QR Code (always available)
- Preferred transport selector
- Enable/disable each transport
- Test transport buttons
```

#### BackupRecoveryScreen.tsx
```typescript
/**
 * Backup & Recovery Screen
 * Backup and restore wallet
 */
- Last backup time
- Export backup button
- Import backup button
- Mnemonic seed phrase (view/backup)
- Warning about secure storage
```

#### BackupExportScreen.tsx
```typescript
/**
 * Backup Export Screen
 * Export wallet backup
 */
- Password input (for encryption)
- Confirm password
- What's included:
  - Proofs
  - Mints
  - Transactions
  - Settings
- Export button (generates encrypted JSON)
- Share/Save options
```

#### BackupImportScreen.tsx
```typescript
/**
 * Backup Import Screen
 * Import wallet from backup
 */
- File picker / paste JSON
- Password input (for decryption)
- Preview what will be imported
- Warning about overwriting
- Import button
```

#### SecurityScreen.tsx
```typescript
/**
 * Security Screen
 * Security settings
 */
- Biometric auth toggle (Face ID / Touch ID)
- PIN code setup
- Auto-lock timeout
- Show balances toggle
- Clear cache button
```

#### AboutScreen.tsx
```typescript
/**
 * About Screen
 * App information
 */
- App name & version
- Build number
- License
- GitHub link
- Support email
- Privacy policy
- Terms of service
```

### Onboarding Screens

#### OnboardingScreen.tsx
```typescript
/**
 * Onboarding Screen
 * Initial app introduction
 */
- Welcome message
- Cashu explanation
- Feature highlights (offline payments, OCR, multi-transport)
- Get Started button → CreateWallet
```

#### CreateWalletScreen.tsx
```typescript
/**
 * Create Wallet Screen
 * Create new wallet
 */
- Generate mnemonic seed phrase
- Display 12/24 words
- Backup warning
- Confirm you've backed up checkbox
- Create button → Main app
```

#### ImportWalletScreen.tsx
```typescript
/**
 * Import Wallet Screen
 * Restore wallet from seed or backup
 */
- Mnemonic input (12/24 words)
- OR backup JSON import
- Restore button
- Validate mnemonic
- Import → Main app
```

### Modal Screens

#### OCRAlertScreen.tsx
```typescript
/**
 * OCR Alert Screen (Modal)
 * Alert when OCR is low/depleted
 */
- Warning icon
- OCR status (low/depleted)
- Current balance
- Recommended action (refill)
- Refill now button
- Dismiss button
```

## Common Patterns

### Screen Structure
```typescript
import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../../theme';

export function MyScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load data
  }, []);

  return (
    <ScrollView style={styles.container}>
      {/* Content */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
});
```

### Data Loading Pattern
```typescript
const [data, setData] = useState<any>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');

useEffect(() => {
  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch from repositories
      const result = await SomeRepository.getInstance().getData();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  loadData();
}, []);
```

### Navigation Pattern
```typescript
// Type-safe navigation
import { MyScreenNavigationProp, MyScreenRouteProp } from '../../navigation/types';

const navigation = useNavigation<MyScreenNavigationProp>();
const route = useRoute<MyScreenRouteProp>();

// Navigate with params
navigation.navigate('ScreenName', { param1: value1 });

// Go back
navigation.goBack();
```

## Implementation Priority

1. **High Priority** (Core flows):
   - Send flow (Main, Amount, Confirm, Transport, Success)
   - Receive flow (Main, Amount, QR, Success)
   - Scan flow (Main, Result)

2. **Medium Priority** (Essential features):
   - Transaction history (Main, Filter, Details)
   - OCR Configuration
   - Mint Management (Main, Add, Details)

3. **Low Priority** (Settings & Extras):
   - Settings (Main)
   - Transport Selection
   - Backup/Recovery
   - Security
   - About
   - Onboarding

## Testing Checklist

For each screen:
- [ ] Renders without errors
- [ ] Navigation works (back, forward, params)
- [ ] Data loading displays properly
- [ ] Error states handled
- [ ] Loading states shown
- [ ] Empty states handled
- [ ] Form validation (if applicable)
- [ ] Theme applied consistently
- [ ] Responsive to screen sizes
- [ ] Keyboard handling (for inputs)

---

**Note**: All screens follow the established patterns from HomeScreen and SendAmountScreen. Implement remaining screens using these templates as reference.
