/**
 * Transaction List Item
 *
 * Displays a transaction in a list.
 *
 * Features:
 * - Transaction type icon (send/receive/swap)
 * - Amount with +/- indicator
 * - Status indicator (completed/pending/failed)
 * - Timestamp
 * - Mint name
 * - Tap to view details
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { TransactionType, TransactionStatus } from '../../types';

export interface TransactionListItemProps {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  mintName?: string;
  timestamp: number;
  onPress?: (id: string) => void;
}

export function TransactionListItem({
  id,
  type,
  status,
  amount,
  mintName,
  timestamp,
  onPress,
}: TransactionListItemProps) {
  const isPositive = type === TransactionType.RECEIVE || type === TransactionType.MINT;
  const amountColor = isPositive ? theme.colors.semantic.received : theme.colors.semantic.sent;

  const statusColors: Record<TransactionStatus, string> = {
    [TransactionStatus.PENDING]: theme.colors.semantic.pending,
    [TransactionStatus.PROCESSING]: theme.colors.semantic.pending,
    [TransactionStatus.COMPLETED]: theme.colors.status.success,
    [TransactionStatus.FAILED]: theme.colors.status.error,
  };

  const statusColor = statusColors[status];

  const typeLabels: Record<TransactionType, string> = {
    [TransactionType.SEND]: 'Sent',
    [TransactionType.RECEIVE]: 'Received',
    [TransactionType.MINT]: 'Minted',
    [TransactionType.MELT]: 'Melted',
    [TransactionType.SWAP]: 'Swapped',
    [TransactionType.LIGHTNING]: 'Lightning',
  };

  const typeLabel = typeLabels[type];

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(id)}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Left: Icon */}
      <View style={[styles.iconContainer, { backgroundColor: `${amountColor}20` }]}>
        <View style={[styles.iconDot, { backgroundColor: amountColor }]} />
      </View>

      {/* Center: Details */}
      <View style={styles.details}>
        <View style={styles.row}>
          <Text style={styles.typeText}>{typeLabel}</Text>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>

        <View style={styles.row}>
          {mintName && (
            <Text style={styles.mintText} numberOfLines={1}>
              {mintName}
            </Text>
          )}
          <Text style={styles.timestamp}>{formatTimestamp(timestamp)}</Text>
        </View>
      </View>

      {/* Right: Amount */}
      <View style={styles.amountContainer}>
        <Text style={[styles.amountText, { color: amountColor }]}>
          {isPositive ? '+' : '-'}
          {Math.abs(amount).toLocaleString()}
        </Text>
        <Text style={styles.currencyText}>sats</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.secondary,
    borderBottomWidth: theme.borderWidth.thin,
    borderBottomColor: theme.colors.border.primary,
    minHeight: theme.listItem.height,
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },

  iconDot: {
    width: 12,
    height: 12,
    borderRadius: theme.borderRadius.full,
  },

  details: {
    flex: 1,
    justifyContent: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },

  typeText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
    fontWeight: theme.fontWeight.semibold,
    marginRight: theme.spacing.xs,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: theme.borderRadius.full,
  },

  mintText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    flex: 1,
    marginRight: theme.spacing.sm,
  },

  timestamp: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },

  amountContainer: {
    alignItems: 'flex-end',
    marginLeft: theme.spacing.md,
  },

  amountText: {
    ...theme.typography.amountSmall,
    fontSize: theme.fontSize.lg,
  },

  currencyText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginTop: -2,
  },
});

export default TransactionListItem;
