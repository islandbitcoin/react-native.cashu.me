/**
 * Send Screen
 *
 * Allows users to send ecash tokens by:
 * 1. Creating a shareable Cashu token string
 * 2. Paying a Lightning invoice (melting)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Clipboard,
  Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import CashuWalletService from '../../../core/cashu/CashuWalletService';
import MintRepository from '../../../data/repositories/MintRepository';
import ProofRepository from '../../../data/repositories/ProofRepository';
import { Mint } from '../../../types';

type SendMode = 'token' | 'lightning';

interface MintWithBalance extends Mint {
  balance: number;
}

export function SendScreen() {
  const navigation = useNavigation();
  const [mode, setMode] = useState<SendMode>('token');
  const [amount, setAmount] = useState('');
  const [selectedMint, setSelectedMint] = useState<MintWithBalance | null>(null);
  const [mints, setMints] = useState<MintWithBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [lightningInvoice, setLightningInvoice] = useState('');
  const [meltQuote, setMeltQuote] = useState<{ quote: string; amount: number; fee: number } | null>(null);

  useEffect(() => {
    loadMints();
  }, []);

  const loadMints = async () => {
    try {
      const mintRepo = MintRepository.getInstance();
      const proofRepo = ProofRepository.getInstance();
      const allMints = await mintRepo.getAll();

      const mintsWithBalance: MintWithBalance[] = allMints.map(mint => ({
        ...mint,
        balance: proofRepo.getBalance(mint.url),
      }));

      // Filter to only mints with balance
      const mintsWithFunds = mintsWithBalance.filter(m => m.balance > 0);
      setMints(mintsWithFunds);

      if (mintsWithFunds.length > 0) {
        setSelectedMint(mintsWithFunds[0]);
      }
    } catch (error) {
      console.error('[Send] Failed to load mints:', error);
    }
  };

  const handleCreateToken = async () => {
    if (!selectedMint) {
      Alert.alert('Error', 'Please select a mint');
      return;
    }

    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (amountNum > selectedMint.balance) {
      Alert.alert('Insufficient Balance', `You only have ${selectedMint.balance.toLocaleString()} sats at this mint.`);
      return;
    }

    setLoading(true);

    try {
      const cashu = CashuWalletService.getInstance();
      const { proofs, transactionId } = await cashu.send(selectedMint.url, amountNum);

      // Encode the proofs as a shareable token
      const token = cashu.encodeToken(proofs);
      setGeneratedToken(token);

      // Note: We don't confirm the send until user shares it
      // They can cancel if they don't share
    } catch (error: any) {
      console.error('[Send] Failed to create token:', error);
      Alert.alert('Send Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = async () => {
    if (generatedToken) {
      Clipboard.setString(generatedToken);
      Alert.alert('Copied', 'Token copied to clipboard. Share it with the recipient!');
    }
  };

  const handleShareToken = async () => {
    if (generatedToken) {
      try {
        await Share.share({
          message: generatedToken,
          title: 'Cashu Token',
        });
      } catch (error) {
        console.error('[Send] Share failed:', error);
      }
    }
  };

  const handleDone = () => {
    // Reset and go back
    setGeneratedToken(null);
    setAmount('');
    loadMints(); // Refresh balances
    navigation.goBack();
  };

  const handlePasteInvoice = async () => {
    try {
      const text = await Clipboard.getString();
      if (text) {
        setLightningInvoice(text);
      }
    } catch (error) {
      console.error('[Send] Failed to paste:', error);
    }
  };

  const handleGetMeltQuote = async () => {
    if (!selectedMint) {
      Alert.alert('Error', 'Please select a mint');
      return;
    }

    if (!lightningInvoice.trim()) {
      Alert.alert('Error', 'Please enter a Lightning invoice');
      return;
    }

    setLoading(true);

    try {
      const cashu = CashuWalletService.getInstance();
      const quote = await cashu.getMeltQuote(selectedMint.url, lightningInvoice.trim());

      const totalNeeded = quote.amount + quote.feeReserve;
      if (totalNeeded > selectedMint.balance) {
        Alert.alert(
          'Insufficient Balance',
          `This invoice requires ${totalNeeded} sats (${quote.amount} + ${quote.feeReserve} fee reserve), but you only have ${selectedMint.balance} sats at this mint.`
        );
        setLoading(false);
        return;
      }

      setMeltQuote({
        quote: quote.quote,
        amount: quote.amount,
        fee: quote.feeReserve,
      });
    } catch (error: any) {
      console.error('[Send] Failed to get melt quote:', error);
      Alert.alert('Error', `Failed to decode invoice: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePayInvoice = async () => {
    if (!selectedMint || !meltQuote) return;

    setLoading(true);

    try {
      const cashu = CashuWalletService.getInstance();

      // Call melt with the quote ID - proof selection is handled internally
      const result = await cashu.melt(
        selectedMint.url,
        lightningInvoice.trim(),
        meltQuote.quote
      );

      if (result.paid) {
        Alert.alert(
          'Payment Sent!',
          `Successfully paid ${meltQuote.amount.toLocaleString()} sats${meltQuote.fee > 0 ? ` (+ ${meltQuote.fee} sat fee)` : ''}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setMeltQuote(null);
                setLightningInvoice('');
                loadMints();
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        Alert.alert('Payment Failed', 'The Lightning payment could not be completed.');
      }
    } catch (error: any) {
      console.error('[Send] Melt failed:', error);
      Alert.alert('Payment Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const totalBalance = mints.reduce((sum, m) => sum + m.balance, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Balance Summary */}
      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available to Send</Text>
        <Text style={styles.balanceAmount}>{totalBalance.toLocaleString()}</Text>
        <Text style={styles.balanceUnit}>sats</Text>
      </Card>

      {/* Mode Selector */}
      <View style={styles.modeSelector}>
        <Button
          variant={mode === 'token' ? 'primary' : 'secondary'}
          onPress={() => {
            setMode('token');
            setMeltQuote(null);
          }}
          style={styles.modeButton}
        >
          Create Token
        </Button>
        <Button
          variant={mode === 'lightning' ? 'primary' : 'secondary'}
          onPress={() => {
            setMode('lightning');
            setGeneratedToken(null);
          }}
          style={styles.modeButton}
        >
          Pay Invoice
        </Button>
      </View>

      {mints.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            You don't have any tokens to send. Receive some first!
          </Text>
          <Button
            onPress={() => navigation.navigate('ReceiveModal' as never)}
            style={styles.receiveButton}
          >
            Receive Tokens
          </Button>
        </Card>
      ) : mode === 'token' ? (
        /* TOKEN SEND MODE */
        generatedToken ? (
          /* Show Generated Token */
          <Card style={styles.card}>
            <Text style={styles.successTitle}>Token Created!</Text>
            <Text style={styles.successAmount}>{parseInt(amount).toLocaleString()} sats</Text>

            <View style={styles.tokenContainer}>
              <Text style={styles.tokenText} selectable numberOfLines={6}>
                {generatedToken}
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <Button variant="secondary" onPress={handleCopyToken} style={styles.actionButton}>
                Copy
              </Button>
              <Button onPress={handleShareToken} style={styles.actionButton}>
                Share
              </Button>
            </View>

            <Button variant="secondary" onPress={handleDone} style={styles.doneButton}>
              Done
            </Button>

            <Text style={styles.warningText}>
              Warning: This token can only be claimed once. If you don't share it, the funds are locked until you cancel.
            </Text>
          </Card>
        ) : (
          /* Amount Input for Token */
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Create Shareable Token</Text>
            <Text style={styles.cardDescription}>
              Generate a token that anyone can claim
            </Text>

            {/* Mint Selector */}
            <Text style={styles.label}>From Mint</Text>
            <View style={styles.mintSelector}>
              {mints.map((mint) => (
                <Button
                  key={mint.id}
                  variant={selectedMint?.id === mint.id ? 'primary' : 'secondary'}
                  onPress={() => setSelectedMint(mint)}
                  style={styles.mintOption}
                >
                  {mint.name || 'Unnamed'} ({mint.balance.toLocaleString()})
                </Button>
              ))}
            </View>

            {/* Amount Input */}
            <Text style={styles.label}>Amount (sats)</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="1000"
              placeholderTextColor={theme.colors.text.tertiary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              editable={!loading}
            />
            {selectedMint && (
              <Text style={styles.maxText}>
                Max: {selectedMint.balance.toLocaleString()} sats
              </Text>
            )}

            <Button
              onPress={handleCreateToken}
              disabled={!selectedMint || !amount || loading}
              style={styles.createButton}
            >
              {loading ? 'Creating...' : 'Create Token'}
            </Button>
          </Card>
        )
      ) : (
        /* LIGHTNING PAY MODE */
        meltQuote ? (
          /* Confirm Payment */
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Confirm Payment</Text>

            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Amount</Text>
              <Text style={styles.quoteValue}>{meltQuote.amount.toLocaleString()} sats</Text>
            </View>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Fee</Text>
              <Text style={styles.quoteValue}>{meltQuote.fee.toLocaleString()} sats</Text>
            </View>
            <View style={styles.quoteDivider} />
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabelTotal}>Total</Text>
              <Text style={styles.quoteValueTotal}>
                {(meltQuote.amount + meltQuote.fee).toLocaleString()} sats
              </Text>
            </View>

            <Button
              onPress={handlePayInvoice}
              disabled={loading}
              style={styles.payButton}
            >
              {loading ? 'Paying...' : 'Pay Now'}
            </Button>

            <Button
              variant="secondary"
              onPress={() => setMeltQuote(null)}
              style={styles.cancelButton}
            >
              Cancel
            </Button>
          </Card>
        ) : (
          /* Invoice Input */
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Pay Lightning Invoice</Text>
            <Text style={styles.cardDescription}>
              Enter a Lightning invoice to pay
            </Text>

            {/* Mint Selector */}
            <Text style={styles.label}>From Mint</Text>
            <View style={styles.mintSelector}>
              {mints.map((mint) => (
                <Button
                  key={mint.id}
                  variant={selectedMint?.id === mint.id ? 'primary' : 'secondary'}
                  onPress={() => setSelectedMint(mint)}
                  style={styles.mintOption}
                >
                  {mint.name || 'Unnamed'} ({mint.balance.toLocaleString()})
                </Button>
              ))}
            </View>

            {/* Invoice Input */}
            <Text style={styles.label}>Lightning Invoice</Text>
            <TextInput
              style={styles.invoiceInput}
              placeholder="lnbc..."
              placeholderTextColor={theme.colors.text.tertiary}
              value={lightningInvoice}
              onChangeText={setLightningInvoice}
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <View style={styles.buttonRow}>
              <Button
                variant="secondary"
                onPress={handlePasteInvoice}
                style={styles.pasteButton}
                disabled={loading}
              >
                Paste
              </Button>
              <Button
                onPress={handleGetMeltQuote}
                disabled={!selectedMint || !lightningInvoice.trim() || loading}
                style={styles.checkButton}
              >
                {loading ? 'Checking...' : 'Check Invoice'}
              </Button>
            </View>
          </Card>
        )
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary[500]} />
        </View>
      )}
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
  balanceCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  balanceLabel: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
  },
  balanceAmount: {
    ...theme.typography.amount,
    fontSize: theme.fontSize['3xl'],
    color: theme.colors.text.primary,
  },
  balanceUnit: {
    ...theme.typography.currencyUnit,
    color: theme.colors.text.secondary,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  modeButton: {
    flex: 1,
  },
  card: {
    marginBottom: theme.spacing.lg,
  },
  cardTitle: {
    ...theme.typography.h3,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  cardDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.lg,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  mintSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  mintOption: {
    minWidth: 100,
  },
  amountInput: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  maxText: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xs,
  },
  createButton: {
    marginTop: theme.spacing.xl,
  },
  successTitle: {
    ...theme.typography.h2,
    color: theme.colors.status.success,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  successAmount: {
    ...theme.typography.amount,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  tokenContainer: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  tokenText: {
    ...theme.typography.caption,
    color: theme.colors.text.primary,
    fontFamily: theme.fontFamily.mono,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  doneButton: {
    marginTop: theme.spacing.md,
  },
  warningText: {
    ...theme.typography.caption,
    color: theme.colors.status.warning,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
  invoiceInput: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: theme.fontFamily.mono,
  },
  pasteButton: {
    flex: 1,
  },
  checkButton: {
    flex: 2,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  quoteLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
  },
  quoteValue: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
  },
  quoteDivider: {
    height: 1,
    backgroundColor: theme.colors.border.primary,
    marginVertical: theme.spacing.md,
  },
  quoteLabelTotal: {
    ...theme.typography.labelLarge,
    color: theme.colors.text.primary,
  },
  quoteValueTotal: {
    ...theme.typography.labelLarge,
    color: theme.colors.primary[500],
  },
  payButton: {
    marginTop: theme.spacing.lg,
  },
  cancelButton: {
    marginTop: theme.spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  receiveButton: {
    minWidth: 150,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});

export default SendScreen;
