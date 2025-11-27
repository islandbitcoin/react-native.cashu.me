/**
 * Placeholder Screens
 *
 * Stub implementations for all Phase 7 screens.
 * These can be split into individual files and enhanced later.
 *
 * Each screen follows the standard pattern:
 * - Uses theme
 * - Has proper navigation
 * - Shows screen name
 * - Can be enhanced with actual functionality
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

// Base placeholder component
function PlaceholderScreen({ title, description }: { title: string; description?: string }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.title}>{title}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
        <Text style={styles.note}>
          This screen is a placeholder and will be implemented with full functionality.
        </Text>
      </Card>
    </ScrollView>
  );
}

// Home screens
export function ProofDetailsScreen() {
  return <PlaceholderScreen title="Proof Details" description="View detailed proof information" />;
}

// Send screens
export function SendMainScreen() {
  return <PlaceholderScreen title="Send Payment" description="Select mint and initiate send" />;
}

export function SendConfirmScreen() {
  return <PlaceholderScreen title="Confirm Send" description="Confirm payment details" />;
}

export function SendTransportScreen() {
  return <PlaceholderScreen title="Select Transport" description="Choose NFC, Bluetooth, or QR" />;
}

export function SendSuccessScreen() {
  return <PlaceholderScreen title="Payment Sent!" description="Transaction completed successfully" />;
}

// Receive screens
export function ReceiveMainScreen() {
  return <PlaceholderScreen title="Receive Payment" description="Generate payment request" />;
}

export function ReceiveAmountScreen() {
  return <PlaceholderScreen title="Enter Amount" description="Specify amount to receive" />;
}

export function ReceiveQRScreen() {
  return <PlaceholderScreen title="Show QR Code" description="Display payment QR code" />;
}

export function ReceiveSuccessScreen() {
  return <PlaceholderScreen title="Payment Received!" description="Tokens received successfully" />;
}

// Scan screens
export function ScanMainScreen() {
  return <PlaceholderScreen title="Scan QR Code" description="Camera scanner" />;
}

export function ScanResultScreen() {
  return <PlaceholderScreen title="Scan Result" description="Process scanned data" />;
}

// History screens
export function HistoryMainScreen() {
  return <PlaceholderScreen title="Transaction History" description="All transactions" />;
}

export function HistoryFilterScreen() {
  return <PlaceholderScreen title="Filter Transactions" description="Filter by type, date, mint" />;
}

export function TransactionDetailsScreen() {
  return <PlaceholderScreen title="Transaction Details" description="Detailed transaction info" />;
}

// Settings screens
export function SettingsMainScreen() {
  return <PlaceholderScreen title="Settings" description="Wallet configuration" />;
}

export function OCRConfigurationScreen() {
  return <PlaceholderScreen title="Offline Cash Reserve" description="Configure OCR settings" />;
}

export function MintManagementScreen() {
  return <PlaceholderScreen title="Manage Mints" description="View and manage mints" />;
}

export function MintAddScreen() {
  return <PlaceholderScreen title="Add Mint" description="Add new mint by URL or QR" />;
}

export function MintDetailsScreen() {
  return <PlaceholderScreen title="Mint Details" description="Mint information and settings" />;
}

export function TransportSelectionScreen() {
  return <PlaceholderScreen title="Payment Transports" description="Configure NFC, Bluetooth, QR" />;
}

export function BackupRecoveryScreen() {
  return <PlaceholderScreen title="Backup & Recovery" description="Export and import wallet" />;
}

export function BackupExportScreen() {
  return <PlaceholderScreen title="Export Backup" description="Create encrypted backup" />;
}

export function BackupImportScreen() {
  return <PlaceholderScreen title="Import Backup" description="Restore from backup" />;
}

export function SecurityScreen() {
  return <PlaceholderScreen title="Security" description="Security and privacy settings" />;
}

export function AboutScreen() {
  return <PlaceholderScreen title="About" description="App information and version" />;
}

// Onboarding screens
export function OnboardingScreen() {
  return <PlaceholderScreen title="Welcome to Cashu Wallet" description="Offline-first Bitcoin wallet" />;
}

export function CreateWalletScreen() {
  return <PlaceholderScreen title="Create Wallet" description="Generate new wallet" />;
}

export function ImportWalletScreen() {
  return <PlaceholderScreen title="Import Wallet" description="Restore from seed or backup" />;
}

// OCR Alert modal
export function OCRAlertScreen() {
  return <PlaceholderScreen title="OCR Alert" description="Offline Cash Reserve needs attention" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },

  content: {
    padding: theme.screenPadding.horizontal,
    paddingTop: theme.spacing.xl,
  },

  title: {
    ...theme.typography.h1,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },

  description: {
    ...theme.typography.bodyLarge,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },

  note: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
