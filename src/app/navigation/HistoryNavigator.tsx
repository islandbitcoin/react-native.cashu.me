/**
 * History Navigator
 *
 * Stack navigator for the History tab.
 * Handles transaction history and filtering.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HistoryStackParamList } from './types';
import { theme } from '../theme';

// Real Screens
import { HistoryScreen } from '../screens/History/HistoryScreen';

// Placeholder Screens
import {
  HistoryFilterScreen,
  TransactionDetailsScreen,
} from '../screens/PLACEHOLDER_SCREENS';

const Stack = createNativeStackNavigator<HistoryStackParamList>();

export function HistoryNavigator() {
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
        name="HistoryMain"
        component={HistoryScreen}
        options={{
          title: 'Transaction History',
        }}
      />

      <Stack.Screen
        name="HistoryFilter"
        component={HistoryFilterScreen}
        options={{
          title: 'Filter',
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="TransactionDetails"
        component={TransactionDetailsScreen}
        options={{
          title: 'Transaction Details',
        }}
      />
    </Stack.Navigator>
  );
}

export default HistoryNavigator;
