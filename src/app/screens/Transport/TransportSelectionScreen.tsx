/**
 * Transport Selection Screen
 *
 * Configures payment transport settings including:
 * - NFC (tap-to-pay)
 * - Bluetooth LE (nearby devices)
 * - QR Code (camera scan)
 *
 * Shows availability status and allows enabling/disabling transports.
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
  Platform,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import {
  TransportManager,
  TransportType,
  TransportStatus,
  TransportCapabilities,
} from '../../../core/transport/TransportInterface';

// Storage keys for transport preferences
const STORAGE_KEYS = {
  NFC_ENABLED: '@transport/nfc_enabled',
  BLUETOOTH_ENABLED: '@transport/bluetooth_enabled',
  QR_ENABLED: '@transport/qr_enabled',
  PREFERRED_TRANSPORT: '@transport/preferred',
};

interface TransportInfo {
  type: TransportType;
  name: string;
  description: string;
  icon: string;
  available: boolean;
  enabled: boolean;
  status: TransportStatus;
  capabilities?: TransportCapabilities;
  unavailableReason?: string;
}

export function TransportSelectionScreen() {
  const [transports, setTransports] = useState<TransportInfo[]>([]);
  const [preferredTransport, setPreferredTransport] = useState<TransportType | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTransportData = async () => {
    try {
      const transportManager = TransportManager.getInstance();

      // Define transport info
      const transportDefinitions = [
        {
          type: TransportType.NFC,
          name: 'NFC',
          description: 'Tap-to-pay using Near Field Communication',
          icon: 'N',
          storageKey: STORAGE_KEYS.NFC_ENABLED,
        },
        {
          type: TransportType.BLUETOOTH,
          name: 'Bluetooth',
          description: 'Send/receive via Bluetooth Low Energy',
          icon: 'B',
          storageKey: STORAGE_KEYS.BLUETOOTH_ENABLED,
        },
        {
          type: TransportType.QR_CODE,
          name: 'QR Code',
          description: 'Scan or display QR codes for payment',
          icon: 'Q',
          storageKey: STORAGE_KEYS.QR_ENABLED,
        },
      ];

      const transportInfos: TransportInfo[] = [];

      for (const def of transportDefinitions) {
        const transport = transportManager.getTransport(def.type);
        let available = false;
        let status = TransportStatus.IDLE;
        let capabilities: TransportCapabilities | undefined;
        let unavailableReason: string | undefined;

        if (transport) {
          try {
            available = await transport.isAvailable();
            status = transport.getStatus();
            capabilities = transport.getCapabilities();
          } catch (error) {
            available = false;
            unavailableReason = 'Failed to check availability';
          }
        } else {
          unavailableReason = 'Transport not registered';
        }

        // Check platform-specific availability
        if (!available) {
          if (def.type === TransportType.NFC) {
            if (Platform.OS === 'ios') {
              unavailableReason = 'NFC requires iOS 13+ and iPhone 7 or later';
            } else {
              unavailableReason = 'NFC not available on this device';
            }
          } else if (def.type === TransportType.BLUETOOTH) {
            unavailableReason = 'Bluetooth permission required';
          }
        }

        // Load enabled state from storage
        const enabledStr = await AsyncStorage.getItem(def.storageKey);
        const enabled = enabledStr !== 'false'; // Default to true

        transportInfos.push({
          type: def.type,
          name: def.name,
          description: def.description,
          icon: def.icon,
          available,
          enabled: enabled && available,
          status,
          capabilities,
          unavailableReason,
        });
      }

      setTransports(transportInfos);

      // Load preferred transport
      const preferred = await AsyncStorage.getItem(STORAGE_KEYS.PREFERRED_TRANSPORT);
      if (preferred) {
        setPreferredTransport(preferred as TransportType);
      } else {
        // Default to first available
        const firstAvailable = transportInfos.find(t => t.available);
        if (firstAvailable) {
          setPreferredTransport(firstAvailable.type);
        }
      }
    } catch (error) {
      console.error('[TransportSelection] Failed to load transport data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTransportData();
    }, [])
  );

  const handleToggleTransport = async (type: TransportType, enabled: boolean) => {
    const storageKey = {
      [TransportType.NFC]: STORAGE_KEYS.NFC_ENABLED,
      [TransportType.BLUETOOTH]: STORAGE_KEYS.BLUETOOTH_ENABLED,
      [TransportType.QR_CODE]: STORAGE_KEYS.QR_ENABLED,
    }[type];

    try {
      await AsyncStorage.setItem(storageKey, enabled.toString());

      setTransports(prev =>
        prev.map(t =>
          t.type === type ? { ...t, enabled: enabled && t.available } : t
        )
      );

      // If disabling preferred transport, switch to another
      if (!enabled && preferredTransport === type) {
        const nextAvailable = transports.find(t => t.type !== type && t.available && t.enabled);
        if (nextAvailable) {
          await handleSetPreferred(nextAvailable.type);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update transport setting');
    }
  };

  const handleSetPreferred = async (type: TransportType) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERRED_TRANSPORT, type);
      setPreferredTransport(type);
    } catch (error) {
      Alert.alert('Error', 'Failed to set preferred transport');
    }
  };

  const handleOpenSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const handleTestTransport = async (type: TransportType) => {
    const transportManager = TransportManager.getInstance();
    const transport = transportManager.getTransport(type);

    if (!transport) {
      Alert.alert('Error', 'Transport not available');
      return;
    }

    try {
      await transport.initialize();
      Alert.alert('Success', `${type} transport initialized successfully!`);
    } catch (error: any) {
      Alert.alert('Test Failed', error.message || 'Failed to initialize transport');
    }
  };

  const getStatusColor = (status: TransportStatus): string => {
    switch (status) {
      case TransportStatus.READY:
      case TransportStatus.CONNECTED:
        return theme.colors.status.success;
      case TransportStatus.CONNECTING:
      case TransportStatus.SENDING:
      case TransportStatus.RECEIVING:
        return theme.colors.primary[500];
      case TransportStatus.ERROR:
        return theme.colors.status.error;
      default:
        return theme.colors.text.tertiary;
    }
  };

  const getStatusLabel = (status: TransportStatus): string => {
    switch (status) {
      case TransportStatus.READY:
        return 'Ready';
      case TransportStatus.CONNECTED:
        return 'Connected';
      case TransportStatus.CONNECTING:
        return 'Connecting...';
      case TransportStatus.SENDING:
        return 'Sending...';
      case TransportStatus.RECEIVING:
        return 'Receiving...';
      case TransportStatus.ERROR:
        return 'Error';
      default:
        return 'Idle';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading transport settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.headerText}>
        Choose how you want to send and receive offline payments.
      </Text>

      {/* Transport Cards */}
      {transports.map((transport) => (
        <Card
          key={transport.type}
          style={transport.available ? styles.transportCard : styles.transportCardDisabled}
        >
          <View style={styles.transportHeader}>
            <View style={styles.transportIcon}>
              <Text style={styles.transportIconText}>{transport.icon}</Text>
            </View>
            <View style={styles.transportInfo}>
              <Text style={styles.transportName}>{transport.name}</Text>
              <Text style={styles.transportDescription}>{transport.description}</Text>
            </View>
            <Switch
              value={transport.enabled}
              onValueChange={(enabled) => handleToggleTransport(transport.type, enabled)}
              disabled={!transport.available}
              trackColor={{
                false: theme.colors.background.tertiary,
                true: theme.colors.primary[500],
              }}
            />
          </View>

          {/* Availability Status */}
          <View style={styles.transportStatus}>
            {transport.available ? (
              <>
                <View
                  style={[styles.statusDot, { backgroundColor: getStatusColor(transport.status) }]}
                />
                <Text style={styles.statusText}>{getStatusLabel(transport.status)}</Text>
              </>
            ) : (
              <Text style={styles.unavailableText}>{transport.unavailableReason}</Text>
            )}
          </View>

          {/* Capabilities */}
          {transport.available && transport.capabilities && (
            <View style={styles.capabilities}>
              <View style={styles.capabilityRow}>
                <Text style={styles.capabilityLabel}>Max Payload:</Text>
                <Text style={styles.capabilityValue}>
                  {(transport.capabilities.maxPayloadSize / 1024).toFixed(0)} KB
                </Text>
              </View>
              <View style={styles.capabilityRow}>
                <Text style={styles.capabilityLabel}>Can Send:</Text>
                <Text style={styles.capabilityValue}>
                  {transport.capabilities.canSend ? 'Yes' : 'No'}
                </Text>
              </View>
              <View style={styles.capabilityRow}>
                <Text style={styles.capabilityLabel}>Can Receive:</Text>
                <Text style={styles.capabilityValue}>
                  {transport.capabilities.canReceive ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>
          )}

          {/* Preferred Badge */}
          {transport.available && preferredTransport === transport.type && (
            <View style={styles.preferredBadge}>
              <Text style={styles.preferredText}>Preferred</Text>
            </View>
          )}

          {/* Actions */}
          {transport.available && transport.enabled && (
            <View style={styles.transportActions}>
              {preferredTransport !== transport.type && (
                <Button
                  variant="secondary"
                  onPress={() => handleSetPreferred(transport.type)}
                  style={styles.actionButton}
                >
                  Set as Preferred
                </Button>
              )}
              <Button
                variant="secondary"
                onPress={() => handleTestTransport(transport.type)}
                style={styles.actionButton}
              >
                Test Connection
              </Button>
            </View>
          )}
        </Card>
      ))}

      {/* Permissions Help */}
      <Card style={styles.helpCard}>
        <Text style={styles.helpTitle}>Need to enable permissions?</Text>
        <Text style={styles.helpText}>
          Some transports require system permissions (NFC, Bluetooth, Camera).
          Tap below to open device settings.
        </Text>
        <Button variant="secondary" onPress={handleOpenSettings}>
          Open Device Settings
        </Button>
      </Card>

      {/* Info */}
      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>About Offline Transports</Text>

        <View style={styles.infoSection}>
          <Text style={styles.infoSectionTitle}>NFC (Tap-to-Pay)</Text>
          <Text style={styles.infoText}>
            The fastest method for face-to-face payments. Simply tap your phone
            against another NFC-enabled device. Best for quick transactions like
            paying at a register.
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoSectionTitle}>Bluetooth</Text>
          <Text style={styles.infoText}>
            Works at slightly longer range than NFC. Good for sending larger
            amounts that exceed NFC payload limits. Requires device pairing.
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoSectionTitle}>QR Code</Text>
          <Text style={styles.infoText}>
            Universal fallback method. Display a QR code for others to scan,
            or scan someone else's code. Works on all devices with a camera.
            Best for printed codes or when other methods aren't available.
          </Text>
        </View>
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
  headerText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  transportCard: {
    marginTop: theme.spacing.md,
  },
  transportCardDisabled: {
    marginTop: theme.spacing.md,
    opacity: 0.6,
  },
  transportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transportIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  transportIconText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text.inverse,
  },
  transportInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  transportName: {
    ...theme.typography.h4,
    color: theme.colors.text.primary,
  },
  transportDescription: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  transportStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.primary,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.sm,
  },
  statusText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  unavailableText: {
    ...theme.typography.caption,
    color: theme.colors.status.error,
  },
  capabilities: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.sm,
  },
  capabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  capabilityLabel: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  capabilityValue: {
    ...theme.typography.caption,
    color: theme.colors.text.primary,
    fontFamily: theme.fontFamily.mono,
  },
  preferredBadge: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.status.success + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  preferredText: {
    ...theme.typography.caption,
    color: theme.colors.status.success,
    fontFamily: theme.fontFamily.medium,
  },
  transportActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  helpCard: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.status.info + '10',
    borderColor: theme.colors.status.info + '40',
    borderWidth: 1,
  },
  helpTitle: {
    ...theme.typography.h4,
    color: theme.colors.status.info,
    marginBottom: theme.spacing.sm,
  },
  helpText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
  },
  infoCard: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary[500] + '10',
  },
  infoTitle: {
    ...theme.typography.h4,
    color: theme.colors.primary[500],
    marginBottom: theme.spacing.md,
  },
  infoSection: {
    marginBottom: theme.spacing.md,
  },
  infoSectionTitle: {
    ...theme.typography.label,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  infoText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
});

export default TransportSelectionScreen;
