/**
 * Send Navigator
 *
 * Stack navigator for the Send tab.
 * Handles send payment flow.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SendStackParamList } from './types';
import { theme } from '../theme';

// Real Screens
import { SendScreen } from '../screens/Send/SendScreen';
import SendAmountScreen from '../screens/Send/SendAmountScreen';

// Placeholder Screens (to be implemented)
import {
  SendConfirmScreen,
  SendTransportScreen,
  SendSuccessScreen,
} from '../screens/PLACEHOLDER_SCREENS';

const Stack = createNativeStackNavigator<SendStackParamList>();

export function SendNavigator() {
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
        name="SendMain"
        component={SendScreen}
        options={{
          title: 'Send Payment',
        }}
      />

      <Stack.Screen
        name="SendAmount"
        component={SendAmountScreen}
        options={{
          title: 'Enter Amount',
        }}
      />

      <Stack.Screen
        name="SendConfirm"
        component={SendConfirmScreen}
        options={{
          title: 'Confirm Payment',
        }}
      />

      <Stack.Screen
        name="SendTransport"
        component={SendTransportScreen}
        options={{
          title: 'Choose Transport',
        }}
      />

      <Stack.Screen
        name="SendSuccess"
        component={SendSuccessScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}

export default SendNavigator;
