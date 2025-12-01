/**
 * TabBarIcon Component
 *
 * Simple text-based icons for tab bar navigation.
 * Uses unicode characters that render well on both platforms.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TabBarIconProps {
  name: 'home' | 'scan' | 'send' | 'history' | 'settings';
  color: string;
  size: number;
}

// Unicode characters that work as icons
const ICONS: Record<TabBarIconProps['name'], string> = {
  home: '\u2302',      // House symbol ⌂
  scan: '\u25A3',      // QR-like square ▣
  send: '\u2191',      // Up arrow ↑
  history: '\u2630',   // Trigram for heaven ☰ (looks like list)
  settings: '\u2699',  // Gear ⚙
};

// Alternative: Using simple text letters in circles
const ICON_LETTERS: Record<TabBarIconProps['name'], string> = {
  home: 'H',
  scan: 'S',
  send: 'T',  // Transfer
  history: 'L',  // List
  settings: 'G',  // Gear
};

export function TabBarIcon({ name, color, size }: TabBarIconProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Text style={[styles.icon, { color, fontSize: size * 0.8 }]}>
        {ICONS[name]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontWeight: '400',
  },
});

export default TabBarIcon;
