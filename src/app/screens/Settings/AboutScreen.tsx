/**
 * About Screen
 *
 * Displays app information including:
 * - Version and build info
 * - Links to website, documentation, and source code
 * - Credits and acknowledgments
 * - Legal information
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';

// App version info (would normally come from app.json or native config)
const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '1';

interface LinkItem {
  title: string;
  url: string;
  description?: string;
}

const links: LinkItem[] = [
  {
    title: 'Cashu Protocol',
    url: 'https://cashu.space',
    description: 'Learn about the Cashu ecash protocol',
  },
  {
    title: 'GitHub Repository',
    url: 'https://github.com/cashubtc',
    description: 'View source code and contribute',
  },
  {
    title: 'Cashu Documentation',
    url: 'https://docs.cashu.space',
    description: 'Technical documentation and NUTs',
  },
  {
    title: 'Bitcoin Resources',
    url: 'https://bitcoin.org',
    description: 'Learn about Bitcoin',
  },
];

const libraries = [
  { name: '@cashu/cashu-ts', description: 'Cashu TypeScript library' },
  { name: 'React Native', description: 'Mobile app framework' },
  { name: 'SQLite', description: 'Local database storage' },
  { name: 'React Navigation', description: 'Navigation framework' },
];

export function AboutScreen() {
  const handleOpenLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', `Cannot open URL: ${url}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open link');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* App Logo and Name */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>C</Text>
        </View>
        <Text style={styles.appName}>Cashu Wallet</Text>
        <Text style={styles.tagline}>Offline-First Bitcoin Payments</Text>
      </View>

      {/* Version Info */}
      <Card style={styles.versionCard}>
        <View style={styles.versionRow}>
          <Text style={styles.versionLabel}>Version</Text>
          <Text style={styles.versionValue}>{APP_VERSION}</Text>
        </View>
        <View style={styles.versionRow}>
          <Text style={styles.versionLabel}>Build</Text>
          <Text style={styles.versionValue}>{BUILD_NUMBER}</Text>
        </View>
        <View style={styles.versionRow}>
          <Text style={styles.versionLabel}>Protocol</Text>
          <Text style={styles.versionValue}>Cashu v1</Text>
        </View>
      </Card>

      {/* Description */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.descriptionText}>
          Cashu Wallet is an offline-first mobile wallet for Cashu ecash tokens.
          Send and receive bitcoin-backed ecash with privacy, even without an internet
          connection using NFC or Bluetooth.
        </Text>
        <Text style={styles.descriptionText}>
          Cashu is a free and open-source Chaumian ecash protocol built for Bitcoin.
          It offers near-perfect privacy for users while being easy to use and integrate.
        </Text>
      </Card>

      {/* Features */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Key Features</Text>
        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>*</Text>
            <Text style={styles.featureText}>Offline payments via NFC and Bluetooth</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>*</Text>
            <Text style={styles.featureText}>Lightning Network integration</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>*</Text>
            <Text style={styles.featureText}>Multi-mint support</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>*</Text>
            <Text style={styles.featureText}>Offline Cash Reserve (OCR)</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>*</Text>
            <Text style={styles.featureText}>Privacy-preserving by design</Text>
          </View>
        </View>
      </Card>

      {/* Links */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Resources</Text>
        {links.map((link, index) => (
          <TouchableOpacity
            key={index}
            style={styles.linkItem}
            onPress={() => handleOpenLink(link.url)}
          >
            <View style={styles.linkInfo}>
              <Text style={styles.linkTitle}>{link.title}</Text>
              {link.description && (
                <Text style={styles.linkDescription}>{link.description}</Text>
              )}
            </View>
            <Text style={styles.linkArrow}>{'>'}</Text>
          </TouchableOpacity>
        ))}
      </Card>

      {/* Libraries */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Built With</Text>
        {libraries.map((lib, index) => (
          <View key={index} style={styles.libraryItem}>
            <Text style={styles.libraryName}>{lib.name}</Text>
            <Text style={styles.libraryDescription}>{lib.description}</Text>
          </View>
        ))}
      </Card>

      {/* Disclaimer */}
      <Card style={styles.disclaimerCard}>
        <Text style={styles.disclaimerTitle}>Important Disclaimer</Text>
        <Text style={styles.disclaimerText}>
          This software is provided "as is" without warranty of any kind.
          Cashu mints are custodial services - the mint operator holds your funds
          and can potentially run away with them (rug). Only store amounts you can
          afford to lose.
        </Text>
        <Text style={styles.disclaimerText}>
          This is experimental software. Use at your own risk. Always keep
          backups of your wallet data.
        </Text>
      </Card>

      {/* Credits */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Credits</Text>
        <Text style={styles.creditText}>
          Cashu protocol created by calle
        </Text>
        <Text style={styles.creditText}>
          Original cashu.me wallet by the Cashu team
        </Text>
        <Text style={styles.creditText}>
          Built with love for the Bitcoin community
        </Text>
      </Card>

      {/* License */}
      <View style={styles.licenseContainer}>
        <Text style={styles.licenseText}>
          Open source under MIT License
        </Text>
        <Text style={styles.copyrightText}>
          {new Date().getFullYear()} Island Bitcoin
        </Text>
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
  header: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: theme.colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: theme.colors.text.inverse,
  },
  appName: {
    ...theme.typography.h1,
    color: theme.colors.text.primary,
  },
  tagline: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  versionCard: {
    marginTop: theme.spacing.md,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  versionLabel: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
  },
  versionValue: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
    fontFamily: theme.fontFamily.mono,
  },
  card: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  descriptionText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  featureList: {
    gap: theme.spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureBullet: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary[500],
    marginRight: theme.spacing.sm,
    width: 16,
  },
  featureText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  linkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  linkInfo: {
    flex: 1,
  },
  linkTitle: {
    ...theme.typography.labelLarge,
    color: theme.colors.primary[500],
  },
  linkDescription: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  linkArrow: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.tertiary,
    marginLeft: theme.spacing.md,
  },
  libraryItem: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  libraryName: {
    ...theme.typography.label,
    color: theme.colors.text.primary,
    fontFamily: theme.fontFamily.mono,
  },
  libraryDescription: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  disclaimerCard: {
    marginTop: theme.spacing.md,
    borderColor: theme.colors.status.warning + '60',
    borderWidth: 1,
    backgroundColor: theme.colors.status.warning + '10',
  },
  disclaimerTitle: {
    ...theme.typography.h4,
    color: theme.colors.status.warning,
    marginBottom: theme.spacing.md,
  },
  disclaimerText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
    lineHeight: 20,
  },
  creditText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  licenseContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
  licenseText: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  copyrightText: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xs,
  },
});

export default AboutScreen;
