/**
 * Security Screen
 *
 * Manages security settings including:
 * - PIN code setup
 * - Biometric authentication
 * - Auto-lock timeout
 * - Privacy settings
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';

// Storage keys
const STORAGE_KEYS = {
  PIN_ENABLED: '@security/pin_enabled',
  PIN_CODE: '@security/pin_code',
  BIOMETRICS_ENABLED: '@security/biometrics_enabled',
  AUTO_LOCK_TIMEOUT: '@security/auto_lock_timeout',
  HIDE_BALANCE: '@security/hide_balance',
  REQUIRE_AUTH_FOR_SEND: '@security/require_auth_for_send',
};

interface SecuritySettings {
  pinEnabled: boolean;
  biometricsEnabled: boolean;
  autoLockTimeout: number; // minutes, 0 = never
  hideBalance: boolean;
  requireAuthForSend: boolean;
}

const DEFAULT_SETTINGS: SecuritySettings = {
  pinEnabled: false,
  biometricsEnabled: false,
  autoLockTimeout: 5,
  hideBalance: false,
  requireAuthForSend: false,
};

const AUTO_LOCK_OPTIONS = [
  { label: 'Immediately', value: 0 },
  { label: '1 minute', value: 1 },
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: 'Never', value: -1 },
];

export function SecurityScreen() {
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [showPinSetup, setShowPinSetup] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [
        pinEnabled,
        biometricsEnabled,
        autoLockTimeout,
        hideBalance,
        requireAuthForSend,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PIN_ENABLED),
        AsyncStorage.getItem(STORAGE_KEYS.BIOMETRICS_ENABLED),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_LOCK_TIMEOUT),
        AsyncStorage.getItem(STORAGE_KEYS.HIDE_BALANCE),
        AsyncStorage.getItem(STORAGE_KEYS.REQUIRE_AUTH_FOR_SEND),
      ]);

      setSettings({
        pinEnabled: pinEnabled === 'true',
        biometricsEnabled: biometricsEnabled === 'true',
        autoLockTimeout: autoLockTimeout ? parseInt(autoLockTimeout, 10) : 5,
        hideBalance: hideBalance === 'true',
        requireAuthForSend: requireAuthForSend === 'true',
      });
    } catch (error) {
      console.error('[Security] Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('[Security] Failed to save setting:', error);
      Alert.alert('Error', 'Failed to save setting');
    }
  };

  const handlePinToggle = async (enabled: boolean) => {
    if (enabled) {
      // Show PIN setup
      Alert.prompt(
        'Set PIN',
        'Enter a 4-6 digit PIN code:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Set PIN',
            onPress: async (pin: string | undefined) => {
              if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
                Alert.alert('Invalid PIN', 'PIN must be 4-6 digits');
                return;
              }
              await saveSetting(STORAGE_KEYS.PIN_CODE, pin);
              await saveSetting(STORAGE_KEYS.PIN_ENABLED, 'true');
              setSettings(s => ({ ...s, pinEnabled: true }));
              Alert.alert('Success', 'PIN has been set');
            },
          },
        ],
        'secure-text'
      );
    } else {
      // Verify current PIN before disabling
      Alert.prompt(
        'Verify PIN',
        'Enter your current PIN to disable:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async (pin: string | undefined) => {
              const storedPin = await AsyncStorage.getItem(STORAGE_KEYS.PIN_CODE);
              if (pin !== storedPin) {
                Alert.alert('Incorrect PIN', 'The PIN you entered is incorrect');
                return;
              }
              await saveSetting(STORAGE_KEYS.PIN_ENABLED, 'false');
              await AsyncStorage.removeItem(STORAGE_KEYS.PIN_CODE);
              setSettings(s => ({ ...s, pinEnabled: false }));
            },
          },
        ],
        'secure-text'
      );
    }
  };

  const handleBiometricsToggle = async (enabled: boolean) => {
    if (enabled && !settings.pinEnabled) {
      Alert.alert(
        'PIN Required',
        'Please enable PIN code first before enabling biometric authentication.'
      );
      return;
    }

    await saveSetting(STORAGE_KEYS.BIOMETRICS_ENABLED, enabled.toString());
    setSettings(s => ({ ...s, biometricsEnabled: enabled }));

    if (enabled) {
      Alert.alert(
        'Biometrics Enabled',
        Platform.OS === 'ios'
          ? 'You can now use Face ID or Touch ID to unlock the app.'
          : 'You can now use fingerprint to unlock the app.'
      );
    }
  };

  const handleAutoLockChange = () => {
    Alert.alert(
      'Auto-Lock Timeout',
      'Select how long before the app automatically locks:',
      AUTO_LOCK_OPTIONS.map(option => ({
        text: option.label,
        onPress: async () => {
          await saveSetting(STORAGE_KEYS.AUTO_LOCK_TIMEOUT, option.value.toString());
          setSettings(s => ({ ...s, autoLockTimeout: option.value }));
        },
      }))
    );
  };

  const handleHideBalanceToggle = async (enabled: boolean) => {
    await saveSetting(STORAGE_KEYS.HIDE_BALANCE, enabled.toString());
    setSettings(s => ({ ...s, hideBalance: enabled }));
  };

  const handleRequireAuthForSendToggle = async (enabled: boolean) => {
    if (enabled && !settings.pinEnabled) {
      Alert.alert(
        'PIN Required',
        'Please enable PIN code first before requiring authentication for sends.'
      );
      return;
    }

    await saveSetting(STORAGE_KEYS.REQUIRE_AUTH_FOR_SEND, enabled.toString());
    setSettings(s => ({ ...s, requireAuthForSend: enabled }));
  };

  const handleChangePIN = () => {
    Alert.prompt(
      'Current PIN',
      'Enter your current PIN:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Next',
          onPress: async (currentPin: string | undefined) => {
            const storedPin = await AsyncStorage.getItem(STORAGE_KEYS.PIN_CODE);
            if (currentPin !== storedPin) {
              Alert.alert('Incorrect PIN', 'The PIN you entered is incorrect');
              return;
            }

            Alert.prompt(
              'New PIN',
              'Enter your new 4-6 digit PIN:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Set PIN',
                  onPress: async (newPin: string | undefined) => {
                    if (!newPin || newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
                      Alert.alert('Invalid PIN', 'PIN must be 4-6 digits');
                      return;
                    }
                    await saveSetting(STORAGE_KEYS.PIN_CODE, newPin);
                    Alert.alert('Success', 'PIN has been changed');
                  },
                },
              ],
              'secure-text'
            );
          },
        },
      ],
      'secure-text'
    );
  };

  const getAutoLockLabel = (): string => {
    const option = AUTO_LOCK_OPTIONS.find(o => o.value === settings.autoLockTimeout);
    return option?.label || '5 minutes';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading security settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Authentication Section */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Authentication</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>PIN Code</Text>
            <Text style={styles.settingDescription}>
              Require PIN to open the app
            </Text>
          </View>
          <Switch
            value={settings.pinEnabled}
            onValueChange={handlePinToggle}
            trackColor={{
              false: theme.colors.background.tertiary,
              true: theme.colors.primary[500],
            }}
          />
        </View>

        {settings.pinEnabled && (
          <Button
            variant="secondary"
            onPress={handleChangePIN}
            style={styles.changePinButton}
          >
            Change PIN
          </Button>
        )}

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Biometric Authentication</Text>
            <Text style={styles.settingDescription}>
              {Platform.OS === 'ios'
                ? 'Use Face ID or Touch ID'
                : 'Use fingerprint'}
            </Text>
          </View>
          <Switch
            value={settings.biometricsEnabled}
            onValueChange={handleBiometricsToggle}
            trackColor={{
              false: theme.colors.background.tertiary,
              true: theme.colors.primary[500],
            }}
          />
        </View>
      </Card>

      {/* Auto-Lock Section */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Auto-Lock</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Lock Timeout</Text>
            <Text style={styles.settingDescription}>
              Auto-lock after inactivity
            </Text>
          </View>
          <Button
            variant="secondary"
            onPress={handleAutoLockChange}
            style={styles.selectButton}
          >
            {getAutoLockLabel()}
          </Button>
        </View>
      </Card>

      {/* Privacy Section */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Privacy</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Hide Balance</Text>
            <Text style={styles.settingDescription}>
              Show *** instead of actual balance
            </Text>
          </View>
          <Switch
            value={settings.hideBalance}
            onValueChange={handleHideBalanceToggle}
            trackColor={{
              false: theme.colors.background.tertiary,
              true: theme.colors.primary[500],
            }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Require Auth for Sends</Text>
            <Text style={styles.settingDescription}>
              Authenticate before sending tokens
            </Text>
          </View>
          <Switch
            value={settings.requireAuthForSend}
            onValueChange={handleRequireAuthForSendToggle}
            trackColor={{
              false: theme.colors.background.tertiary,
              true: theme.colors.primary[500],
            }}
          />
        </View>
      </Card>

      {/* Security Tips */}
      <Card style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>Security Tips</Text>
        <Text style={styles.tipText}>
          * Enable PIN code to protect your wallet from unauthorized access
        </Text>
        <Text style={styles.tipText}>
          * Use biometric authentication for faster, more secure unlocking
        </Text>
        <Text style={styles.tipText}>
          * Keep your backup phrase safe and never share it
        </Text>
        <Text style={styles.tipText}>
          * Only use trusted mints for larger amounts
        </Text>
        <Text style={styles.tipText}>
          * Remember: Cashu mints are custodial - the operator can rug your funds
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
  card: {
    marginTop: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
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
  changePinButton: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  selectButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  tipsCard: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.primary[500] + '10',
  },
  tipsTitle: {
    ...theme.typography.h4,
    color: theme.colors.primary[500],
    marginBottom: theme.spacing.md,
  },
  tipText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
});

export default SecurityScreen;
