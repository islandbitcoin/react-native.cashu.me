/**
 * Backup & Recovery Screen
 *
 * Manages wallet backup and recovery including:
 * - Export wallet data (proofs, mints, transactions)
 * - Import from backup
 * - Backup status and recommendations
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Share,
  Platform,
  Clipboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import ProofRepository from '../../../data/repositories/ProofRepository';
import MintRepository from '../../../data/repositories/MintRepository';
import TransactionRepository from '../../../data/repositories/TransactionRepository';

const LAST_BACKUP_KEY = '@backup/last_backup_time';

interface BackupData {
  version: number;
  exportedAt: number;
  proofs: any[];
  mints: any[];
  transactions: any[];
  settings: Record<string, any>;
}

interface BackupStats {
  proofCount: number;
  mintCount: number;
  transactionCount: number;
  totalBalance: number;
  lastBackup: number | null;
}

export function BackupRecoveryScreen() {
  const [stats, setStats] = useState<BackupStats>({
    proofCount: 0,
    mintCount: 0,
    transactionCount: 0,
    totalBalance: 0,
    lastBackup: null,
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const proofRepo = ProofRepository.getInstance();
      const mintRepo = MintRepository.getInstance();
      const txRepo = TransactionRepository.getInstance();

      const [proofs, mints, transactions, lastBackupStr] = await Promise.all([
        proofRepo.getAll(),
        mintRepo.getAll(),
        txRepo.getAll(),
        AsyncStorage.getItem(LAST_BACKUP_KEY),
      ]);

      const totalBalance = proofs.reduce((sum, p) => sum + p.amount, 0);

      setStats({
        proofCount: proofs.length,
        mintCount: mints.length,
        transactionCount: transactions.length,
        totalBalance,
        lastBackup: lastBackupStr ? parseInt(lastBackupStr, 10) : null,
      });
    } catch (error) {
      console.error('[Backup] Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async (): Promise<BackupData> => {
    const proofRepo = ProofRepository.getInstance();
    const mintRepo = MintRepository.getInstance();
    const txRepo = TransactionRepository.getInstance();

    const [proofs, mints, transactions] = await Promise.all([
      proofRepo.getAll(),
      mintRepo.getAll(),
      txRepo.getAll(),
    ]);

    // Get relevant settings
    const settingsKeys = [
      '@security/pin_enabled',
      '@security/hide_balance',
      '@ocr/target_level',
      '@ocr/auto_replenish',
    ];
    const settings: Record<string, any> = {};
    for (const key of settingsKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value !== null) {
        settings[key] = value;
      }
    }

    return {
      version: 1,
      exportedAt: Date.now(),
      proofs,
      mints,
      transactions,
      settings,
    };
  };

  const handleExportBackup = async () => {
    setExporting(true);

    try {
      const backup = await createBackup();
      const backupJson = JSON.stringify(backup, null, 2);

      // Save last backup time
      await AsyncStorage.setItem(LAST_BACKUP_KEY, Date.now().toString());

      // Show share dialog
      if (Platform.OS === 'ios') {
        await Share.share({
          message: backupJson,
          title: 'Cashu Wallet Backup',
        });
      } else {
        // On Android, copy to clipboard and show instructions
        Clipboard.setString(backupJson);
        Alert.alert(
          'Backup Copied',
          'Your wallet backup has been copied to clipboard. Paste it somewhere safe like a password manager or encrypted note.',
          [{ text: 'OK' }]
        );
      }

      await loadStats();
    } catch (error: any) {
      console.error('[Backup] Export failed:', error);
      Alert.alert('Export Failed', error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    setExporting(true);

    try {
      const backup = await createBackup();
      const backupJson = JSON.stringify(backup);

      Clipboard.setString(backupJson);
      await AsyncStorage.setItem(LAST_BACKUP_KEY, Date.now().toString());

      Alert.alert(
        'Success',
        'Backup copied to clipboard. Store it somewhere safe!',
        [{ text: 'OK' }]
      );

      await loadStats();
    } catch (error: any) {
      console.error('[Backup] Copy failed:', error);
      Alert.alert('Copy Failed', error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleImportBackup = async () => {
    Alert.prompt(
      'Import Backup',
      'Paste your backup data:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async (backupJson: string | undefined) => {
            if (!backupJson) {
              Alert.alert('Error', 'No backup data provided');
              return;
            }

            setImporting(true);

            try {
              const backup: BackupData = JSON.parse(backupJson);

              // Validate backup format
              if (!backup.version || !backup.proofs || !backup.mints) {
                throw new Error('Invalid backup format');
              }

              // Confirm import
              Alert.alert(
                'Confirm Import',
                `This backup contains:\n- ${backup.proofs.length} proofs\n- ${backup.mints.length} mints\n- ${backup.transactions?.length || 0} transactions\n\nImporting will merge with existing data. Continue?`,
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => setImporting(false) },
                  {
                    text: 'Import',
                    onPress: async () => {
                      try {
                        await performImport(backup);
                        Alert.alert('Success', 'Backup imported successfully!');
                        await loadStats();
                      } catch (error: any) {
                        Alert.alert('Import Failed', error.message);
                      } finally {
                        setImporting(false);
                      }
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error('[Backup] Import parse failed:', error);
              Alert.alert('Invalid Backup', 'Could not parse backup data. Make sure you copied the complete backup.');
              setImporting(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const performImport = async (backup: BackupData) => {
    const proofRepo = ProofRepository.getInstance();
    const mintRepo = MintRepository.getInstance();
    const txRepo = TransactionRepository.getInstance();

    // Import mints first (proofs depend on them)
    for (const mint of backup.mints) {
      const existing = await mintRepo.getByUrl(mint.url);
      if (!existing) {
        await mintRepo.create(mint);
      }
    }

    // Import proofs
    for (const proof of backup.proofs) {
      const existing = await proofRepo.getById(proof.id);
      if (!existing) {
        await proofRepo.create(proof);
      }
    }

    // Import transactions
    if (backup.transactions) {
      for (const tx of backup.transactions) {
        const existing = await txRepo.getById(tx.id);
        if (!existing) {
          await txRepo.create(tx);
        }
      }
    }

    // Import settings
    if (backup.settings) {
      for (const [key, value] of Object.entries(backup.settings)) {
        await AsyncStorage.setItem(key, value);
      }
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardContent = await Clipboard.getString();
      if (!clipboardContent) {
        Alert.alert('Error', 'Clipboard is empty');
        return;
      }

      setImporting(true);

      const backup: BackupData = JSON.parse(clipboardContent);

      // Validate backup format
      if (!backup.version || !backup.proofs || !backup.mints) {
        throw new Error('Invalid backup format');
      }

      Alert.alert(
        'Confirm Import',
        `This backup contains:\n- ${backup.proofs.length} proofs\n- ${backup.mints.length} mints\n- ${backup.transactions?.length || 0} transactions\n\nImporting will merge with existing data. Continue?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setImporting(false) },
          {
            text: 'Import',
            onPress: async () => {
              try {
                await performImport(backup);
                Alert.alert('Success', 'Backup imported successfully!');
                await loadStats();
              } catch (error: any) {
                Alert.alert('Import Failed', error.message);
              } finally {
                setImporting(false);
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('[Backup] Paste import failed:', error);
      Alert.alert('Invalid Backup', 'Could not parse clipboard content as backup data.');
      setImporting(false);
    }
  };

  const formatDate = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const getBackupAge = (): string => {
    if (!stats.lastBackup) return 'No backup yet';

    const ageMs = Date.now() - stats.lastBackup;
    const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const needsBackup = (): boolean => {
    if (!stats.lastBackup) return stats.proofCount > 0;

    const daysSinceBackup = (Date.now() - stats.lastBackup) / (1000 * 60 * 60 * 24);
    return daysSinceBackup > 7 && stats.proofCount > 0;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading backup info...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Backup Status */}
      <Card style={needsBackup() ? {...styles.statusCard, ...styles.statusCardWarning} : styles.statusCard}>
        <Text style={[styles.statusTitle, needsBackup() && styles.statusTitleWarning]}>
          {needsBackup() ? 'Backup Recommended' : 'Backup Status'}
        </Text>
        <Text style={styles.statusTime}>Last backup: {getBackupAge()}</Text>
        {needsBackup() && (
          <Text style={styles.warningText}>
            You have unprotected funds. Create a backup to prevent loss.
          </Text>
        )}
      </Card>

      {/* Wallet Stats */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Wallet Contents</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalBalance.toLocaleString()}</Text>
            <Text style={styles.statLabel}>sats</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.proofCount}</Text>
            <Text style={styles.statLabel}>proofs</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.mintCount}</Text>
            <Text style={styles.statLabel}>mints</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.transactionCount}</Text>
            <Text style={styles.statLabel}>transactions</Text>
          </View>
        </View>
      </Card>

      {/* Export Section */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Export Backup</Text>
        <Text style={styles.helpText}>
          Create a backup of your wallet data including all proofs, mints, and settings.
          Store this backup securely - anyone with access can spend your tokens!
        </Text>

        <Button
          onPress={handleExportBackup}
          disabled={exporting}
          style={styles.actionButton}
        >
          {exporting ? 'Exporting...' : 'Export & Share'}
        </Button>

        <Button
          variant="secondary"
          onPress={handleCopyToClipboard}
          disabled={exporting}
          style={styles.actionButton}
        >
          Copy to Clipboard
        </Button>
      </Card>

      {/* Import Section */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Import Backup</Text>
        <Text style={styles.helpText}>
          Restore your wallet from a previous backup. This will merge imported data
          with your existing wallet - duplicates will be skipped.
        </Text>

        <Button
          variant="secondary"
          onPress={handlePasteFromClipboard}
          disabled={importing}
          style={styles.actionButton}
        >
          {importing ? 'Importing...' : 'Paste from Clipboard'}
        </Button>

        <Button
          variant="secondary"
          onPress={handleImportBackup}
          disabled={importing}
          style={styles.actionButton}
        >
          Enter Backup Manually
        </Button>
      </Card>

      {/* Important Notes */}
      <Card style={styles.notesCard}>
        <Text style={styles.notesTitle}>Important Notes</Text>
        <Text style={styles.noteItem}>
          * Backups contain sensitive data - store them securely
        </Text>
        <Text style={styles.noteItem}>
          * Anyone with your backup can spend your tokens
        </Text>
        <Text style={styles.noteItem}>
          * Proofs are single-use - importing old backups may contain spent proofs
        </Text>
        <Text style={styles.noteItem}>
          * Back up regularly, especially after receiving funds
        </Text>
        <Text style={styles.noteItem}>
          * Consider using a password manager for backup storage
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
  statusCard: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  statusCardWarning: {
    borderColor: theme.colors.status.warning,
    borderWidth: 1,
    backgroundColor: theme.colors.status.warning + '10',
  },
  statusTitle: {
    ...theme.typography.h3,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  statusTitleWarning: {
    color: theme.colors.status.warning,
  },
  statusTime: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
  },
  warningText: {
    ...theme.typography.bodySmall,
    color: theme.colors.status.warning,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  card: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  statValue: {
    ...theme.typography.h2,
    color: theme.colors.text.primary,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  helpText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  actionButton: {
    marginTop: theme.spacing.sm,
  },
  notesCard: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.primary[500] + '10',
  },
  notesTitle: {
    ...theme.typography.h4,
    color: theme.colors.primary[500],
    marginBottom: theme.spacing.md,
  },
  noteItem: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
});

export default BackupRecoveryScreen;
