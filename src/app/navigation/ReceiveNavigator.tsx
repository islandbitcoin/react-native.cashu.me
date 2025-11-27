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

// Screens
import ReceiveMainScreen from '../screens/Receive/ReceiveMainScreen';
import ReceiveAmountScreen from '../screens/Receive/ReceiveAmountScreen';
import ReceiveQRScreen from '../screens/Receive/ReceiveQRScreen';
import ReceiveSuccessScreen from '../screens/Receive/ReceiveSuccessScreen';

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
        component={ReceiveMainScreen}
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
    </Stack.Navigator>
  );
}

export default ReceiveNavigator;
