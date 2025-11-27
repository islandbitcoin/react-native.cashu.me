/**
 * Error Boundary
 *
 * React Error Boundary for graceful error handling.
 * Catches JavaScript errors anywhere in the component tree and displays a fallback UI.
 *
 * Features:
 * - Catches rendering errors
 * - Displays user-friendly error screen
 * - Logs errors for debugging
 * - Allows app recovery (reload)
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */

import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { theme } from '../theme';

/**
 * Error boundary props
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: React.ErrorInfo, resetError: () => void) => ReactNode;
}

/**
 * Error boundary state
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary Component
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // TODO: Log to error reporting service (Sentry, etc.)
    // this.logErrorToService(error, errorInfo);
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error!,
          this.state.errorInfo!,
          this.resetError
        );
      }

      // Default fallback UI
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.message}>
              The app encountered an unexpected error. Don't worry, your funds are safe.
            </Text>

            {__DEV__ && this.state.error && (
              <ScrollView style={styles.errorDetails}>
                <Text style={styles.errorTitle}>Error Details (Dev Only):</Text>
                <Text style={styles.errorText}>{this.state.error.toString()}</Text>
                {this.state.errorInfo && (
                  <Text style={styles.errorStack}>{this.state.errorInfo.componentStack}</Text>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.button} onPress={this.resetError}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                // TODO: Navigate to support or restart app
                console.log('[ErrorBoundary] Restart app');
              }}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Restart App
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },

  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },

  title: {
    ...theme.typography.h1,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },

  message: {
    ...theme.typography.bodyLarge,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },

  errorDetails: {
    width: '100%',
    maxHeight: 200,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },

  errorTitle: {
    ...theme.typography.label,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },

  errorText: {
    ...theme.typography.mono,
    color: theme.colors.status.error,
    marginBottom: theme.spacing.sm,
  },

  errorStack: {
    ...theme.typography.monoSmall,
    color: theme.colors.text.tertiary,
  },

  button: {
    width: '100%',
    height: theme.buttonHeight.lg,
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },

  buttonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },

  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: theme.borderWidth.medium,
    borderColor: theme.colors.border.primary,
  },

  secondaryButtonText: {
    color: theme.colors.text.primary,
  },
});

export default ErrorBoundary;
