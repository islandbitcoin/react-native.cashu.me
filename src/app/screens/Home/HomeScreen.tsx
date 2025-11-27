/**
 * Home Screen
 *
 * Main balance screen showing:
 * - Total balance
 * - OCR status
 * - Recent transactions
 * - Quick actions (Send, Receive)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { OCRStatusIndicator } from '../../components/OCRStatusIndicator';
import { TransactionListItem } from '../../components/TransactionListItem';
import ProofRepository from '../../../data/repositories/ProofRepository';
import TransactionRepository from '../../../data/repositories/TransactionRepository';
import OCRManager from '../../../core/ocr/OCRManager';
import { TransactionType, TransactionStatus } from '../../../types';

export function HomeScreen() {
  const navigation = useNavigation();
  const [balance, setBalance] = useState(0);
  const [ocrStatus, setOCRStatus] = useState<any>(null);
  const [recentTxs, setRecentTxs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      // Load balance
      const stats = ProofRepository.getInstance().getStats();
      setBalance(stats.totalValue);

      // Load OCR status
      const ocrMgr = OCRManager.getInstance();
      const status = ocrMgr.getStatus();
      setOCRStatus(status);

      // Load recent transactions
      const txRepo = TransactionRepository.getInstance();
      const recent = await txRepo.getRecent(5);
      setRecentTxs(recent);
    } catch (error) {
      console.error('[HomeScreen] Load error:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

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
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>{balance.toLocaleString()}</Text>
        <Text style={styles.balanceUnit}>sats</Text>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Send' as never)}
          >
            Send
          </Button>
          <Button
            style={styles.quickActionButton}
            variant="secondary"
            onPress={() => navigation.navigate('ReceiveModal' as never)}
          >
            Receive
          </Button>
        </View>
      </Card>

      {/* OCR Status */}
      {ocrStatus && (
        <OCRStatusIndicator
          status={ocrStatus.status}
          currentBalance={ocrStatus.currentBalance}
          targetBalance={ocrStatus.targetAmount}
          style={styles.ocrIndicator}
        />
      )}

      {/* Recent Transactions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('History' as never)}
          >
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {recentTxs.length > 0 ? (
          <Card padding="none" style={styles.txList}>
            {recentTxs.map((tx, index) => (
              <TransactionListItem
                key={tx.id}
                id={tx.id}
                type={tx.type}
                status={tx.status}
                amount={tx.amount}
                mintName={tx.mintName}
                timestamp={tx.createdAt}
                onPress={(id) =>
                  navigation.navigate('TransactionDetails' as never, { transactionId: id } as never)
                }
              />
            ))}
          </Card>
        ) : (
          <Card>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </Card>
        )}
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
  },

  balanceCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing['2xl'],
    marginTop: theme.spacing.lg,
  },

  balanceLabel: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },

  balanceAmount: {
    ...theme.typography.amount,
    fontSize: theme.fontSize['6xl'],
    color: theme.colors.text.primary,
  },

  balanceUnit: {
    ...theme.typography.currencyUnit,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },

  quickActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    width: '100%',
  },

  quickActionButton: {
    flex: 1,
  },

  ocrIndicator: {
    marginTop: theme.spacing.lg,
  },

  section: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },

  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text.primary,
  },

  seeAllText: {
    ...theme.typography.label,
    color: theme.colors.primary[500],
  },

  txList: {
    overflow: 'hidden',
  },

  emptyText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
});

export default HomeScreen;
