/**
 * Input Component
 *
 * Reusable text input component with variants and states.
 *
 * Features:
 * - Label and helper text
 * - Error states
 * - Icons (left/right)
 * - Different sizes
 * - Multiline support
 */

import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { theme } from '../theme';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  error?: string;
  size?: InputSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export function Input({
  label,
  helperText,
  error,
  size = 'md',
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  ...textInputProps
}: InputProps) {
  const hasError = !!error;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          styles[`${size}InputContainer`],
          hasError && styles.errorContainer,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          style={[
            styles.input,
            styles[`${size}Input`],
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            inputStyle,
          ]}
          placeholderTextColor={theme.colors.text.tertiary}
          {...textInputProps}
        />

        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  label: {
    ...theme.typography.label,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.sm,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border.primary,
    paddingHorizontal: theme.spacing.md,
  },

  smInputContainer: {
    height: theme.inputHeight.sm,
  },

  mdInputContainer: {
    height: theme.inputHeight.md,
  },

  lgInputContainer: {
    height: theme.inputHeight.lg,
  },

  errorContainer: {
    borderColor: theme.colors.status.error,
  },

  input: {
    flex: 1,
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
    padding: 0,
  },

  smInput: {
    fontSize: theme.fontSize.sm,
  },

  mdInput: {
    fontSize: theme.fontSize.base,
  },

  lgInput: {
    fontSize: theme.fontSize.lg,
  },

  inputWithLeftIcon: {
    marginLeft: theme.spacing.sm,
  },

  inputWithRightIcon: {
    marginRight: theme.spacing.sm,
  },

  leftIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  rightIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  helperText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },

  errorText: {
    ...theme.typography.caption,
    color: theme.colors.status.error,
    marginTop: theme.spacing.xs,
  },
});

export default Input;
