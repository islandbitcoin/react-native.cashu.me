/**
 * Receive Navigator
 *
 * Stack navigator for the Receive flow.
 * Handles receive payment screens.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ReceiveStackParamList } from './types';
import { theme } from '../theme';

// Real Screens
import { ReceiveScreen } from '../screens/Receive/ReceiveScreen';
import { MintAddScreen } from '../screens/Mints/MintAddScreen';
import { MintDiscoveryScreen } from '../screens/Mints/MintDiscoveryScreen';

// Placeholder Screens
import {
  ReceiveAmountScreen,
  ReceiveQRScreen,
  ReceiveSuccessScreen,
} from '../screens/PLACEHOLDER_SCREENS';

const Stack = createNativeStackNavigator<ReceiveStackParamList>();

export function ReceiveNavigator() {
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
        name="ReceiveMain"
        component={ReceiveScreen}
        options={{
          title: 'Receive Payment',
        }}
      />

      <Stack.Screen
        name="ReceiveAmount"
        component={ReceiveAmountScreen}
        options={{
          title: 'Enter Amount',
        }}
      />

      <Stack.Screen
        name="ReceiveQR"
        component={ReceiveQRScreen}
        options={{
          title: 'Show QR Code',
        }}
      />

      <Stack.Screen
        name="ReceiveSuccess"
        component={ReceiveSuccessScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
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
        name="MintDiscovery"
        component={MintDiscoveryScreen}
        options={{
          title: 'Discover Mints',
        }}
      />
    </Stack.Navigator>
  );
}

export default ReceiveNavigator;
