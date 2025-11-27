/**
 * OCR Status Indicator
 *
 * Visual indicator for Offline Cash Reserve status.
 *
 * Status States:
 * - SYNCED: Green - OCR fully synced to target
 * - OFFLINE_READY: Green - OCR ready for offline use
 * - LOW: Amber - OCR below 50% of target
 * - DEPLETED: Red - OCR empty or very low
 * - OUT_OF_SYNC: Red - OCR needs sync
 * - SYNCING: Blue - Currently syncing
 *
 * Displays:
 * - Status icon with color
 * - Current balance vs target
 * - Percentage indicator
 * - Status message
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../theme';

export type OCRStatus = 'SYNCED' | 'OFFLINE_READY' | 'LOW' | 'DEPLETED' | 'OUT_OF_SYNC' | 'SYNCING';

export interface OCRStatusIndicatorProps {
  status: OCRStatus;
  currentBalance: number;
  targetBalance: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  style?: ViewStyle;
}

export function OCRStatusIndicator({
  status,
  currentBalance,
  targetBalance,
  size = 'md',
  showDetails = true,
  style,
}: OCRStatusIndicatorProps) {
  const percentage = targetBalance > 0 ? (currentBalance / targetBalance) * 100 : 0;
  const statusColor = theme.getOCRStatusColor(status);

  const statusMessages: Record<OCRStatus, string> = {
    SYNCED: 'Fully Synced',
    OFFLINE_READY: 'Ready for Offline',
    LOW: 'Low Balance',
    DEPLETED: 'Depleted',
    OUT_OF_SYNC: 'Out of Sync',
    SYNCING: 'Syncing...',
  };

  const statusMessage = statusMessages[status];

  return (
    <View style={[styles.container, styles[`${size}Container`], style]}>
      {/* Status Dot */}
      <View style={[styles.statusDot, styles[`${size}StatusDot`], { backgroundColor: statusColor }]} />

      {/* Status Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.label, styles[`${size}Label`]]}>Offline Cash Reserve</Text>
          <Text style={[styles.status, styles[`${size}Status`], { color: statusColor }]}>
            {statusMessage}
          </Text>
        </View>

        {showDetails && (
          <>
            {/* Balance */}
            <View style={styles.balanceRow}>
              <Text style={[styles.balanceText, styles[`${size}BalanceText`]]}>
                {currentBalance.toLocaleString()} / {targetBalance.toLocaleString()} sats
              </Text>
              <Text style={[styles.percentageText, styles[`${size}PercentageText`], { color: statusColor }]}>
                {percentage.toFixed(0)}%
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={[styles.progressBar, styles[`${size}ProgressBar`]]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(percentage, 100)}%`,
                    backgroundColor: statusColor,
                  },
                ]}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border.primary,
  },

  smContainer: {
    padding: theme.spacing.sm,
  },

  mdContainer: {
    padding: theme.spacing.md,
  },

  lgContainer: {
    padding: theme.spacing.lg,
  },

  statusDot: {
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.md,
  },

  smStatusDot: {
    width: 8,
    height: 8,
    marginTop: 4,
  },

  mdStatusDot: {
    width: 12,
    height: 12,
    marginTop: 5,
  },

  lgStatusDot: {
    width: 16,
    height: 16,
    marginTop: 6,
  },

  content: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },

  label: {
    ...theme.typography.label,
    color: theme.colors.text.primary,
  },

  smLabel: {
    fontSize: theme.fontSize.xs,
  },

  mdLabel: {
    fontSize: theme.fontSize.sm,
  },

  lgLabel: {
    fontSize: theme.fontSize.base,
  },

  status: {
    ...theme.typography.captionBold,
  },

  smStatus: {
    fontSize: theme.fontSize.xs,
  },

  mdStatus: {
    fontSize: theme.fontSize.sm,
  },

  lgStatus: {
    fontSize: theme.fontSize.base,
  },

  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },

  balanceText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
  },

  smBalanceText: {
    fontSize: theme.fontSize.xs,
  },

  mdBalanceText: {
    fontSize: theme.fontSize.sm,
  },

  lgBalanceText: {
    fontSize: theme.fontSize.base,
  },

  percentageText: {
    ...theme.typography.captionBold,
  },

  smPercentageText: {
    fontSize: theme.fontSize.xs,
  },

  mdPercentageText: {
    fontSize: theme.fontSize.sm,
  },

  lgPercentageText: {
    fontSize: theme.fontSize.base,
  },

  progressBar: {
    height: 4,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },

  smProgressBar: {
    height: 3,
  },

  mdProgressBar: {
    height: 4,
  },

  lgProgressBar: {
    height: 6,
  },

  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
});

export default OCRStatusIndicator;
