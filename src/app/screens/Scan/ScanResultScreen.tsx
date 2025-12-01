/**
 * Scan Result Screen
 *
 * Shows the result after scanning a QR code.
 * Displays token details and allows accepting/rejecting.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ScanStackParamList, TabParamList, ScanResultRouteProp } from '../../navigation/types';
import CashuWalletService from '../../../core/cashu/CashuWalletService';

// Composite navigation type to allow navigating to other tabs
type ScanResultNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<ScanStackParamList, 'ScanResult'>,
  BottomTabNavigationProp<TabParamList>
>;

export function ScanResultScreen() {
  const navigation = useNavigation<ScanResultNavigationProp>();
  const route = useRoute<ScanResultRouteProp>();
  const { data, type } = route.params;

  const [processing, setProcessing] = useState(false);
  const [tokenAmount, setTokenAmount] = useState<number | null>(null);

  // Decode token to get amount for display
  useEffect(() => {
    if (type === 'token') {
      try {
        const cashu = CashuWalletService.getInstance();
        const decoded = cashu.decodeToken(data);
        if (decoded && decoded.proofs) {
          const amount = decoded.proofs.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
          setTokenAmount(amount);
        }
      } catch (error) {
        console.error('[ScanResult] Failed to decode token:', error);
      }
    }
  }, [data, type]);

  const handleAccept = async () => {
    setProcessing(true);

    try {
      if (type === 'token') {
        // Actually receive the token using CashuWalletService
        const cashu = CashuWalletService.getInstance();
        const result = await cashu.receive(data);

        Alert.alert(
          'Token Received!',
          `Successfully received ${result.total.toLocaleString()} sats`,
          [{ text: 'OK', onPress: () => navigation.navigate('Home', { screen: 'HomeMain' }) }]
        );
      } else if (type === 'payment_request') {
        // Navigate to send/pay flow with the invoice pre-filled
        // For now just navigate to Send tab
        navigation.navigate('Send', { screen: 'SendMain' });
      } else if (type === 'mint_url') {
        // Navigate to settings to add mint
        navigation.navigate('Settings', { screen: 'MintAdd' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process scanned data';
      Alert.alert('Error', errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = () => {
    navigation.goBack();
  };

  const getTypeLabel = (): string => {
    switch (type) {
      case 'token':
        return 'Cashu Token';
      case 'payment_request':
        return 'Lightning Invoice';
      case 'mint_url':
        return 'Mint URL';
      default:
        return 'Unknown Data';
    }
  };

  const getTypeDescription = (): string => {
    switch (type) {
      case 'token':
        return 'This QR code contains a Cashu ecash token that you can redeem to your wallet.';
      case 'payment_request':
        return 'This QR code contains a Lightning invoice that you can pay.';
      case 'mint_url':
        return 'This QR code contains a mint URL that you can add to your wallet.';
      default:
        return 'The scanned data format is not recognized.';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.resultCard}>
        <View style={styles.typeContainer}>
          <View style={[
            styles.typeBadge,
            { backgroundColor: type === 'token' ? theme.colors.status.success + '20' : theme.colors.primary[500] + '20' }
          ]}>
            <Text style={[
              styles.typeText,
              { color: type === 'token' ? theme.colors.status.success : theme.colors.primary[500] }
            ]}>
              {getTypeLabel()}
            </Text>
          </View>
        </View>

        <Text style={styles.description}>{getTypeDescription()}</Text>

        {tokenAmount !== null && (
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amountValue}>{tokenAmount.toLocaleString()}</Text>
            <Text style={styles.amountUnit}>sats</Text>
          </View>
        )}

        <View style={styles.dataContainer}>
          <Text style={styles.dataLabel}>Scanned Data:</Text>
          <Text style={styles.dataValue} numberOfLines={10}>
            {data.length > 200 ? data.substring(0, 200) + '...' : data}
          </Text>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          onPress={handleAccept}
          disabled={processing}
          style={styles.acceptButton}
        >
          {processing
            ? 'Processing...'
            : type === 'token'
            ? 'Redeem Token'
            : type === 'payment_request'
            ? 'Pay Invoice'
            : 'Add Mint'}
        </Button>

        <Button
          variant="secondary"
          onPress={handleReject}
          disabled={processing}
          style={styles.rejectButton}
        >
          Cancel
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
    paddingBottom: theme.spacing['2xl'],
  },
  resultCard: {
    marginTop: theme.spacing.lg,
  },
  typeContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  typeBadge: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  typeText: {
    ...theme.typography.labelLarge,
    fontFamily: theme.fontFamily.bold,
  },
  description: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  amountContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.status.success + '10',
    borderRadius: theme.borderRadius.md,
  },
  amountLabel: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  amountValue: {
    ...theme.typography.amount,
    fontSize: theme.fontSize['2xl'],
    color: theme.colors.status.success,
  },
  amountUnit: {
    ...theme.typography.currencyUnit,
    color: theme.colors.text.secondary,
  },
  dataContainer: {
    backgroundColor: theme.colors.background.tertiary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  dataLabel: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  dataValue: {
    ...theme.typography.mono,
    color: theme.colors.text.primary,
    fontSize: theme.fontSize.xs,
  },
  actions: {
    marginTop: theme.spacing.xl,
  },
  acceptButton: {
    marginBottom: theme.spacing.md,
  },
  rejectButton: {},
});

export default ScanResultScreen;
