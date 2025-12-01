/**
 * History Screen
 *
 * Displays all transactions with filtering capabilities.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import TransactionRepository from '../../../data/repositories/TransactionRepository';
import {
  TransactionType,
  TransactionStatus,
  TransactionDirection,
  Transaction as BaseTransaction,
} from '../../../types';

// Extend base transaction with required fields for display
interface Transaction extends BaseTransaction {
  direction: TransactionDirection;
  proofCount: number;
}

type FilterType = 'all' | 'send' | 'receive' | 'lightning';

export function HistoryScreen() {
  const navigation = useNavigation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadTransactions = async () => {
    try {
      const txRepo = TransactionRepository.getInstance();
      let baseTxs: BaseTransaction[];

      switch (filter) {
        case 'send':
          baseTxs = await txRepo.getAll({ type: TransactionType.SEND });
          break;
        case 'receive':
          baseTxs = await txRepo.getAll({ type: TransactionType.RECEIVE });
          break;
        case 'lightning':
          baseTxs = await txRepo.getAll({ type: TransactionType.LIGHTNING });
          break;
        default:
          baseTxs = await txRepo.getAll();
      }

      // Add default values for display fields
      const txs: Transaction[] = baseTxs.map(tx => ({
        ...tx,
        direction: tx.direction || (tx.type === TransactionType.RECEIVE || tx.type === TransactionType.MINT
          ? TransactionDirection.INCOMING
          : TransactionDirection.OUTGOING),
        proofCount: tx.proofCount || 0,
      }));

      // Sort by creation date, newest first
      txs.sort((a, b) => b.createdAt - a.createdAt);
      setTransactions(txs);
    } catch (error) {
      console.error('[History] Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [filter])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const getTypeIcon = (type: TransactionType, direction: TransactionDirection): string => {
    if (type === TransactionType.LIGHTNING) {
      return direction === TransactionDirection.INCOMING ? '⚡↓' : '⚡↑';
    }
    if (type === TransactionType.RECEIVE) return '↓';
    if (type === TransactionType.SEND) return '↑';
    if (type === TransactionType.SWAP) return '↔';
    return '•';
  };

  const getTypeLabel = (type: TransactionType): string => {
    switch (type) {
      case TransactionType.RECEIVE:
        return 'Received';
      case TransactionType.SEND:
        return 'Sent';
      case TransactionType.LIGHTNING:
        return 'Lightning';
      case TransactionType.SWAP:
        return 'Swap';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: TransactionStatus): string => {
    switch (status) {
      case TransactionStatus.COMPLETED:
        return theme.colors.status.success;
      case TransactionStatus.PENDING:
        return theme.colors.status.warning;
      case TransactionStatus.FAILED:
        return theme.colors.status.error;
      default:
        return theme.colors.text.tertiary;
    }
  };

  const getStatusLabel = (status: TransactionStatus): string => {
    switch (status) {
      case TransactionStatus.COMPLETED:
        return 'Completed';
      case TransactionStatus.PENDING:
        return 'Pending';
      case TransactionStatus.FAILED:
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getMintName = (url: string): string => {
    try {
      // Extract hostname from URL using regex (React Native URL doesn't have hostname)
      const match = url.match(/^https?:\/\/([^\/]+)/);
      if (match && match[1]) {
        const hostname = match[1];
        return hostname.split('.')[0] || hostname;
      }
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isIncoming = item.direction === TransactionDirection.INCOMING;
    const amountColor = isIncoming ? theme.colors.status.success : theme.colors.text.primary;
    const amountPrefix = isIncoming ? '+' : '-';

    return (
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('TransactionDetails' as never, { transactionId: item.id } as never)
        }
      >
        <Card style={styles.txCard}>
          <View style={styles.txRow}>
            <View style={styles.txLeft}>
              <View style={styles.txIconContainer}>
                <Text style={styles.txIcon}>
                  {getTypeIcon(item.type, item.direction)}
                </Text>
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txType}>{getTypeLabel(item.type)}</Text>
                <Text style={styles.txMint}>{getMintName(item.mintUrl)}</Text>
              </View>
            </View>
            <View style={styles.txRight}>
              <Text style={[styles.txAmount, { color: amountColor }]}>
                {amountPrefix}{item.amount.toLocaleString()}
              </Text>
              <Text style={styles.txSats}>sats</Text>
            </View>
          </View>
          <View style={styles.txFooter}>
            <View style={styles.txStatus}>
              <View
                style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]}
              />
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
            <Text style={styles.txDate}>{formatDate(item.createdAt)}</Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <Card style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>No Transactions</Text>
      <Text style={styles.emptyText}>
        {filter === 'all'
          ? "You haven't made any transactions yet."
          : `No ${filter} transactions found.`}
      </Text>
    </Card>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'receive', 'send', 'lightning'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary[500]}
          />
        }
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
  },
  listContent: {
    padding: theme.screenPadding.horizontal,
    paddingBottom: theme.spacing['2xl'],
  },
  header: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xs,
  },
  filterTab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  filterTabActive: {
    backgroundColor: theme.colors.primary[500],
  },
  filterText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    fontFamily: theme.fontFamily.medium,
  },
  filterTextActive: {
    color: theme.colors.text.inverse,
  },
  summary: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  summaryText: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  txCard: {
    marginBottom: theme.spacing.sm,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  txIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  txIcon: {
    fontSize: 18,
  },
  txInfo: {
    flex: 1,
  },
  txType: {
    ...theme.typography.labelLarge,
    color: theme.colors.text.primary,
  },
  txMint: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    ...theme.typography.amount,
    fontSize: theme.fontSize.lg,
  },
  txSats: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  txFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.primary,
  },
  txStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.xs,
  },
  statusText: {
    ...theme.typography.caption,
    fontFamily: theme.fontFamily.medium,
  },
  txDate: {
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
  },
});

export default HistoryScreen;
