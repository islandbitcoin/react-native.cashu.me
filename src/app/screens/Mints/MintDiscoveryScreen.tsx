/**
 * Mint Discovery Screen
 *
 * Browse and discover public Cashu mints with infinite scroll.
 * Features:
 * - Infinite scroll like social media
 * - Search mints
 * - Health status indicators
 * - One-tap add
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItem,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { MintDirectory, DirectoryMint } from '../../../core/cashu/MintDirectory';
import { MintDiscovery } from '../../../core/cashu/MintDiscovery';
import { SettingsStackParamList } from '../../navigation/types';
import { TrustLevel } from '../../../types';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'MintDiscovery'>;

export function MintDiscoveryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [mints, setMints] = useState<DirectoryMint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DirectoryMint[] | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [addingMint, setAddingMint] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<Map<string, boolean>>(new Map());
  const [mintIcons, setMintIcons] = useState<Map<string, string | null>>(new Map());
  const [loadingIcons, setLoadingIcons] = useState<Set<string>>(new Set());

  const mintDirectory = MintDirectory.getInstance();
  const mintDiscovery = MintDiscovery.getInstance();

  // Load initial mints
  useEffect(() => {
    loadInitialMints();
  }, []);

  // Fetch icons for visible mints
  useEffect(() => {
    const mintsToFetch = mints.filter(
      mint => !mint.iconUrl && !mintIcons.has(mint.url) && !loadingIcons.has(mint.url)
    );

    // Fetch icons in batches to avoid too many concurrent requests
    mintsToFetch.slice(0, 5).forEach(mint => {
      fetchMintIcon(mint);
    });
  }, [mints, mintIcons, loadingIcons]);

  // Fetch icon for a mint (if not already loaded)
  const fetchMintIcon = useCallback(async (mint: DirectoryMint) => {
    // Skip if already have icon, already loading, or mint has static icon
    if (mint.iconUrl || mintIcons.has(mint.url) || loadingIcons.has(mint.url)) {
      return;
    }

    setLoadingIcons(prev => new Set(prev).add(mint.url));

    try {
      const info = await mintDiscovery.fetchMintInfo(mint.url);
      setMintIcons(prev => new Map(prev).set(mint.url, info.iconUrl || null));
    } catch (error) {
      // Failed to fetch, mark as no icon
      setMintIcons(prev => new Map(prev).set(mint.url, null));
    } finally {
      setLoadingIcons(prev => {
        const next = new Set(prev);
        next.delete(mint.url);
        return next;
      });
    }
  }, [mintIcons, loadingIcons]);

  // Handle search
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = mintDirectory.searchMints(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults(null);
    }
  }, [searchQuery]);

  const loadInitialMints = async () => {
    setLoading(true);
    try {
      const result = mintDirectory.getProductionMintsPaginated(0);
      setMints(result.mints);
      setHasMore(result.hasMore);
      setCurrentPage(result.nextPage);
    } catch (error) {
      console.error('Failed to load mints:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMints = useCallback(async () => {
    if (loadingMore || !hasMore || searchResults !== null) return;

    setLoadingMore(true);
    try {
      // Simulate network delay for smoother UX
      await new Promise<void>(resolve => setTimeout(resolve, 500));

      const result = mintDirectory.getProductionMintsPaginated(currentPage);
      setMints(prev => [...prev, ...result.mints]);
      setHasMore(result.hasMore);
      setCurrentPage(result.nextPage);
    } catch (error) {
      console.error('Failed to load more mints:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [currentPage, hasMore, loadingMore, searchResults]);

  const handleAddMint = async (mint: DirectoryMint) => {
    setAddingMint(mint.url);

    try {
      const health = await mintDiscovery.checkMintHealth(mint.url);

      if (!health.healthy) {
        Alert.alert(
          'Mint Unavailable',
          `${mint.name} is currently unavailable. Would you like to add it anyway?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setAddingMint(null) },
            { text: 'Add Anyway', onPress: () => addMintToWallet(mint) },
          ]
        );
        return;
      }

      await addMintToWallet(mint);
    } catch (error) {
      Alert.alert('Error', 'Failed to check mint status');
      setAddingMint(null);
    }
  };

  const addMintToWallet = async (mint: DirectoryMint) => {
    try {
      const trustLevel = TrustLevel.MEDIUM;
      const result = await mintDiscovery.discoverMint(mint.url, trustLevel);

      if (result.success) {
        // Update health status to show it's been added
        setHealthStatus(prev => new Map(prev).set(mint.url, true));

        Alert.alert(
          'Mint Added',
          `${mint.name} has been added to your wallet.`,
          [
            { text: 'Done', onPress: () => navigation.goBack() },
            { text: 'Add More', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Failed', result.error || 'Could not add mint');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add mint';
      Alert.alert('Error', errorMessage);
    } finally {
      setAddingMint(null);
    }
  };

  const renderMintCard: ListRenderItem<DirectoryMint> = ({ item: mint }) => {
    const isAdding = addingMint === mint.url;
    const isHealthy = healthStatus.get(mint.url);
    const healthChecked = healthStatus.has(mint.url);

    // Get icon URL - either from mint data or fetched dynamically
    const iconUrl = mint.iconUrl || mintIcons.get(mint.url);
    const isLoadingIcon = loadingIcons.has(mint.url);

    return (
      <Card style={styles.mintCard}>
        <View style={styles.mintCardContent}>
          {/* Icon */}
          <View style={styles.mintIconContainer}>
            {iconUrl ? (
              <Image
                source={{ uri: iconUrl }}
                style={styles.mintIcon}
                resizeMode="cover"
              />
            ) : isLoadingIcon ? (
              <View style={styles.mintIconPlaceholder}>
                <ActivityIndicator size="small" color={theme.colors.text.tertiary} />
              </View>
            ) : (
              <View style={styles.mintIconPlaceholder}>
                <Text style={styles.mintIconLetter}>
                  {mint.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Content */}
          <View style={styles.mintContent}>
            <View style={styles.mintHeader}>
              <View style={styles.mintTitleRow}>
                <Text style={styles.mintName} numberOfLines={1}>{mint.name}</Text>
                {mint.isFeatured && (
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredBadgeText}>★ Featured</Text>
                  </View>
                )}
              </View>

              {healthChecked && (
                <View style={[
                  styles.healthIndicator,
                  { backgroundColor: isHealthy ? theme.colors.status.success : theme.colors.status.error }
                ]} />
              )}
            </View>

            {mint.description && (
              <Text style={styles.mintDescription} numberOfLines={2}>
                {mint.description}
              </Text>
            )}

            <Text style={styles.mintUrl} numberOfLines={1}>
              {mint.url}
            </Text>

            {mint.operator && (
              <Text style={styles.mintOperator}>
                by {mint.operator}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.mintFeatures}>
          {mint.features?.lightning && (
            <View style={styles.featureBadge}>
              <Text style={styles.featureText}>⚡ Lightning</Text>
            </View>
          )}
          {mint.nuts && mint.nuts.length > 0 && (
            <View style={styles.featureBadge}>
              <Text style={styles.featureText}>{mint.nuts.length} NUTs</Text>
            </View>
          )}
        </View>

        <Button
          onPress={() => handleAddMint(mint)}
          disabled={isAdding}
          style={styles.addButton}
        >
          {isAdding ? 'Adding...' : 'Add Mint'}
        </Button>
      </Card>
    );
  };

  const renderHeader = () => (
    <>
      {/* Info Card */}
      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>Discover Cashu Mints</Text>
        <Text style={styles.infoText}>
          Browse trusted mints to add to your wallet. Mints hold Bitcoin and issue ecash tokens.
        </Text>
        <Text style={styles.warningText}>
          ⚠️ Only deposit what you can afford to lose. Mints are custodial.
        </Text>
      </Card>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          {mintDirectory.getTotalProductionMints()} mints available
        </Text>
      </View>
    </>
  );

  const renderFooter = () => {
    if (!hasMore && !loadingMore) {
      return (
        <View style={styles.endCard}>
          <Text style={styles.endTitle}>That's all for now!</Text>
          <Text style={styles.endText}>
            Can't find what you're looking for?
          </Text>
          <Button
            variant="secondary"
            onPress={() => navigation.navigate('MintAdd')}
            style={styles.customMintButton}
          >
            Add Custom Mint by URL
          </Button>
          <View style={styles.sourcesSection}>
            <Text style={styles.sourcesTitle}>Discover more at:</Text>
            <Text style={styles.sourceLink}>• cashumints.space</Text>
            <Text style={styles.sourceLink}>• bitcoinmints.com</Text>
          </View>
        </View>
      );
    }

    if (loadingMore) {
      return (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color={theme.colors.primary[500]} />
          <Text style={styles.loadingMoreText}>Loading more mints...</Text>
        </View>
      );
    }

    return null;
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {searchQuery ? 'No mints match your search' : 'No mints available'}
      </Text>
    </View>
  );

  const displayMints = searchResults !== null ? searchResults : mints;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary[500]} />
        <Text style={styles.loadingText}>Loading mints...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search mints..."
          placeholderTextColor={theme.colors.text.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Mint List with Infinite Scroll */}
      <FlatList
        data={displayMints}
        renderItem={renderMintCard}
        keyExtractor={(item) => item.url}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={loadMoreMints}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
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
    marginTop: theme.spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.screenPadding.horizontal,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text.primary,
    ...theme.typography.bodyMedium,
  },
  clearButton: {
    marginLeft: theme.spacing.sm,
    padding: theme.spacing.sm,
  },
  clearButtonText: {
    color: theme.colors.text.tertiary,
    fontSize: theme.fontSize.lg,
  },
  listContent: {
    padding: theme.screenPadding.horizontal,
    paddingBottom: theme.spacing['2xl'],
  },
  infoCard: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary[500] + '10',
    borderColor: theme.colors.primary[500] + '30',
  },
  infoTitle: {
    ...theme.typography.h3,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  warningText: {
    ...theme.typography.bodySmall,
    color: theme.colors.status.warning,
  },
  statsRow: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  statsText: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  mintCard: {
    marginTop: theme.spacing.md,
  },
  mintCardContent: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  mintIconContainer: {
    marginRight: theme.spacing.md,
  },
  mintIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.tertiary,
  },
  mintIconPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mintIconLetter: {
    fontSize: theme.fontSize.xl,
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.text.secondary,
  },
  mintContent: {
    flex: 1,
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
    flex: 1,
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  mintName: {
    ...theme.typography.h3,
    color: theme.colors.text.primary,
  },
  featuredBadge: {
    backgroundColor: theme.colors.primary[500] + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  featuredBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.primary[500],
    fontFamily: theme.fontFamily.bold,
  },
  healthIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  mintDescription: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  mintUrl: {
    ...theme.typography.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing.sm,
  },
  mintOperator: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing.md,
  },
  mintFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  featureBadge: {
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  featureText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  addButton: {
    marginTop: theme.spacing.sm,
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  loadingMoreText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.tertiary,
  },
  emptyContainer: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.tertiary,
  },
  endCard: {
    marginTop: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.primary,
  },
  endTitle: {
    ...theme.typography.h3,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  endText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  customMintButton: {
    width: '100%',
    marginBottom: theme.spacing.lg,
  },
  sourcesSection: {
    alignItems: 'center',
  },
  sourcesTitle: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing.xs,
  },
  sourceLink: {
    ...theme.typography.caption,
    color: theme.colors.primary[500],
  },
});

export default MintDiscoveryScreen;
