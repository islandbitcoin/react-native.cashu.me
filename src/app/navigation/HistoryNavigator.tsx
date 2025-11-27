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

// Screens
import HistoryMainScreen from '../screens/History/HistoryMainScreen';
import HistoryFilterScreen from '../screens/History/HistoryFilterScreen';
import TransactionDetailsScreen from '../screens/History/TransactionDetailsScreen';

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
        component={HistoryMainScreen}
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
