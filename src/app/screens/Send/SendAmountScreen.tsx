/**
 * Send Amount Screen
 *
 * Screen for entering the amount to send.
 * Uses AmountInput component with sats/USD conversion.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { AmountInput } from '../../components/AmountInput';
import ProofRepository from '../../../data/repositories/ProofRepository';
import { SendAmountRouteProp } from '../../navigation/types';

export function SendAmountScreen() {
  const navigation = useNavigation();
  const route = useRoute<SendAmountRouteProp>();
  const { mintUrl } = route.params || {};

  const [amount, setAmount] = useState(0);
  const [error, setError] = useState('');

  // Get available balance
  const proofRepo = ProofRepository.getInstance();
  const balance = mintUrl
    ? proofRepo.getBalance(mintUrl)
    : proofRepo.getStats().totalValue;

  const handleContinue = () => {
    if (amount === 0) {
      setError('Please enter an amount');
      return;
    }

    if (amount > balance) {
      setError('Insufficient balance');
      return;
    }

    navigation.navigate(
      'SendConfirm' as never,
      {
        amount,
        mintUrl: mintUrl || '',
      } as never
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>{balance.toLocaleString()} sats</Text>
      </Card>

      <View style={styles.inputSection}>
        <AmountInput
          value={amount}
          onChange={setAmount}
          maxAmount={balance}
          label="Amount to Send"
          error={error}
        />
      </View>

      <Button onPress={handleContinue} fullWidth>
        Continue
      </Button>
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
  },

  balanceLabel: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },

  balanceAmount: {
    ...theme.typography.h2,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },

  inputSection: {
    marginVertical: theme.spacing.xl,
  },
});

export default SendAmountScreen;
