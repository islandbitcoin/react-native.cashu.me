/**
 * Root Navigator
 *
 * Main navigation structure for the app.
 * Handles tab navigation and modal screens.
 *
 * Structure:
 * - Root Stack (modals, onboarding)
 *   - Tab Navigator (main app)
 *     - Home Stack
 *     - Scan Stack
 *     - Send Stack
 *     - History Stack
 *     - Settings Stack
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootStackParamList, TabParamList } from './types';
import { theme } from '../theme';

// Tab Navigators (imported below)
import HomeNavigator from './HomeNavigator';
import SendNavigator from './SendNavigator';
import ReceiveNavigator from './ReceiveNavigator';
import ScanNavigator from './ScanNavigator';
import HistoryNavigator from './HistoryNavigator';
import SettingsNavigator from './SettingsNavigator';

// Components
import { TabBarIcon } from '../components/TabBarIcon';

// Modal Screens - use placeholder screens
import {
  OnboardingScreen,
  CreateWalletScreen,
  ImportWalletScreen,
  OCRAlertScreen,
} from '../screens/PLACEHOLDER_SCREENS';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

/**
 * Tab Navigator Component
 */
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.background.secondary,
          borderTopColor: theme.colors.border.primary,
          borderTopWidth: 1,
          height: theme.tabBar.height,
          paddingBottom: theme.spacing.sm,
          paddingTop: theme.spacing.sm,
        },
        tabBarActiveTintColor: theme.colors.primary[500],
        tabBarInactiveTintColor: theme.colors.text.secondary,
        tabBarLabelStyle: {
          fontSize: theme.fontSize.xs,
          fontFamily: theme.fontFamily.medium,
          fontWeight: theme.fontWeight.medium,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="home" color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Scan"
        component={ScanNavigator}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="scan" color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Send"
        component={SendNavigator}
        options={{
          tabBarLabel: 'Send',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="send" color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="History"
        component={HistoryNavigator}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="history" color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsNavigator}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Root Navigator Component
 */
export function RootNavigator() {
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: theme.colors.primary[500],
          background: theme.colors.background.primary,
          card: theme.colors.background.secondary,
          text: theme.colors.text.primary,
          border: theme.colors.border.primary,
          notification: theme.colors.status.error,
        },
        fonts: {
          regular: { fontFamily: theme.fontFamily.regular, fontWeight: '400' },
          medium: { fontFamily: theme.fontFamily.medium, fontWeight: '500' },
          bold: { fontFamily: theme.fontFamily.bold, fontWeight: '700' },
          heavy: { fontFamily: theme.fontFamily.bold, fontWeight: '900' },
        },
      }}
    >
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      >
        {/* Main app with tabs */}
        <RootStack.Screen name="Main" component={TabNavigator} />

        {/* Onboarding flow */}
        <RootStack.Group
          screenOptions={{
            presentation: 'fullScreenModal',
          }}
        >
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
          <RootStack.Screen name="CreateWallet" component={CreateWalletScreen} />
          <RootStack.Screen name="ImportWallet" component={ImportWalletScreen} />
        </RootStack.Group>

        {/* Modal screens */}
        <RootStack.Group
          screenOptions={{
            presentation: 'modal',
          }}
        >
          <RootStack.Screen name="ReceiveModal" component={ReceiveNavigator} />
          <RootStack.Screen name="OCRAlert" component={OCRAlertScreen} />
        </RootStack.Group>
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default RootNavigator;
