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

import React, { useEffect, useState } from 'react';
import { StatusBar, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { ErrorBoundary } from './src/app/components/ErrorBoundary';
import { NetworkProvider } from './src/app/providers/NetworkProvider';
import { OfflineModeProvider } from './src/app/providers/OfflineModeProvider';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { theme } from './src/app/theme';
import Database from './src/data/database/Database';

/**
 * Loading Screen Component
 *
 * Displayed while app is initializing
 */
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary[500]} />
      <Text style={styles.loadingText}>Loading Wallet...</Text>
    </View>
  );
}

/**
 * App Component
 *
 * Wraps the entire app with providers and error handling.
 * Initializes Database before rendering main content.
 */
function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[App] Initializing database...');
        await Database.getInstance().initialize();
        console.log('[App] Database initialized successfully');
        setIsInitialized(true);
      } catch (error: any) {
        console.error('[App] Database initialization failed:', error);
        setInitError(error.message || 'Failed to initialize database');
      }
    };

    initializeApp();
  }, []);

  // Show loading screen while initializing
  if (!isInitialized) {
    if (initError) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Initialization Error</Text>
          <Text style={styles.errorMessage}>{initError}</Text>
        </View>
      );
    }
    return <LoadingScreen />;
  }

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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  loadingText: {
    marginTop: theme.spacing.lg,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text.secondary,
    fontFamily: theme.fontFamily.medium,
  },
  errorText: {
    fontSize: theme.fontSize.xl,
    color: theme.colors.status.error,
    fontFamily: theme.fontFamily.bold,
    marginBottom: theme.spacing.md,
  },
  errorMessage: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    fontFamily: theme.fontFamily.regular,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
});

export default App;
