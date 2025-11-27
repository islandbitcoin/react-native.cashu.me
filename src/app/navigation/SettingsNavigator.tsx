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

// Screens
import SettingsMainScreen from '../screens/Settings/SettingsMainScreen';
import OCRConfigurationScreen from '../screens/Settings/OCRConfigurationScreen';
import MintManagementScreen from '../screens/Settings/MintManagementScreen';
import MintAddScreen from '../screens/Settings/MintAddScreen';
import MintDetailsScreen from '../screens/Settings/MintDetailsScreen';
import TransportSelectionScreen from '../screens/Settings/TransportSelectionScreen';
import BackupRecoveryScreen from '../screens/Settings/BackupRecoveryScreen';
import BackupExportScreen from '../screens/Settings/BackupExportScreen';
import BackupImportScreen from '../screens/Settings/BackupImportScreen';
import SecurityScreen from '../screens/Settings/SecurityScreen';
import AboutScreen from '../screens/Settings/AboutScreen';

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
        component={SettingsMainScreen}
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
