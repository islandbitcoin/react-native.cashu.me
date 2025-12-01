/**
 * OCRAlertScreen
 *
 * Modal screen shown when Offline Cash Reserve needs attention.
 * Alerts user when OCR is low, depleted, or out of sync.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { OCRStatusIndicator } from '../../components/OCRStatusIndicator';

export function OCRAlertScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // Get alert type from params (default to 'low')
  const alertType = (route.params as any)?.alertType || 'low';

  const alertContent = {
    low: {
      title: 'OCR Balance Low',
      description: 'Your Offline Cash Reserve is running low. Refill it while you have internet to ensure offline payments work.',
      action: 'Refill Now',
      severity: 'warning' as const,
    },
    depleted: {
      title: 'OCR Depleted',
      description: 'Your Offline Cash Reserve is empty. You won\'t be able to make offline payments until you refill.',
      action: 'Refill Immediately',
      severity: 'error' as const,
    },
    out_of_sync: {
      title: 'OCR Out of Sync',
      description: 'Your Offline Cash Reserve needs to be synchronized. Connect to the internet to sync.',
      action: 'Sync Now',
      severity: 'warning' as const,
    },
  };

  const content = alertContent[alertType as keyof typeof alertContent] || alertContent.low;

  const handleAction = async () => {
    // TODO: Implement OCR refill/sync
    // Navigate to OCR settings
    navigation.goBack();
    // navigation.navigate('Settings', { screen: 'OCRConfiguration' });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[
          styles.icon,
          content.severity === 'error' ? styles.errorIcon : styles.warningIcon
        ]}>
          {content.severity === 'error' ? '!' : '!'}
        </Text>
        <Text style={styles.title}>{content.title}</Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.description}>{content.description}</Text>

        {/* Placeholder OCR status */}
        <OCRStatusIndicator
          status={alertType === 'depleted' ? 'DEPLETED' : 'LOW'}
          currentBalance={alertType === 'depleted' ? 0 : 5000}
          targetBalance={50000}
          style={styles.indicator}
        />
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>Why is OCR important?</Text>
        <Text style={styles.infoText}>
          The Offline Cash Reserve keeps a portion of your balance ready for instant offline payments. Without it, you'll need internet to send payments.
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button
          fullWidth
          size="lg"
          variant={content.severity === 'error' ? 'danger' : 'primary'}
          onPress={handleAction}
        >
          {content.action}
        </Button>

        <Button
          fullWidth
          variant="ghost"
          onPress={() => navigation.goBack()}
        >
          Dismiss
        </Button>
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
    paddingTop: theme.spacing['2xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  icon: {
    fontSize: 48,
    fontWeight: 'bold',
    width: 80,
    height: 80,
    lineHeight: 80,
    textAlign: 'center',
    borderRadius: 40,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  warningIcon: {
    backgroundColor: theme.colors.status.warningBackground,
    color: theme.colors.status.warning,
  },
  errorIcon: {
    backgroundColor: theme.colors.status.errorBackground,
    color: theme.colors.status.error,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  card: {
    marginBottom: theme.spacing.lg,
  },
  description: {
    ...theme.typography.bodyLarge,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  indicator: {
    marginTop: theme.spacing.md,
  },
  infoCard: {
    backgroundColor: theme.colors.background.tertiary,
    marginBottom: theme.spacing.xl,
  },
  infoTitle: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.tertiary,
  },
  actions: {
    gap: theme.spacing.md,
  },
});

export default OCRAlertScreen;
