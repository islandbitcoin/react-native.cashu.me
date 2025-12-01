/**
 * ImportWalletScreen
 *
 * Allows users to restore an existing wallet from:
 * - Seed phrase (mnemonic)
 * - Backup file
 * - QR code
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

export function ImportWalletScreen() {
  const navigation = useNavigation();
  const [seedPhrase, setSeedPhrase] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImportWallet = async () => {
    if (!seedPhrase.trim()) {
      Alert.alert('Error', 'Please enter your seed phrase');
      return;
    }

    setIsImporting(true);
    try {
      // TODO: Implement wallet import
      // 1. Validate seed phrase
      // 2. Derive keys
      // 3. Initialize database
      // 4. Sync with mints
      // 5. Navigate to main app

      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' as never }],
        });
      }, 1000);
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setIsImporting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Import Wallet</Text>
      <Text style={styles.subtitle}>Restore your existing Cashu wallet</Text>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Enter Seed Phrase</Text>
        <Text style={styles.instructions}>
          Enter your 12 or 24 word recovery phrase, separated by spaces.
        </Text>

        <Input
          placeholder="Enter your seed phrase..."
          value={seedPhrase}
          onChangeText={setSeedPhrase}
          multiline
          numberOfLines={4}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>Alternative Methods</Text>
        <Text style={styles.infoText}>
          You can also import from a backup file or scan a backup QR code. These options will be available soon.
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button
          fullWidth
          size="lg"
          loading={isImporting}
          disabled={!seedPhrase.trim()}
          onPress={handleImportWallet}
        >
          {isImporting ? 'Importing...' : 'Import Wallet'}
        </Button>

        <Button
          fullWidth
          variant="ghost"
          onPress={() => navigation.goBack()}
          disabled={isImporting}
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
    marginBottom: theme.spacing.sm,
  },
  instructions: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
  },
  input: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  infoCard: {
    backgroundColor: theme.colors.background.tertiary,
    marginBottom: theme.spacing.xl,
  },
  infoTitle: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.tertiary,
  },
  actions: {
    gap: theme.spacing.md,
  },
});

export default ImportWalletScreen;
