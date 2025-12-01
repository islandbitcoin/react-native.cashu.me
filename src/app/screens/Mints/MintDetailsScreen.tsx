/**
 * Mint Details Screen
 *
 * Shows detailed information about a specific mint including:
 * - Balance and proof count
 * - Trust level configuration
 * - Mint info (name, description, version)
 * - Supported NUTs
 * - Keyset information
 * - Health check
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import MintRepository from '../../../data/repositories/MintRepository';
import ProofRepository from '../../../data/repositories/ProofRepository';
import { MintDiscovery, MintInfo } from '../../../core/cashu/MintDiscovery';
import { Mint, TrustLevel, MintKeyset } from '../../../types';

interface RouteParams {
  mintId: string;
}

export function MintDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { mintId } = route.params;

  const [mint, setMint] = useState<Mint | null>(null);
  const [mintInfo, setMintInfo] = useState<MintInfo | null>(null);
  const [keysets, setKeysets] = useState<MintKeyset[]>([]);
  const [balance, setBalance] = useState(0);
  const [proofCount, setProofCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{ healthy: boolean; responseTime?: number } | null>(null);

  const loadMintDetails = async () => {
    try {
      const mintRepo = MintRepository.getInstance();
      const proofRepo = ProofRepository.getInstance();
      const discovery = MintDiscovery.getInstance();

      // Load mint from database
      const loadedMint = await mintRepo.getById(mintId);
      if (!loadedMint) {
        Alert.alert('Error', 'Mint not found');
        navigation.goBack();
        return;
      }
      setMint(loadedMint);

      // Load balance and proof count
      const mintBalance = proofRepo.getBalance(loadedMint.url);
      setBalance(mintBalance);

      const proofs = await proofRepo.getAll({ mintUrl: loadedMint.url });
      setProofCount(proofs?.length || 0);

      // Load keysets
      const mintKeysets = await mintRepo.getKeysets({ mintId });
      setKeysets(mintKeysets);

      // Try to fetch fresh mint info (non-blocking)
      try {
        const info = await discovery.fetchMintInfo(loadedMint.url);
        setMintInfo(info);
      } catch (e) {
        // Use cached info from mint if available
        if (loadedMint.info) {
          setMintInfo({
            url: loadedMint.url,
            name: loadedMint.info.name,
            description: loadedMint.info.description,
            version: loadedMint.info.version,
            publicKey: loadedMint.info.pubkey,
            nuts: loadedMint.info.nuts as Record<string, any>,
          });
        }
      }
    } catch (error) {
      console.error('[MintDetails] Failed to load mint:', error);
      Alert.alert('Error', 'Failed to load mint details');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMintDetails();
    }, [mintId])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMintDetails();
    setRefreshing(false);
  };

  const handleHealthCheck = async () => {
    if (!mint) return;

    setHealthChecking(true);
    setHealthStatus(null);

    try {
      const discovery = MintDiscovery.getInstance();
      const result = await discovery.checkMintHealth(mint.url);
      setHealthStatus(result);
    } catch (error) {
      setHealthStatus({ healthy: false });
    } finally {
      setHealthChecking(false);
    }
  };

  const handleSyncKeysets = async () => {
    if (!mint) return;

    try {
      const discovery = MintDiscovery.getInstance();
      const result = await discovery.syncKeysets(mint.id, mint.url);

      Alert.alert(
        'Sync Complete',
        `Added: ${result.added}\nUpdated: ${result.updated}\nDeactivated: ${result.deactivated}`,
        [{ text: 'OK', onPress: loadMintDetails }]
      );
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message);
    }
  };

  const handleChangeTrustLevel = () => {
    if (!mint) return;

    const options: { text: string; onPress?: () => void; style?: 'destructive' | 'cancel' }[] = [
      { text: 'Cancel', style: 'cancel' },
      { text: 'High Trust', onPress: () => updateTrustLevel(TrustLevel.HIGH) },
      { text: 'Medium Trust', onPress: () => updateTrustLevel(TrustLevel.MEDIUM) },
      { text: 'Low Trust', onPress: () => updateTrustLevel(TrustLevel.LOW) },
      { text: 'Untrusted', onPress: () => updateTrustLevel(TrustLevel.UNTRUSTED) },
    ];

    Alert.alert('Change Trust Level', 'Select the trust level for this mint:', options);
  };

  const updateTrustLevel = async (level: TrustLevel) => {
    if (!mint) return;

    try {
      const mintRepo = MintRepository.getInstance();
      await mintRepo.update(mint.id, { trustLevel: level });
      await loadMintDetails();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update trust level');
    }
  };

  const handleDeleteMint = async () => {
    if (!mint) return;

    if (balance > 0) {
      Alert.alert(
        'Cannot Delete',
        `This mint has a balance of ${balance} sats. Please transfer or spend these tokens first.`
      );
      return;
    }

    Alert.alert(
      'Delete Mint',
      `Are you sure you want to remove "${mint.name || mint.url}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const mintRepo = MintRepository.getInstance();
              await mintRepo.delete(mint.id);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete mint');
            }
          },
        },
      ]
    );
  };

  const handleOpenUrl = async () => {
    if (!mint) return;

    try {
      await Linking.openURL(mint.url);
    } catch (error) {
      Alert.alert('Error', 'Could not open URL');
    }
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
        return theme.colors.status.error;
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

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const getSupportedNuts = (): string[] => {
    if (!mintInfo?.nuts) return [];
    return Object.keys(mintInfo.nuts).sort((a, b) => {
      const numA = parseInt(a.replace('NUT-', '').replace(/\D/g, ''));
      const numB = parseInt(b.replace('NUT-', '').replace(/\D/g, ''));
      return numA - numB;
    });
  };

  if (loading || !mint) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading mint details...</Text>
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
      {/* Balance Card */}
      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text style={styles.balanceAmount}>{balance.toLocaleString()}</Text>
        <Text style={styles.balanceUnit}>sats</Text>
        <Text style={styles.proofCount}>{proofCount} proof{proofCount !== 1 ? 's' : ''}</Text>
      </Card>

      {/* Mint Info Card */}
      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Mint Information</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Name</Text>
          <Text style={styles.infoValue}>{mintInfo?.name || mint.name || 'Unknown'}</Text>
        </View>

        <TouchableOpacity onPress={handleOpenUrl}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>URL</Text>
            <Text style={[styles.infoValue, styles.linkText]} numberOfLines={1}>
              {mint.url}
            </Text>
          </View>
        </TouchableOpacity>

        {mintInfo?.description && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Description</Text>
            <Text style={styles.infoValue}>{mintInfo.description}</Text>
          </View>
        )}

        {mintInfo?.version && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>{mintInfo.version}</Text>
          </View>
        )}

        {mintInfo?.publicKey && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Public Key</Text>
            <Text style={[styles.infoValue, styles.monoText]} numberOfLines={1}>
              {mintInfo.publicKey.substring(0, 20)}...
            </Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Last Synced</Text>
          <Text style={styles.infoValue}>{formatDate(mint.lastSyncedAt)}</Text>
        </View>
      </Card>

      {/* Trust Level Card */}
      <Card style={styles.trustCard}>
        <View style={styles.trustHeader}>
          <Text style={styles.sectionTitle}>Trust Level</Text>
          <TouchableOpacity onPress={handleChangeTrustLevel}>
            <Text style={styles.changeButton}>Change</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.trustBadge, { backgroundColor: getTrustLevelColor(mint.trustLevel) + '20' }]}>
          <View style={[styles.trustDot, { backgroundColor: getTrustLevelColor(mint.trustLevel) }]} />
          <Text style={[styles.trustLabel, { color: getTrustLevelColor(mint.trustLevel) }]}>
            {getTrustLevelLabel(mint.trustLevel)}
          </Text>
        </View>

        <Text style={styles.trustDescription}>
          {mint.trustLevel === TrustLevel.HIGH
            ? 'You fully trust this mint. Use with caution - the mint operator can rug your funds.'
            : mint.trustLevel === TrustLevel.MEDIUM
            ? 'Moderate trust. Good for regular use but keep balances reasonable.'
            : mint.trustLevel === TrustLevel.LOW
            ? 'Low trust. Only use for small amounts or testing.'
            : 'Untrusted. Verify the mint operator before depositing significant funds.'}
        </Text>
      </Card>

      {/* Health Check Card */}
      <Card style={styles.healthCard}>
        <Text style={styles.sectionTitle}>Connection Status</Text>

        {healthStatus && (
          <View style={styles.healthStatus}>
            <View
              style={[
                styles.healthDot,
                { backgroundColor: healthStatus.healthy ? theme.colors.status.success : theme.colors.status.error },
              ]}
            />
            <Text style={styles.healthText}>
              {healthStatus.healthy
                ? `Online (${healthStatus.responseTime}ms)`
                : 'Offline or unreachable'}
            </Text>
          </View>
        )}

        <Button
          onPress={handleHealthCheck}
          variant="secondary"
          disabled={healthChecking}
          style={styles.healthButton}
        >
          {healthChecking ? 'Checking...' : 'Check Health'}
        </Button>
      </Card>

      {/* Supported NUTs Card */}
      {getSupportedNuts().length > 0 && (
        <Card style={styles.nutsCard}>
          <Text style={styles.sectionTitle}>Supported Features (NUTs)</Text>
          <View style={styles.nutsList}>
            {getSupportedNuts().map((nut) => (
              <View key={nut} style={styles.nutBadge}>
                <Text style={styles.nutText}>{nut}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Keysets Card */}
      <Card style={styles.keysetsCard}>
        <View style={styles.keysetsHeader}>
          <Text style={styles.sectionTitle}>Keysets ({keysets.length})</Text>
          <TouchableOpacity onPress={handleSyncKeysets}>
            <Text style={styles.changeButton}>Sync</Text>
          </TouchableOpacity>
        </View>

        {keysets.length === 0 ? (
          <Text style={styles.noKeysets}>No keysets found. Try syncing.</Text>
        ) : (
          keysets.map((keyset) => (
            <View key={keyset.id} style={styles.keysetRow}>
              <View style={styles.keysetInfo}>
                <Text style={[styles.keysetId, styles.monoText]} numberOfLines={1}>
                  {keyset.keysetId}
                </Text>
                <Text style={styles.keysetUnit}>{keyset.unit}</Text>
              </View>
              <View
                style={[
                  styles.keysetStatus,
                  { backgroundColor: keyset.active ? theme.colors.status.success : theme.colors.text.tertiary },
                ]}
              >
                <Text style={styles.keysetStatusText}>{keyset.active ? 'Active' : 'Inactive'}</Text>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* Danger Zone */}
      <Card style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <Button
          onPress={handleDeleteMint}
          variant="secondary"
          style={styles.deleteButton}
        >
          Delete Mint
        </Button>
        <Text style={styles.dangerText}>
          {balance > 0
            ? `Cannot delete while balance is ${balance} sats`
            : 'This will remove the mint and all associated data'}
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
  balanceCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
  balanceLabel: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  balanceAmount: {
    ...theme.typography.amount,
    fontSize: theme.fontSize['4xl'],
    color: theme.colors.text.primary,
  },
  balanceUnit: {
    ...theme.typography.currencyUnit,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  proofCount: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.md,
  },
  infoCard: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  infoLabel: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  infoValue: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
    flex: 2,
    textAlign: 'right',
  },
  linkText: {
    color: theme.colors.primary[500],
  },
  monoText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: theme.fontSize.xs,
  },
  trustCard: {
    marginTop: theme.spacing.md,
  },
  trustHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  changeButton: {
    ...theme.typography.label,
    color: theme.colors.primary[500],
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.md,
  },
  trustDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: theme.spacing.sm,
  },
  trustLabel: {
    ...theme.typography.labelLarge,
    fontFamily: theme.fontFamily.medium,
  },
  trustDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
  },
  healthCard: {
    marginTop: theme.spacing.md,
  },
  healthStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  healthDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.sm,
  },
  healthText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
  },
  healthButton: {
    marginTop: theme.spacing.sm,
  },
  nutsCard: {
    marginTop: theme.spacing.md,
  },
  nutsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  nutBadge: {
    backgroundColor: theme.colors.primary[500] + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  nutText: {
    ...theme.typography.caption,
    color: theme.colors.primary[500],
    fontFamily: theme.fontFamily.medium,
  },
  keysetsCard: {
    marginTop: theme.spacing.md,
  },
  keysetsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  noKeysets: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  keysetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  keysetInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  keysetId: {
    ...theme.typography.caption,
    color: theme.colors.text.primary,
  },
  keysetUnit: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xs,
  },
  keysetStatus: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  keysetStatusText: {
    ...theme.typography.caption,
    color: theme.colors.text.inverse,
    fontFamily: theme.fontFamily.medium,
  },
  dangerCard: {
    marginTop: theme.spacing.xl,
    borderColor: theme.colors.status.error + '40',
    borderWidth: 1,
  },
  dangerTitle: {
    ...theme.typography.h4,
    color: theme.colors.status.error,
    marginBottom: theme.spacing.md,
  },
  deleteButton: {
    borderColor: theme.colors.status.error,
  },
  dangerText: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
});

export default MintDetailsScreen;
