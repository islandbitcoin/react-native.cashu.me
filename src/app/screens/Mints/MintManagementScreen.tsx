/**
 * Mint Management Screen
 *
 * Lists all configured mints with their balances and trust levels.
 * Allows adding new mints and managing existing ones.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import MintRepository from '../../../data/repositories/MintRepository';
import ProofRepository from '../../../data/repositories/ProofRepository';
import { Mint, TrustLevel } from '../../../types';
import { SettingsStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'MintManagement'>;

interface MintWithBalance extends Mint {
  balance: number;
  proofCount: number;
}

export function MintManagementScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [mints, setMints] = useState<MintWithBalance[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMints = async () => {
    try {
      const mintRepo = MintRepository.getInstance();
      const proofRepo = ProofRepository.getInstance();

      const allMints = await mintRepo.getAll();

      // Enrich mints with balance info
      const mintsWithBalance: MintWithBalance[] = await Promise.all(
        allMints.map(async (mint) => {
          const balance = proofRepo.getBalance(mint.url);
          const proofs = await proofRepo.getAll({ mintUrl: mint.url });
          return {
            ...mint,
            balance,
            proofCount: proofs?.length || 0,
          };
        })
      );

      setMints(mintsWithBalance);
    } catch (error) {
      console.error('[MintManagement] Failed to load mints:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadMints();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMints();
    setRefreshing(false);
  };

  const handleAddMint = () => {
    navigation.navigate('MintAdd');
  };

  const handleDiscoverMints = () => {
    navigation.navigate('MintDiscovery');
  };

  const handleMintPress = (mint: MintWithBalance) => {
    navigation.navigate('MintDetails', { mintId: mint.id });
  };

  const handleDeleteMint = async (mint: MintWithBalance) => {
    if (mint.balance > 0) {
      Alert.alert(
        'Cannot Delete',
        `This mint has a balance of ${mint.balance} sats. Please transfer or spend these tokens first.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Delete Mint',
      `Are you sure you want to remove "${mint.name || mint.url}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const mintRepo = MintRepository.getInstance();
              await mintRepo.delete(mint.id);
              await loadMints();
            } catch (error) {
              console.error('[MintManagement] Failed to delete mint:', error);
            }
          },
        },
      ]
    );
  };

  const getTrustLevelColor = (level: TrustLevel): string => {
    switch (level) {
      case TrustLevel.HIGH:
        return theme.colors.status.success;
      case TrustLevel.MEDIUM:
        return theme.colors.primary[500];
      case TrustLevel.LOW:
        return theme.colors.status.warning;
      default:
        return theme.colors.text.tertiary;
    }
  };

  const getTrustLevelLabel = (level: TrustLevel): string => {
    switch (level) {
      case TrustLevel.HIGH:
        return 'High Trust';
      case TrustLevel.MEDIUM:
        return 'Medium Trust';
      case TrustLevel.LOW:
        return 'Low Trust';
      default:
        return 'Untrusted';
    }
  };

  const totalBalance = mints.reduce((sum, m) => sum + m.balance, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading mints...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary[500]}
        />
      }
    >
      {/* Summary Card */}
      <Card style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Balance Across All Mints</Text>
        <Text style={styles.summaryAmount}>{totalBalance.toLocaleString()}</Text>
        <Text style={styles.summaryUnit}>sats</Text>
        <Text style={styles.mintCount}>{mints.length} mint{mints.length !== 1 ? 's' : ''} configured</Text>
      </Card>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Button
          onPress={handleDiscoverMints}
          style={styles.discoverButton}
        >
          Discover Mints
        </Button>
        <Button
          variant="secondary"
          onPress={handleAddMint}
          style={styles.addButton}
        >
          + Add by URL
        </Button>
      </View>

      {/* Mints List */}
      {mints.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Mints Configured</Text>
          <Text style={styles.emptyText}>
            Add a Cashu mint to start receiving and sending ecash tokens.
          </Text>
          <Text style={styles.emptyHint}>
            Tap "Discover Mints" to browse recommended mints
          </Text>
        </Card>
      ) : (
        <View style={styles.mintList}>
          {mints.map((mint) => (
            <TouchableOpacity
              key={mint.id}
              onPress={() => handleMintPress(mint)}
              onLongPress={() => handleDeleteMint(mint)}
            >
              <Card style={styles.mintCard}>
                <View style={styles.mintHeader}>
                  <View style={styles.mintInfo}>
                    <Text style={styles.mintName} numberOfLines={1}>
                      {mint.name || 'Unnamed Mint'}
                    </Text>
                    <Text style={styles.mintUrl} numberOfLines={1}>
                      {mint.url}
                    </Text>
                  </View>
                  <View style={styles.mintBalance}>
                    <Text style={styles.balanceAmount}>{mint.balance.toLocaleString()}</Text>
                    <Text style={styles.balanceUnit}>sats</Text>
                  </View>
                </View>

                <View style={styles.mintFooter}>
                  <View style={[styles.trustBadge, { backgroundColor: getTrustLevelColor(mint.trustLevel) + '20' }]}>
                    <View style={[styles.trustDot, { backgroundColor: getTrustLevelColor(mint.trustLevel) }]} />
                    <Text style={[styles.trustLabel, { color: getTrustLevelColor(mint.trustLevel) }]}>
                      {getTrustLevelLabel(mint.trustLevel)}
                    </Text>
                  </View>
                  <Text style={styles.proofCount}>
                    {mint.proofCount} proof{mint.proofCount !== 1 ? 's' : ''}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Help Text */}
      <Text style={styles.helpText}>
        Long press on a mint to delete it (only if balance is 0)
      </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  loadingText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
  },
  summaryCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
  summaryLabel: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  summaryAmount: {
    ...theme.typography.amount,
    fontSize: theme.fontSize['4xl'],
    color: theme.colors.text.primary,
  },
  summaryUnit: {
    ...theme.typography.currencyUnit,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  mintCount: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.md,
  },
  actionButtons: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  discoverButton: {
    marginBottom: 0,
  },
  addButton: {
    marginBottom: 0,
  },
  mintList: {
    gap: theme.spacing.md,
  },
  mintCard: {
    marginBottom: theme.spacing.sm,
  },
  mintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  mintInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  mintName: {
    ...theme.typography.h3,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  mintUrl: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  mintBalance: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    ...theme.typography.amount,
    fontSize: theme.fontSize.xl,
    color: theme.colors.text.primary,
  },
  balanceUnit: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  mintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  trustDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.xs,
  },
  trustLabel: {
    ...theme.typography.caption,
    fontFamily: theme.fontFamily.medium,
  },
  proofCount: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.h3,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyHint: {
    ...theme.typography.caption,
    color: theme.colors.primary[500],
    textAlign: 'center',
  },
  helpText: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
});

export default MintManagementScreen;
