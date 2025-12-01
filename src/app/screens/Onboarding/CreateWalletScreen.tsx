/**
 * CreateWalletScreen
 *
 * Guides users through creating a new wallet.
 * Generates seed phrase and initial configuration.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';

export function CreateWalletScreen() {
  const navigation = useNavigation();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateWallet = async () => {
    setIsCreating(true);
    try {
      // TODO: Implement wallet creation
      // 1. Generate seed phrase
      // 2. Initialize database
      // 3. Set up default mint
      // 4. Navigate to main app

      // For now, just navigate to main
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' as never }],
        });
      }, 1000);
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setIsCreating(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create New Wallet</Text>
      <Text style={styles.subtitle}>Set up your offline-first Bitcoin wallet</Text>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>What happens next:</Text>
        <View style={styles.steps}>
          <Text style={styles.step}>1. A secure seed phrase will be generated</Text>
          <Text style={styles.step}>2. Your wallet database will be initialized</Text>
          <Text style={styles.step}>3. Default mint will be configured</Text>
          <Text style={styles.step}>4. Offline Cash Reserve will be set up</Text>
        </View>
      </Card>

      <Card style={styles.warningCard}>
        <Text style={styles.warningTitle}>Important</Text>
        <Text style={styles.warningText}>
          Make sure to backup your seed phrase after creation. It's the only way to recover your funds.
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button
          fullWidth
          size="lg"
          loading={isCreating}
          onPress={handleCreateWallet}
        >
          {isCreating ? 'Creating Wallet...' : 'Create Wallet'}
        </Button>

        <Button
          fullWidth
          variant="ghost"
          onPress={() => navigation.goBack()}
          disabled={isCreating}
        >
          Go Back
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
    paddingTop: theme.spacing['2xl'],
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.bodyLarge,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xl,
  },
  card: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  steps: {
    gap: theme.spacing.sm,
  },
  step: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
  },
  warningCard: {
    backgroundColor: theme.colors.status.warningBackground,
    borderColor: theme.colors.status.warning,
    marginBottom: theme.spacing.xl,
  },
  warningTitle: {
    ...theme.typography.label,
    color: theme.colors.status.warning,
    marginBottom: theme.spacing.sm,
  },
  warningText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.primary,
  },
  actions: {
    gap: theme.spacing.md,
  },
});

export default CreateWalletScreen;
