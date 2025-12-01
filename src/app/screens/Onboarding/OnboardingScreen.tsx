/**
 * OnboardingScreen
 *
 * Welcome screen shown on first launch.
 * Introduces the app and guides users to create or import a wallet.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';

export function OnboardingScreen() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Cashu Wallet</Text>
        <Text style={styles.subtitle}>Offline-First Bitcoin Payments</Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.description}>
          Welcome to the future of Bitcoin payments. Send and receive sats even without internet using our innovative Offline Cash Reserve.
        </Text>

        <View style={styles.features}>
          <Text style={styles.feature}>• Offline payments via NFC & Bluetooth</Text>
          <Text style={styles.feature}>• Privacy-preserving blind signatures</Text>
          <Text style={styles.feature}>• Multi-mint support</Text>
          <Text style={styles.feature}>• Automatic offline reserve</Text>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          fullWidth
          size="lg"
          onPress={() => navigation.navigate('CreateWallet' as never)}
        >
          Create New Wallet
        </Button>

        <Button
          fullWidth
          size="lg"
          variant="outline"
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('ImportWallet' as never)}
        >
          Import Existing Wallet
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  content: {
    padding: theme.screenPadding.horizontal,
    paddingTop: theme.spacing['4xl'],
    paddingBottom: theme.spacing['2xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing['2xl'],
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.primary[500],
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.h3,
    color: theme.colors.text.secondary,
  },
  card: {
    marginBottom: theme.spacing['2xl'],
  },
  description: {
    ...theme.typography.bodyLarge,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  features: {
    gap: theme.spacing.sm,
  },
  feature: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
  },
  actions: {
    gap: theme.spacing.md,
  },
  secondaryButton: {
    marginTop: theme.spacing.sm,
  },
});

export default OnboardingScreen;
