/**
 * Home Navigator
 *
 * Stack navigator for the Home tab.
 * Handles balance screen and transaction/proof details.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeStackParamList } from './types';
import { theme } from '../theme';

// Screens
import HomeScreen from '../screens/Home/HomeScreen';
import TransactionDetailsScreen from '../screens/History/TransactionDetailsScreen';
import ProofDetailsScreen from '../screens/Home/ProofDetailsScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
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
        name="HomeMain"
        component={HomeScreen}
        options={{
          title: 'Cashu Wallet',
        }}
      />

      <Stack.Screen
        name="TransactionDetails"
        component={TransactionDetailsScreen}
        options={{
          title: 'Transaction Details',
        }}
      />

      <Stack.Screen
        name="ProofDetails"
        component={ProofDetailsScreen}
        options={{
          title: 'Proof Details',
        }}
      />
    </Stack.Navigator>
  );
}

export default HomeNavigator;
