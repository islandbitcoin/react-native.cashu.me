/**
 * Scan Screen
 *
 * QR code scanner for receiving Cashu tokens.
 * Uses the device camera to scan QR codes containing tokens.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect, CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ScanStackParamList, TabParamList, ReceiveStackParamList, SendStackParamList } from '../../navigation/types';

type ScanMode = 'qr' | 'nfc';

// Composite navigation type to allow navigating to other tabs
type ScanScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<ScanStackParamList, 'ScanMain'>,
  BottomTabNavigationProp<TabParamList>
>;

export function ScanScreen() {
  const navigation = useNavigation<ScanScreenNavigationProp>();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('qr');
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const device = useCameraDevice('back');

  // Check camera permission
  useEffect(() => {
    checkPermission();
  }, []);

  // Activate camera when screen is focused
  useFocusEffect(
    useCallback(() => {
      setIsActive(true);
      setScannedData(null);
      return () => {
        setIsActive(false);
      };
    }, [])
  );

  const checkPermission = async () => {
    const status = await Camera.getCameraPermissionStatus();
    if (status === 'granted') {
      setHasPermission(true);
    } else if (status === 'not-determined') {
      const result = await Camera.requestCameraPermission();
      setHasPermission(result === 'granted');
    } else {
      setHasPermission(false);
    }
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && !isProcessing && !scannedData) {
        const code = codes[0];
        if (code.value) {
          handleScannedCode(code.value);
        }
      }
    },
  });

  const handleScannedCode = async (data: string) => {
    setIsProcessing(true);
    setScannedData(data);
    setIsActive(false);

    // Check if it's a Cashu token
    if (data.startsWith('cashu') || data.startsWith('cashuA') || data.startsWith('cashuB')) {
      // Navigate to ScanResult screen with the token
      navigation.navigate('ScanResult', { data, type: 'token' });
    } else if (data.startsWith('lnbc') || data.startsWith('LNBC') || data.startsWith('lightning:')) {
      // Lightning invoice - navigate to ScanResult screen
      const invoice = data.replace('lightning:', '');
      navigation.navigate('ScanResult', { data: invoice, type: 'payment_request' });
    } else if (data.startsWith('bitcoin:') || data.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/) || data.match(/^bc1/)) {
      // Bitcoin address - show info
      Alert.alert(
        'Bitcoin Address',
        'This is a Bitcoin address. Cashu wallet uses ecash tokens, not on-chain Bitcoin directly.',
        [
          { text: 'OK', onPress: resetScanner },
        ]
      );
    } else {
      // Unknown format
      Alert.alert(
        'Unknown QR Code',
        'This QR code does not contain a recognized Cashu token or Lightning invoice.',
        [
          { text: 'Scan Again', onPress: resetScanner },
          { text: 'Copy Data', onPress: () => handleCopyData(data) },
        ]
      );
    }

    setIsProcessing(false);
  };

  const handleCopyData = async (data: string) => {
    // Would use clipboard here
    Alert.alert('Copied', 'Data copied to clipboard');
    resetScanner();
  };

  const resetScanner = () => {
    setScannedData(null);
    setIsActive(true);
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  // Permission denied view
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            To scan QR codes, please allow camera access in your device settings.
          </Text>
          <Button onPress={openSettings} style={styles.permissionButton}>
            Open Settings
          </Button>
          <Button variant="secondary" onPress={checkPermission} style={styles.permissionButton}>
            Check Again
          </Button>
        </View>
      </View>
    );
  }

  // Loading permission
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Requesting camera permission...</Text>
        </View>
      </View>
    );
  }

  // No camera device
  if (!device) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>No Camera Found</Text>
          <Text style={styles.errorText}>
            Unable to access camera. Please make sure your device has a camera.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive && !scannedData}
        codeScanner={codeScanner}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Text style={styles.title}>Scan QR Code</Text>
          <Text style={styles.subtitle}>
            Point your camera at a Cashu token or Lightning invoice
          </Text>
        </View>

        {/* Scanner Frame */}
        <View style={styles.scannerFrame}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomBar}>
          {/* Mode Selector */}
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeButton, scanMode === 'qr' && styles.modeButtonActive]}
              onPress={() => setScanMode('qr')}
            >
              <Text style={[styles.modeText, scanMode === 'qr' && styles.modeTextActive]}>
                QR Code
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, scanMode === 'nfc' && styles.modeButtonActive]}
              onPress={() => {
                setScanMode('nfc');
                Alert.alert('NFC', 'Hold your phone near an NFC tag to receive tokens.');
              }}
            >
              <Text style={[styles.modeText, scanMode === 'nfc' && styles.modeTextActive]}>
                NFC
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hint */}
          <Card style={styles.hintCard}>
            <Text style={styles.hintTitle}>Supported formats:</Text>
            <Text style={styles.hintText}>* Cashu tokens (cashuA..., cashuB...)</Text>
            <Text style={styles.hintText}>* Lightning invoices (lnbc...)</Text>
          </Card>
        </View>
      </View>

      {/* Processing Indicator */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <Text style={styles.processingText}>Processing...</Text>
        </View>
      )}
    </View>
  );
}

const FRAME_SIZE = 250;
const CORNER_SIZE = 30;
const CORNER_WIDTH = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.screenPadding.horizontal,
  },
  permissionTitle: {
    ...theme.typography.h2,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  permissionText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  permissionButton: {
    marginTop: theme.spacing.md,
    width: '100%',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.screenPadding.horizontal,
  },
  errorTitle: {
    ...theme.typography.h2,
    color: theme.colors.status.error,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingTop: theme.spacing['2xl'],
    paddingHorizontal: theme.screenPadding.horizontal,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingBottom: theme.spacing.lg,
  },
  title: {
    ...theme.typography.h2,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  scannerFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    alignSelf: 'center',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: theme.colors.primary[500],
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: theme.colors.primary[500],
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: theme.colors.primary[500],
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: theme.colors.primary[500],
  },
  bottomBar: {
    padding: theme.screenPadding.horizontal,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing['2xl'],
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  modeButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  modeButtonActive: {
    backgroundColor: theme.colors.primary[500],
  },
  modeText: {
    ...theme.typography.label,
    color: 'rgba(255,255,255,0.6)',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  hintCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'transparent',
  },
  hintTitle: {
    ...theme.typography.label,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: theme.spacing.xs,
  },
  hintText: {
    ...theme.typography.caption,
    color: 'rgba(255,255,255,0.6)',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    ...theme.typography.h3,
    color: '#FFFFFF',
  },
});

export default ScanScreen;
