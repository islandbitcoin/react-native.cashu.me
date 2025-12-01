/**
 * Settings Screen
 *
 * Main settings menu with links to all configuration options.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';

interface SettingsItem {
  title: string;
  description: string;
  route: string;
  icon: string;
}

const settingsItems: SettingsItem[] = [
  {
    title: 'Manage Mints',
    description: 'Add, remove, and configure Cashu mints',
    route: 'MintManagement',
    icon: '🏦',
  },
  {
    title: 'Offline Cash Reserve',
    description: 'Configure OCR for offline payments',
    route: 'OCRConfiguration',
    icon: '📴',
  },
  {
    title: 'Payment Transports',
    description: 'NFC, Bluetooth, and QR settings',
    route: 'TransportSelection',
    icon: '📡',
  },
  {
    title: 'Backup & Recovery',
    description: 'Export wallet backup or restore',
    route: 'BackupRecovery',
    icon: '💾',
  },
  {
    title: 'Security',
    description: 'PIN, biometrics, and privacy settings',
    route: 'Security',
    icon: '🔒',
  },
  {
    title: 'About',
    description: 'App info and version',
    route: 'About',
    icon: 'ℹ️',
  },
];

export function SettingsScreen() {
  const navigation = useNavigation();

  const handlePress = (route: string) => {
    navigation.navigate(route as never);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {settingsItems.map((item, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => handlePress(item.route)}
          activeOpacity={0.7}
        >
          <Card style={styles.settingCard}>
            <View style={styles.settingRow}>
              <Text style={styles.settingIcon}>{item.icon}</Text>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>{item.title}</Text>
                <Text style={styles.settingDescription}>{item.description}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Card>
        </TouchableOpacity>
      ))}

      {/* Version Info */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Cashu Wallet v1.0.0</Text>
        <Text style={styles.versionSubtext}>Offline-First Bitcoin Payments</Text>
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
    paddingBottom: theme.spacing['2xl'],
  },
  settingCard: {
    marginTop: theme.spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    fontSize: 24,
    marginRight: theme.spacing.md,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    ...theme.typography.labelLarge,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  settingDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
  },
  chevron: {
    fontSize: 24,
    color: theme.colors.text.tertiary,
    marginLeft: theme.spacing.md,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: theme.spacing['2xl'],
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.primary,
  },
  versionText: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  versionSubtext: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xs,
  },
});

export default SettingsScreen;
