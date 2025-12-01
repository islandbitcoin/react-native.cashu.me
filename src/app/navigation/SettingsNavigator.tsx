/**
 * Settings Navigator
 *
 * Stack navigator for the Settings tab.
 * Handles all settings screens including OCR, mints, transport, backup.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsStackParamList } from './types';
import { theme } from '../theme';

// Real Screens
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { SecurityScreen } from '../screens/Settings/SecurityScreen';
import { AboutScreen } from '../screens/Settings/AboutScreen';
import { BackupRecoveryScreen } from '../screens/Settings/BackupRecoveryScreen';
import { MintManagementScreen } from '../screens/Mints/MintManagementScreen';
import { MintDiscoveryScreen } from '../screens/Mints/MintDiscoveryScreen';
import { MintAddScreen } from '../screens/Mints/MintAddScreen';
import { MintDetailsScreen } from '../screens/Mints/MintDetailsScreen';
import { OCRConfigurationScreen } from '../screens/OCR/OCRConfigurationScreen';
import { TransportSelectionScreen } from '../screens/Transport/TransportSelectionScreen';

// Placeholder Screens (to be implemented)
import {
  BackupExportScreen,
  BackupImportScreen,
} from '../screens/PLACEHOLDER_SCREENS';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.background.primary,
        },
        headerTintColor: theme.colors.text.primary,
        headerTitleStyle: {
          fontFamily: theme.fontFamily.bold,
          fontSize: theme.fontSize.lg,
        },
        headerShadowVisible: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />

      <Stack.Screen
        name="OCRConfiguration"
        component={OCRConfigurationScreen}
        options={{
          title: 'Offline Cash Reserve',
        }}
      />

      <Stack.Screen
        name="MintManagement"
        component={MintManagementScreen}
        options={{
          title: 'Manage Mints',
        }}
      />

      <Stack.Screen
        name="MintDiscovery"
        component={MintDiscoveryScreen}
        options={{
          title: 'Discover Mints',
        }}
      />

      <Stack.Screen
        name="MintAdd"
        component={MintAddScreen}
        options={{
          title: 'Add Mint',
        }}
      />

      <Stack.Screen
        name="MintDetails"
        component={MintDetailsScreen}
        options={{
          title: 'Mint Details',
        }}
      />

      <Stack.Screen
        name="TransportSelection"
        component={TransportSelectionScreen}
        options={{
          title: 'Payment Transports',
        }}
      />

      <Stack.Screen
        name="BackupRecovery"
        component={BackupRecoveryScreen}
        options={{
          title: 'Backup & Recovery',
        }}
      />

      <Stack.Screen
        name="BackupExport"
        component={BackupExportScreen}
        options={{
          title: 'Export Backup',
        }}
      />

      <Stack.Screen
        name="BackupImport"
        component={BackupImportScreen}
        options={{
          title: 'Import Backup',
        }}
      />

      <Stack.Screen
        name="Security"
        component={SecurityScreen}
        options={{
          title: 'Security',
        }}
      />

      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{
          title: 'About',
        }}
      />
    </Stack.Navigator>
  );
}

export default SettingsNavigator;
