/**
 * OCR Configuration Screen
 *
 * Configures the Offline Cash Reserve (OCR) system including:
 * - OCR level (LOW, MEDIUM, HIGH)
 * - Auto-refill toggle
 * - Alert threshold
 * - Manual sync/refill
 * - Status and health display
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { OCRManager, OCRConfig, OCRStatusResult, OCR_TARGETS } from '../../../core/ocr/OCRManager';
import MintRepository from '../../../data/repositories/MintRepository';
import { OCRLevel, OCRStatus } from '../../../types';

interface OCRLevelOption {
  level: OCRLevel;
  label: string;
  target: number;
  description: string;
}

const OCR_LEVEL_OPTIONS: OCRLevelOption[] = [
  {
    level: OCRLevel.LOW,
    label: 'Low',
    target: OCR_TARGETS[OCRLevel.LOW],
    description: 'For casual use - quick coffee purchases',
  },
  {
    level: OCRLevel.MEDIUM,
    label: 'Medium',
    target: OCR_TARGETS[OCRLevel.MEDIUM],
    description: 'Balanced for daily spending',
  },
  {
    level: OCRLevel.HIGH,
    label: 'High',
    target: OCR_TARGETS[OCRLevel.HIGH],
    description: 'Maximum offline capability',
  },
];

export function OCRConfigurationScreen() {
  const [config, setConfig] = useState<OCRConfig | null>(null);
  const [status, setStatus] = useState<OCRStatusResult | null>(null);
  const [healthCheck, setHealthCheck] = useState<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadOCRData = async () => {
    try {
      const ocrManager = OCRManager.getInstance();

      const currentConfig = ocrManager.getConfig();
      const currentStatus = ocrManager.getStatus();
      const health = ocrManager.healthCheck();

      setConfig(currentConfig);
      setStatus(currentStatus);
      setHealthCheck(health);
    } catch (error) {
      console.error('[OCRConfig] Failed to load OCR data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadOCRData();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOCRData();
    setRefreshing(false);
  };

  const handleLevelChange = async (level: OCRLevel) => {
    try {
      const ocrManager = OCRManager.getInstance();
      await ocrManager.setConfig({ level });
      await loadOCRData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update OCR level');
    }
  };

  const handleAutoRefillToggle = async (enabled: boolean) => {
    try {
      const ocrManager = OCRManager.getInstance();
      await ocrManager.setConfig({ autoRefill: enabled });
      await loadOCRData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update auto-refill setting');
    }
  };

  const handleAlertThresholdChange = () => {
    const options = [10, 15, 20, 25, 30].map(threshold => ({
      text: `${threshold}%`,
      onPress: async () => {
        try {
          const ocrManager = OCRManager.getInstance();
          await ocrManager.setConfig({ alertThreshold: threshold });
          await loadOCRData();
        } catch (error) {
          Alert.alert('Error', 'Failed to update alert threshold');
        }
      },
    }));

    Alert.alert(
      'Alert Threshold',
      'Get notified when OCR falls below this percentage:',
      [...options, { text: 'Cancel', style: 'cancel' }]
    );
  };

  const handleManualSync = async () => {
    setSyncing(true);

    try {
      const ocrManager = OCRManager.getInstance();
      const mintRepo = MintRepository.getInstance();

      // Get the first available mint
      const mints = await mintRepo.getAll();
      if (mints.length === 0) {
        Alert.alert('No Mints', 'Please add a mint first to sync OCR.');
        return;
      }

      // Try to sync with first mint
      const result = await ocrManager.syncOCR(mints[0].url);

      if (result.success) {
        Alert.alert(
          'Sync Complete',
          `OCR synced successfully!\n\nProofs added: ${result.proofsAdded}\nNew balance: ${result.newBalance.toLocaleString()} sats`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Sync Failed',
          result.error || 'Unknown error occurred',
          [{ text: 'OK' }]
        );
      }

      await loadOCRData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sync OCR');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (ocrStatus: OCRStatus): string => {
    switch (ocrStatus) {
      case OCRStatus.SYNCED:
        return theme.colors.status.success;
      case OCRStatus.OFFLINE_READY:
        return theme.colors.primary[500];
      case OCRStatus.OUT_OF_SYNC:
        return theme.colors.status.warning;
      case OCRStatus.DEPLETED:
        return theme.colors.status.error;
      default:
        return theme.colors.text.tertiary;
    }
  };

  const getStatusLabel = (ocrStatus: OCRStatus): string => {
    switch (ocrStatus) {
      case OCRStatus.SYNCED:
        return 'Synced';
      case OCRStatus.OFFLINE_READY:
        return 'Offline Ready';
      case OCRStatus.OUT_OF_SYNC:
        return 'Out of Sync';
      case OCRStatus.DEPLETED:
        return 'Depleted';
      default:
        return 'Unknown';
    }
  };

  const getStatusDescription = (ocrStatus: OCRStatus): string => {
    switch (ocrStatus) {
      case OCRStatus.SYNCED:
        return 'Your offline reserve is fully topped up and ready for offline payments.';
      case OCRStatus.OFFLINE_READY:
        return 'You have sufficient funds for offline payments.';
      case OCRStatus.OUT_OF_SYNC:
        return 'Your offline reserve is low. Connect to refill when convenient.';
      case OCRStatus.DEPLETED:
        return 'No offline funds available. Connect to internet to refill.';
      default:
        return '';
    }
  };

  if (loading || !config || !status) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading OCR configuration...</Text>
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
      {/* Status Card */}
      <Card style={{...styles.statusCard, borderColor: getStatusColor(status.status)}}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(status.status) }]} />
          <Text style={[styles.statusLabel, { color: getStatusColor(status.status) }]}>
            {getStatusLabel(status.status)}
          </Text>
        </View>

        <Text style={styles.balanceAmount}>{status.currentBalance.toLocaleString()}</Text>
        <Text style={styles.balanceUnit}>sats offline ready</Text>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(status.percentOfTarget, 100)}%`,
                  backgroundColor: getStatusColor(status.status),
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {status.percentOfTarget.toFixed(0)}% of {status.targetBalance.toLocaleString()} sats target
          </Text>
        </View>

        <Text style={styles.statusDescription}>{getStatusDescription(status.status)}</Text>

        {status.needsRefill && (
          <Button
            onPress={handleManualSync}
            disabled={syncing}
            style={styles.syncButton}
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        )}
      </Card>

      {/* OCR Level Selection */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>OCR Level</Text>
        <Text style={styles.sectionDescription}>
          Choose how much to keep available for offline payments
        </Text>

        <View style={styles.levelOptions}>
          {OCR_LEVEL_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.level}
              style={[
                styles.levelOption,
                config.level === option.level && styles.levelOptionSelected,
              ]}
              onPress={() => handleLevelChange(option.level)}
            >
              <View style={styles.levelHeader}>
                <Text
                  style={[
                    styles.levelLabel,
                    config.level === option.level && styles.levelLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.levelTarget,
                    config.level === option.level && styles.levelTargetSelected,
                  ]}
                >
                  {option.target.toLocaleString()} sats
                </Text>
              </View>
              <Text
                style={[
                  styles.levelDescription,
                  config.level === option.level && styles.levelDescriptionSelected,
                ]}
              >
                {option.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Settings */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Auto-Refill</Text>
            <Text style={styles.settingDescription}>
              Automatically refill OCR when online
            </Text>
          </View>
          <Switch
            value={config.autoRefill}
            onValueChange={handleAutoRefillToggle}
            trackColor={{
              false: theme.colors.background.tertiary,
              true: theme.colors.primary[500],
            }}
          />
        </View>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={handleAlertThresholdChange}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Alert Threshold</Text>
            <Text style={styles.settingDescription}>
              Notify when OCR falls below this level
            </Text>
          </View>
          <Text style={styles.settingValue}>{config.alertThreshold}%</Text>
        </TouchableOpacity>
      </Card>

      {/* Health Check */}
      {healthCheck && (
        <Card style={healthCheck.healthy ? styles.healthCardGood : styles.healthCardBad}>
          <Text style={styles.healthTitle}>
            {healthCheck.healthy ? 'OCR Health: Good' : 'OCR Health: Needs Attention'}
          </Text>

          {healthCheck.issues.length > 0 && (
            <View style={styles.healthSection}>
              <Text style={styles.healthSectionTitle}>Issues:</Text>
              {healthCheck.issues.map((issue, index) => (
                <Text key={index} style={styles.healthIssue}>* {issue}</Text>
              ))}
            </View>
          )}

          {healthCheck.recommendations.length > 0 && (
            <View style={styles.healthSection}>
              <Text style={styles.healthSectionTitle}>Recommendations:</Text>
              {healthCheck.recommendations.map((rec, index) => (
                <Text key={index} style={styles.healthRecommendation}>* {rec}</Text>
              ))}
            </View>
          )}
        </Card>
      )}

      {/* Info Card */}
      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>What is OCR?</Text>
        <Text style={styles.infoText}>
          Offline Cash Reserve (OCR) is a pool of pre-swapped ecash tokens stored
          on your device. These tokens can be spent instantly without internet
          connectivity - perfect for payments in areas with poor signal or during
          network outages.
        </Text>
        <Text style={styles.infoText}>
          The wallet automatically keeps your OCR topped up when you're online,
          ensuring you always have offline spending capability.
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
    borderWidth: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.sm,
  },
  statusLabel: {
    ...theme.typography.labelLarge,
    fontFamily: theme.fontFamily.bold,
  },
  balanceAmount: {
    ...theme.typography.amount,
    fontSize: theme.fontSize['4xl'],
    color: theme.colors.text.primary,
  },
  balanceUnit: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  progressContainer: {
    width: '100%',
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  statusDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  syncButton: {
    marginTop: theme.spacing.lg,
  },
  card: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  sectionDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
  },
  levelOptions: {
    gap: theme.spacing.sm,
  },
  levelOption: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border.primary,
    backgroundColor: theme.colors.background.primary,
  },
  levelOptionSelected: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[500] + '10',
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  levelLabel: {
    ...theme.typography.labelLarge,
    color: theme.colors.text.primary,
  },
  levelLabelSelected: {
    color: theme.colors.primary[500],
  },
  levelTarget: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    fontFamily: theme.fontFamily.mono,
  },
  levelTargetSelected: {
    color: theme.colors.primary[500],
  },
  levelDescription: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  levelDescriptionSelected: {
    color: theme.colors.text.secondary,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  settingInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  settingLabel: {
    ...theme.typography.labelLarge,
    color: theme.colors.text.primary,
  },
  settingDescription: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  settingValue: {
    ...theme.typography.labelLarge,
    color: theme.colors.primary[500],
  },
  healthCardGood: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.status.success + '10',
    borderColor: theme.colors.status.success + '40',
    borderWidth: 1,
  },
  healthCardBad: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.status.warning + '10',
    borderColor: theme.colors.status.warning + '40',
    borderWidth: 1,
  },
  healthTitle: {
    ...theme.typography.h4,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  healthSection: {
    marginTop: theme.spacing.sm,
  },
  healthSectionTitle: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  healthIssue: {
    ...theme.typography.bodySmall,
    color: theme.colors.status.warning,
    marginBottom: theme.spacing.xs,
  },
  healthRecommendation: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  infoCard: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.primary[500] + '10',
  },
  infoTitle: {
    ...theme.typography.h4,
    color: theme.colors.primary[500],
    marginBottom: theme.spacing.md,
  },
  infoText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
});

export default OCRConfigurationScreen;
