/**
 * Cashu Wallet - Offline-First Bitcoin Wallet
 *
 * Main application entry point.
 * Initializes all systems and provides global context.
 *
 * Architecture:
 * - ErrorBoundary: Catch and handle crashes gracefully
 * - NetworkProvider: Global network state management
 * - OfflineModeProvider: Global offline mode management
 * - RootNavigator: Navigation structure (tabs + stacks)
 *
 * Features:
 * - Offline-first architecture with automatic sync
 * - OCR (Offline Cash Reserve) for offline payments
 * - Multi-transport support (NFC, Bluetooth, QR)
 * - Multi-mint support with trust levels
 * - State reconciliation and conflict resolution
 * - Automatic operation queue with retry logic
 *
 * @format
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { ErrorBoundary } from './src/app/components/ErrorBoundary';
import { NetworkProvider } from './src/app/providers/NetworkProvider';
import { OfflineModeProvider } from './src/app/providers/OfflineModeProvider';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { theme } from './src/app/theme';

/**
 * App Component
 *
 * Wraps the entire app with providers and error handling.
 */
function App() {
  return (
    <ErrorBoundary>
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.colors.background.primary}
      />

      <NetworkProvider>
        <OfflineModeProvider>
          <RootNavigator />
        </OfflineModeProvider>
      </NetworkProvider>
    </ErrorBoundary>
  );
}

export default App;
