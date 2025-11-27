/**
 * Card Component
 *
 * Reusable card container component.
 *
 * Features:
 * - Elevated shadow
 * - Rounded corners
 * - Consistent padding
 * - Pressable variant
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { theme } from '../theme';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  elevated?: boolean;
  padding?: keyof typeof theme.spacing;
}

export function Card({
  children,
  onPress,
  style,
  elevated = true,
  padding = 'lg',
}: CardProps) {
  const paddingValue = theme.spacing[padding];

  if (onPress) {
    return (
      <TouchableOpacity
        style={[
          styles.container,
          elevated && styles.elevated,
          { padding: paddingValue },
          style,
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.container,
        elevated && styles.elevated,
        { padding: paddingValue },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border.primary,
  },

  elevated: {
    ...theme.shadow.md,
    elevation: theme.elevation.md,
  },
});

export default Card;
