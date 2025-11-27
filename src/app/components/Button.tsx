/**
 * Button Component
 *
 * Reusable button component with variants and states.
 *
 * Variants:
 * - primary: Main action button (Cashu purple)
 * - secondary: Secondary actions (gray)
 * - outline: Outlined button
 * - ghost: Text-only button
 * - danger: Destructive actions (red)
 *
 * Sizes:
 * - sm: 32px height
 * - md: 44px height (default)
 * - lg: 56px height
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { theme } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[`${variant}Container`],
        styles[`${size}Container`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? theme.colors.primary[500] : theme.colors.white}
        />
      ) : (
        <Text
          style={[
            styles.text,
            styles[`${variant}Text`],
            styles[`${size}Text`],
            isDisabled && styles.disabledText,
            textStyle,
          ]}
        >
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.lg,
  },

  fullWidth: {
    width: '100%',
  },

  // Sizes
  smContainer: {
    height: theme.buttonHeight.sm,
  },

  mdContainer: {
    height: theme.buttonHeight.md,
  },

  lgContainer: {
    height: theme.buttonHeight.lg,
  },

  // Variants
  primaryContainer: {
    backgroundColor: theme.colors.button.primary,
  },

  secondaryContainer: {
    backgroundColor: theme.colors.button.secondary,
  },

  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: theme.borderWidth.medium,
    borderColor: theme.colors.primary[500],
  },

  ghostContainer: {
    backgroundColor: 'transparent',
  },

  dangerContainer: {
    backgroundColor: theme.colors.status.error,
  },

  // Disabled state
  disabled: {
    backgroundColor: theme.colors.button.disabled,
    opacity: theme.opacity.disabled,
  },

  // Text styles
  text: {
    fontFamily: theme.fontFamily.medium,
    fontWeight: theme.fontWeight.semibold,
  },

  smText: {
    fontSize: theme.fontSize.sm,
  },

  mdText: {
    fontSize: theme.fontSize.base,
  },

  lgText: {
    fontSize: theme.fontSize.lg,
  },

  primaryText: {
    color: theme.colors.white,
  },

  secondaryText: {
    color: theme.colors.text.primary,
  },

  outlineText: {
    color: theme.colors.primary[500],
  },

  ghostText: {
    color: theme.colors.primary[500],
  },

  dangerText: {
    color: theme.colors.white,
  },

  disabledText: {
    color: theme.colors.text.tertiary,
  },
});

export default Button;
