/**
 * Scan Navigator
 *
 * Stack navigator for the Scan tab.
 * Handles QR code and NFC scanning.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScanStackParamList } from './types';
import { theme } from '../theme';

// Screens
import ScanMainScreen from '../screens/Scan/ScanMainScreen';
import ScanResultScreen from '../screens/Scan/ScanResultScreen';

const Stack = createNativeStackNavigator<ScanStackParamList>();

export function ScanNavigator() {
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
        name="ScanMain"
        component={ScanMainScreen}
        options={{
          title: 'Scan',
          headerShown: false, // Camera view is full screen
        }}
      />

      <Stack.Screen
        name="ScanResult"
        component={ScanResultScreen}
        options={{
          title: 'Scan Result',
        }}
      />
    </Stack.Navigator>
  );
}

export default ScanNavigator;
