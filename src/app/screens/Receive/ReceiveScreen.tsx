/**
 * Receive Screen
 *
 * Allows users to receive ecash tokens by:
 * 1. Pasting a Cashu token string (from another wallet)
 * 2. Minting new tokens via Lightning invoice
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import CashuWalletService from '../../../core/cashu/CashuWalletService';
import MintRepository from '../../../data/repositories/MintRepository';
import { Mint } from '../../../types';

type ReceiveMode = 'token' | 'lightning';

export function ReceiveScreen() {
  const navigation = useNavigation();
  const [mode, setMode] = useState<ReceiveMode>('token');
  const [tokenInput, setTokenInput] = useState('');
  const [lightningAmount, setLightningAmount] = useState('');
  const [selectedMint, setSelectedMint] = useState<Mint | null>(null);
  const [mints, setMints] = useState<Mint[]>([]);
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);

  const loadMints = useCallback(async () => {
    try {
      const mintRepo = MintRepository.getInstance();
      const allMints = await mintRepo.getAll();
      setMints(allMints);
      if (allMints.length > 0 && !selectedMint) {
        setSelectedMint(allMints[0]);
      } else if (allMints.length > 0 && selectedMint) {
        // Re-select if still exists (after coming back from MintAdd)
        const stillExists = allMints.find(m => m.id === selectedMint.id);
        if (!stillExists) {
          setSelectedMint(allMints[0]);
        }
      }
    } catch (error) {
      console.error('[Receive] Failed to load mints:', error);
    }
  }, [selectedMint]);

  // Reload mints when screen comes into focus (after returning from MintAdd)
  useFocusEffect(
    useCallback(() => {
      loadMints();
    }, [loadMints])
  );

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getString();
      if (text) {
        setTokenInput(text);
      }
    } catch (error) {
      console.error('[Receive] Failed to paste from clipboard:', error);
    }
  };

  const handleReceiveToken = async () => {
    if (!tokenInput.trim()) {
      Alert.alert('Error', 'Please enter a Cashu token');
      return;
    }

    setLoading(true);

    try {
      const cashu = CashuWalletService.getInstance();

      // Decode token to show preview
      let decoded;
      try {
        decoded = cashu.decodeToken(tokenInput.trim());
      } catch (e) {
        Alert.alert('Invalid Token', 'The token format is not valid. Please check and try again.');
        setLoading(false);
        return;
      }

      const mintUrl = decoded.token[0]?.mint;
      const proofs = decoded.token[0]?.proofs || [];
      const totalAmount = proofs.reduce((sum: number, p: any) => sum + p.amount, 0);

      // Check if we have this mint
      const mintRepo = MintRepository.getInstance();
      const existingMint = await mintRepo.getByUrl(mintUrl);

      if (!existingMint) {
        Alert.alert(
          'Unknown Mint',
          `This token is from a mint you haven't added yet:\n\n${mintUrl}\n\nWould you like to add this mint and receive the token?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
            {
              text: 'Add Mint & Receive',
              onPress: async () => {
                try {
                  // Add the mint first
                  await mintRepo.create({
                    url: mintUrl,
                    name: 'Unknown Mint',
                    trustLevel: 'UNTRUSTED' as any,
                  });
                  // Then receive
                  await doReceiveToken(tokenInput.trim(), totalAmount);
                } catch (error: any) {
                  Alert.alert('Error', error.message);
                  setLoading(false);
                }
              },
            },
          ]
        );
        return;
      }

      await doReceiveToken(tokenInput.trim(), totalAmount);
    } catch (error: any) {
      console.error('[Receive] Token receive failed:', error);
      Alert.alert('Receive Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const doReceiveToken = async (token: string, expectedAmount: number) => {
    try {
      const cashu = CashuWalletService.getInstance();
      const result = await cashu.receive(token);

      Alert.alert(
        'Tokens Received!',
        `Successfully received ${result.total.toLocaleString()} sats`,
        [
          {
            text: 'OK',
            onPress: () => {
              setTokenInput('');
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      if (error.message.includes('already spent')) {
        Alert.alert('Token Already Claimed', 'These tokens have already been redeemed by someone else.');
      } else {
        throw error;
      }
    }
  };

  const handleRequestInvoice = async () => {
    if (!selectedMint) {
      Alert.alert('Error', 'Please select a mint first');
      return;
    }

    const amount = parseInt(lightningAmount, 10);
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setLoading(true);

    try {
      const cashu = CashuWalletService.getInstance();
      const { quote, request } = await cashu.requestMintQuote(selectedMint.url, amount);

      setQuoteId(quote);
      setInvoice(request);
    } catch (error: any) {
      console.error('[Receive] Failed to get mint quote:', error);
      Alert.alert('Error', `Failed to generate invoice: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckPayment = async () => {
    if (!selectedMint || !quoteId) return;

    setLoading(true);

    try {
      const cashu = CashuWalletService.getInstance();
      const amount = parseInt(lightningAmount, 10);

      const result = await cashu.mintTokens(selectedMint.url, amount, quoteId);

      Alert.alert(
        'Tokens Minted!',
        `Successfully minted ${result.total.toLocaleString()} sats`,
        [
          {
            text: 'OK',
            onPress: () => {
              setInvoice(null);
              setQuoteId(null);
              setLightningAmount('');
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('[Receive] Mint failed:', error);
      if (error.message.includes('not paid')) {
        Alert.alert('Invoice Not Paid', 'The Lightning invoice has not been paid yet. Please pay it first.');
      } else {
        Alert.alert('Mint Failed', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const copyInvoice = async () => {
    if (invoice) {
      Clipboard.setString(invoice);
      Alert.alert('Copied', 'Invoice copied to clipboard');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mode Selector */}
      <View style={styles.modeSelector}>
        <Button
          variant={mode === 'token' ? 'primary' : 'secondary'}
          onPress={() => setMode('token')}
          style={styles.modeButton}
        >
          Paste Token
        </Button>
        <Button
          variant={mode === 'lightning' ? 'primary' : 'secondary'}
          onPress={() => setMode('lightning')}
          style={styles.modeButton}
        >
          Lightning
        </Button>
      </View>

      {mode === 'token' ? (
        /* TOKEN RECEIVE MODE */
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Receive Cashu Token</Text>
          <Text style={styles.cardDescription}>
            Paste a Cashu token string to claim the ecash
          </Text>

          <TextInput
            style={styles.tokenInput}
            placeholder="cashuA..."
            placeholderTextColor={theme.colors.text.tertiary}
            value={tokenInput}
            onChangeText={setTokenInput}
            multiline
            numberOfLines={4}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <View style={styles.buttonRow}>
            <Button
              variant="secondary"
              onPress={handlePasteFromClipboard}
              style={styles.pasteButton}
              disabled={loading}
            >
              Paste
            </Button>
            <Button
              onPress={handleReceiveToken}
              style={styles.receiveButton}
              disabled={!tokenInput.trim() || loading}
            >
              {loading ? 'Receiving...' : 'Receive'}
            </Button>
          </View>
        </Card>
      ) : (
        /* LIGHTNING MINT MODE */
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Mint via Lightning</Text>
          <Text style={styles.cardDescription}>
            Generate a Lightning invoice to mint new tokens
          </Text>

          {mints.length === 0 ? (
            <View style={styles.noMintContainer}>
              <Text style={styles.noMintText}>
                You need to add a mint first before you can receive via Lightning.
              </Text>
              <View style={styles.mintButtonRow}>
                <Button
                  onPress={() => navigation.navigate('MintDiscovery' as never)}
                  style={styles.discoverMintButton}
                >
                  Discover Mints
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => navigation.navigate('MintAdd' as never)}
                  style={styles.addMintButton}
                >
                  Add Manually
                </Button>
              </View>
            </View>
          ) : !invoice ? (
            <>
              {/* Mint Selector */}
              <Text style={styles.label}>Select Mint</Text>
              <View style={styles.mintSelector}>
                {mints.map((mint) => (
                  <Button
                    key={mint.id}
                    variant={selectedMint?.id === mint.id ? 'primary' : 'secondary'}
                    onPress={() => setSelectedMint(mint)}
                    style={styles.mintOption}
                  >
                    {mint.name || 'Unnamed'}
                  </Button>
                ))}
              </View>

              {/* Amount Input */}
              <Text style={styles.label}>Amount (sats)</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="1000"
                placeholderTextColor={theme.colors.text.tertiary}
                value={lightningAmount}
                onChangeText={setLightningAmount}
                keyboardType="numeric"
                editable={!loading}
              />

              <Button
                onPress={handleRequestInvoice}
                disabled={!selectedMint || !lightningAmount || loading}
                style={styles.generateButton}
              >
                {loading ? 'Generating...' : 'Generate Invoice'}
              </Button>
            </>
          ) : (
            /* Invoice Display */
            <>
              <Text style={styles.invoiceLabel}>Pay this Lightning Invoice:</Text>
              <View style={styles.invoiceContainer}>
                <Text style={styles.invoiceText} selectable>
                  {invoice}
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <Button
                  variant="secondary"
                  onPress={copyInvoice}
                  style={styles.copyButton}
                >
                  Copy
                </Button>
                <Button
                  onPress={handleCheckPayment}
                  style={styles.checkButton}
                  disabled={loading}
                >
                  {loading ? 'Checking...' : 'I Paid It'}
                </Button>
              </View>

              <Button
                variant="secondary"
                onPress={() => {
                  setInvoice(null);
                  setQuoteId(null);
                }}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
            </>
          )}
        </Card>
      )}

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary[500]} />
        </View>
      )}

      {/* Help Text */}
      <Card style={styles.helpCard}>
        <Text style={styles.helpTitle}>How to Receive</Text>
        <Text style={styles.helpText}>
          <Text style={styles.helpBold}>Paste Token:</Text> Someone sends you a token string
          starting with "cashu". Paste it here to claim the ecash.
        </Text>
        <Text style={styles.helpText}>
          <Text style={styles.helpBold}>Lightning:</Text> Generate a Lightning invoice,
          pay it from any Lightning wallet, then claim your new tokens.
        </Text>
      </Card>
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
  tokenInput: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
    fontFamily: theme.fontFamily.mono,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  pasteButton: {
    flex: 1,
  },
  receiveButton: {
    flex: 2,
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
  generateButton: {
    marginTop: theme.spacing.lg,
  },
  invoiceLabel: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  invoiceContainer: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  invoiceText: {
    ...theme.typography.caption,
    color: theme.colors.text.primary,
    fontFamily: theme.fontFamily.mono,
  },
  copyButton: {
    flex: 1,
  },
  checkButton: {
    flex: 2,
  },
  cancelButton: {
    marginTop: theme.spacing.md,
  },
  noMintContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  noMintText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  mintButtonRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  discoverMintButton: {
    flex: 1,
  },
  addMintButton: {
    flex: 1,
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
  helpCard: {
    backgroundColor: theme.colors.background.secondary,
  },
  helpTitle: {
    ...theme.typography.labelLarge,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  helpText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  helpBold: {
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.text.primary,
  },
});

export default ReceiveScreen;
