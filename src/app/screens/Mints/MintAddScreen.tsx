/**
 * Add Mint Screen
 *
 * Allows users to add a new Cashu mint by:
 * 1. Entering a custom URL
 * 2. Discovering from a curated list of popular mints
 *
 * Features:
 * - Mint validation and info preview
 * - Health checking for discovered mints
 * - Categorization (Mainnet/Testnet)
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
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CashuMint } from '@cashu/cashu-ts';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import MintRepository from '../../../data/repositories/MintRepository';
import { MintRegistry, PublicMint, MintHealth } from '../../../core/cashu/MintRegistry';
import { TrustLevel } from '../../../types';

type AddMode = 'url' | 'discover';
type MintCategory = 'all' | 'mainnet' | 'testnet';

interface DiscoveredMint extends PublicMint {
  health?: MintHealth;
  isAdded?: boolean;
}

export function MintAddScreen() {
  const navigation = useNavigation();

  // Mode state
  const [mode, setMode] = useState<AddMode>('discover');
  const [category, setCategory] = useState<MintCategory>('mainnet');

  // URL input state
  const [mintUrl, setMintUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [mintInfo, setMintInfo] = useState<any>(null);

  // Discovery state
  const [discoveredMints, setDiscoveredMints] = useState<DiscoveredMint[]>([]);
  const [loadingDiscovery, setLoadingDiscovery] = useState(true);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDiscoveredMints();
  }, []);

  const loadDiscoveredMints = async () => {
    try {
      const registry = MintRegistry.getInstance();
      const mintRepo = MintRepository.getInstance();

      // Get curated mints
      const mints = registry.getCuratedMints();

      // Check which mints are already added
      const addedMints = await mintRepo.getAll();
      const addedUrls = new Set(addedMints.map(m => m.url));

      const mintsWithStatus: DiscoveredMint[] = mints.map(mint => ({
        ...mint,
        isAdded: addedUrls.has(mint.url),
      }));

      setDiscoveredMints(mintsWithStatus);
    } catch (error) {
      console.error('[MintAdd] Failed to load discovered mints:', error);
    } finally {
      setLoadingDiscovery(false);
    }
  };

  const handleCheckHealth = async () => {
    setCheckingHealth(true);

    try {
      const registry = MintRegistry.getInstance();
      const healthResults = await registry.checkAllMintsHealth();
      const healthMap = new Map(healthResults.map(h => [h.url, h]));

      setDiscoveredMints(prev =>
        prev.map(mint => ({
          ...mint,
          health: healthMap.get(mint.url),
        }))
      );
    } catch (error) {
      console.error('[MintAdd] Health check failed:', error);
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDiscoveredMints();
    setRefreshing(false);
  };

  const validateAndFetchMint = async (url: string) => {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    normalizedUrl = normalizedUrl.replace(/\/$/, '');

    setLoading(true);
    setMintInfo(null);

    try {
      const mintRepo = MintRepository.getInstance();
      const exists = await mintRepo.exists(normalizedUrl);
      if (exists) {
        Alert.alert('Mint Already Added', 'This mint is already in your wallet.');
        setLoading(false);
        return;
      }

      const mint = new CashuMint(normalizedUrl);
      const info = await mint.getInfo();
      const keysets = await mint.getKeySets();

      setMintInfo({
        url: normalizedUrl,
        name: info.name || 'Unknown Mint',
        description: info.description,
        version: info.version,
        motd: info.motd,
        keysetCount: keysets.keysets?.length || 0,
        pubkey: info.pubkey,
        nuts: info.nuts,
      });
    } catch (error: any) {
      console.error('[MintAdd] Failed to fetch mint info:', error);
      Alert.alert(
        'Connection Failed',
        `Could not connect to mint at ${normalizedUrl}.\n\nError: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddMint = async (url: string, name: string, description?: string) => {
    setLoading(true);

    try {
      const mintRepo = MintRepository.getInstance();

      // Check if already exists
      const exists = await mintRepo.exists(url);
      if (exists) {
        Alert.alert('Already Added', 'This mint is already in your wallet.');
        setLoading(false);
        return;
      }

      await mintRepo.create({
        url,
        name,
        description,
        trustLevel: TrustLevel.LOW,
        lastSyncedAt: Date.now(),
      });

      // Refresh the list
      await loadDiscoveredMints();

      Alert.alert(
        'Mint Added',
        `Successfully added "${name}" to your wallet.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('[MintAdd] Failed to add mint:', error);
      Alert.alert('Error', `Failed to add mint: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFromInfo = async () => {
    if (!mintInfo) return;
    await handleAddMint(mintInfo.url, mintInfo.name, mintInfo.description);
    setMintInfo(null);
    setMintUrl('');
    navigation.goBack();
  };

  const handleAddDiscoveredMint = async (mint: DiscoveredMint) => {
    await handleAddMint(mint.url, mint.name, mint.description);
  };

  const getFilteredMints = (): DiscoveredMint[] => {
    switch (category) {
      case 'mainnet':
        return discoveredMints.filter(m => !m.isTestnet);
      case 'testnet':
        return discoveredMints.filter(m => m.isTestnet);
      default:
        return discoveredMints;
    }
  };

  const renderHealthIndicator = (health?: MintHealth) => {
    if (!health) return null;

    const color = health.healthy ? theme.colors.status.success : theme.colors.status.error;
    const text = health.healthy
      ? `${health.responseTime}ms`
      : 'Offline';

    return (
      <View style={[styles.healthBadge, { backgroundColor: color + '20' }]}>
        <View style={[styles.healthDot, { backgroundColor: color }]} />
        <Text style={[styles.healthText, { color }]}>{text}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        mode === 'discover' ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary[500]}
          />
        ) : undefined
      }
    >
      {/* Mode Selector */}
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'discover' && styles.modeTabActive]}
          onPress={() => setMode('discover')}
        >
          <Text style={[styles.modeText, mode === 'discover' && styles.modeTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'url' && styles.modeTabActive]}
          onPress={() => setMode('url')}
        >
          <Text style={[styles.modeText, mode === 'url' && styles.modeTextActive]}>
            Enter URL
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'url' ? (
        /* URL INPUT MODE */
        <>
          <Card style={styles.inputCard}>
            <Text style={styles.label}>Mint URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://mint.example.com"
              placeholderTextColor={theme.colors.text.tertiary}
              value={mintUrl}
              onChangeText={setMintUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!loading}
            />
            <Button
              onPress={() => validateAndFetchMint(mintUrl)}
              disabled={!mintUrl.trim() || loading}
              style={styles.checkButton}
            >
              {loading ? 'Checking...' : 'Check Mint'}
            </Button>
          </Card>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary[500]} />
              <Text style={styles.loadingText}>Connecting to mint...</Text>
            </View>
          )}

          {mintInfo && !loading && (
            <Card style={styles.previewCard}>
              <Text style={styles.previewTitle}>Mint Found</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{mintInfo.name}</Text>
              </View>

              {mintInfo.description && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Description</Text>
                  <Text style={styles.infoValue}>{mintInfo.description}</Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Version</Text>
                <Text style={styles.infoValue}>{mintInfo.version || 'Unknown'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Keysets</Text>
                <Text style={styles.infoValue}>{mintInfo.keysetCount} available</Text>
              </View>

              {mintInfo.nuts && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NUTs</Text>
                  <Text style={styles.infoValue}>
                    {Object.keys(mintInfo.nuts).slice(0, 5).join(', ')}
                    {Object.keys(mintInfo.nuts).length > 5 ? '...' : ''}
                  </Text>
                </View>
              )}

              {mintInfo.motd && (
                <View style={styles.motdContainer}>
                  <Text style={styles.motdLabel}>Message:</Text>
                  <Text style={styles.motdText}>{mintInfo.motd}</Text>
                </View>
              )}

              <Button onPress={handleAddFromInfo} style={styles.addButton}>
                Add This Mint
              </Button>
            </Card>
          )}
        </>
      ) : (
        /* DISCOVERY MODE */
        <>
          {/* Category Filter */}
          <View style={styles.categorySelector}>
            {(['mainnet', 'testnet'] as MintCategory[]).map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryTab, category === cat && styles.categoryTabActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                  {cat === 'mainnet' ? 'Mainnet' : 'Testnet'}
                </Text>
              </TouchableOpacity>
            ))}
            <Button
              variant="secondary"
              onPress={handleCheckHealth}
              disabled={checkingHealth}
              style={styles.healthButton}
            >
              {checkingHealth ? 'Checking...' : 'Check Health'}
            </Button>
          </View>

          {loadingDiscovery ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary[500]} />
              <Text style={styles.loadingText}>Loading mints...</Text>
            </View>
          ) : (
            <View style={styles.mintList}>
              {getFilteredMints().map((mint, index) => (
                <Card key={index} style={styles.discoveryCard}>
                  <View style={styles.mintHeader}>
                    <View style={styles.mintTitleRow}>
                      <Text style={styles.mintName}>{mint.name}</Text>
                      {mint.isRecommended && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedText}>Recommended</Text>
                        </View>
                      )}
                      {mint.isTestnet && (
                        <View style={styles.testnetBadge}>
                          <Text style={styles.testnetText}>Testnet</Text>
                        </View>
                      )}
                    </View>
                    {renderHealthIndicator(mint.health)}
                  </View>

                  {mint.description && (
                    <Text style={styles.mintDescription}>{mint.description}</Text>
                  )}

                  <View style={styles.mintMeta}>
                    {mint.operator && (
                      <Text style={styles.mintOperator}>by {mint.operator}</Text>
                    )}
                    {mint.region && (
                      <Text style={styles.mintRegion}>{mint.region}</Text>
                    )}
                  </View>

                  <Text style={styles.mintUrl} numberOfLines={1}>{mint.url}</Text>

                  {mint.features && mint.features.length > 0 && (
                    <View style={styles.featuresRow}>
                      {mint.features.slice(0, 4).map((feature, i) => (
                        <View key={i} style={styles.featureBadge}>
                          <Text style={styles.featureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <Button
                    onPress={() => handleAddDiscoveredMint(mint)}
                    disabled={mint.isAdded || loading}
                    variant={mint.isAdded ? 'secondary' : 'primary'}
                    style={styles.addDiscoveredButton}
                  >
                    {mint.isAdded ? 'Already Added' : 'Add Mint'}
                  </Button>
                </Card>
              ))}
            </View>
          )}
        </>
      )}

      {/* Warning */}
      <Card style={styles.warningCard}>
        <Text style={styles.warningTitle}>Trust Warning</Text>
        <Text style={styles.warningText}>
          Cashu mints are custodial services. Only deposit amounts you're willing to lose.
          The mint operator could potentially run away with funds.
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
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xs,
    marginTop: theme.spacing.lg,
  },
  modeTab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  modeTabActive: {
    backgroundColor: theme.colors.primary[500],
  },
  modeText: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
  },
  modeTextActive: {
    color: theme.colors.text.inverse,
    fontFamily: theme.fontFamily.bold,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  categoryTab: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background.secondary,
  },
  categoryTabActive: {
    backgroundColor: theme.colors.primary[500],
  },
  categoryText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  categoryTextActive: {
    color: theme.colors.text.inverse,
    fontFamily: theme.fontFamily.bold,
  },
  healthButton: {
    marginLeft: 'auto',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  inputCard: {
    marginTop: theme.spacing.lg,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  input: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  checkButton: {
    marginTop: theme.spacing.sm,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  loadingText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.md,
  },
  previewCard: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.background.secondary,
  },
  previewTitle: {
    ...theme.typography.h3,
    color: theme.colors.status.success,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  infoLabel: {
    ...theme.typography.label,
    color: theme.colors.text.tertiary,
    flex: 1,
  },
  infoValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.primary,
    flex: 2,
    textAlign: 'right',
  },
  motdContainer: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.md,
  },
  motdLabel: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing.xs,
  },
  motdText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
  },
  addButton: {
    marginTop: theme.spacing.lg,
  },
  mintList: {
    gap: theme.spacing.md,
  },
  discoveryCard: {
    marginBottom: theme.spacing.sm,
  },
  mintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  mintTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    gap: theme.spacing.xs,
  },
  mintName: {
    ...theme.typography.labelLarge,
    color: theme.colors.text.primary,
  },
  recommendedBadge: {
    backgroundColor: theme.colors.status.success + '20',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  recommendedText: {
    ...theme.typography.caption,
    color: theme.colors.status.success,
    fontSize: 10,
  },
  testnetBadge: {
    backgroundColor: theme.colors.status.warning + '20',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  testnetText: {
    ...theme.typography.caption,
    color: theme.colors.status.warning,
    fontSize: 10,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: theme.spacing.xs,
  },
  healthText: {
    ...theme.typography.caption,
    fontSize: 10,
  },
  mintDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  mintMeta: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  mintOperator: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  mintRegion: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  mintUrl: {
    ...theme.typography.mono,
    fontSize: 11,
    color: theme.colors.primary[500],
    marginBottom: theme.spacing.sm,
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  featureBadge: {
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  featureText: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    fontSize: 10,
  },
  addDiscoveredButton: {
    marginTop: theme.spacing.sm,
  },
  warningCard: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.status.warning + '15',
    borderColor: theme.colors.status.warning,
    borderWidth: 1,
  },
  warningTitle: {
    ...theme.typography.labelLarge,
    color: theme.colors.status.warning,
    marginBottom: theme.spacing.sm,
  },
  warningText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
  },
});

export default MintAddScreen;
