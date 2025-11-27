/**
 * =============================================================================
 * Button.tsx
 * =============================================================================
 *
 * A flexible, reusable button component following the Cashu Wallet design system.
 *
 * DESIGN PHILOSOPHY
 * -----------------
 * This button component is designed with several principles in mind:
 *
 * 1. CONSISTENCY: All buttons across the app look and behave the same
 * 2. ACCESSIBILITY: Proper touch targets (44px minimum) and disabled states
 * 3. FLEXIBILITY: Multiple variants and sizes for different contexts
 * 4. PERFORMANCE: Minimal re-renders, optimized styling
 *
 * VARIANTS EXPLAINED
 * ------------------
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ VARIANT     │ USE CASE                      │ APPEARANCE               │
 * ├─────────────┼───────────────────────────────┼──────────────────────────┤
 * │ primary     │ Main CTA (Send, Confirm)      │ Purple bg, white text    │
 * │ secondary   │ Secondary actions (Cancel)    │ Gray bg, dark text       │
 * │ outline     │ Alternative actions           │ Purple border, purple txt│
 * │ ghost       │ Subtle/tertiary actions       │ Transparent, purple text │
 * │ danger      │ Destructive actions (Delete)  │ Red bg, white text       │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * SIZE SPECIFICATIONS
 * -------------------
 * - sm (32px): Compact UI, inline actions, table rows
 * - md (44px): Default, standard buttons, forms (meets accessibility guidelines)
 * - lg (56px): Primary CTAs, prominent actions, bottom sheets
 *
 * USAGE EXAMPLES
 * --------------
 * ```tsx
 * // Primary action button
 * <Button onPress={handleSend}>Send Payment</Button>
 *
 * // Full-width loading button
 * <Button onPress={handleSubmit} loading={isSubmitting} fullWidth>
 *   Confirm Transaction
 * </Button>
 *
 * // Danger action with custom style
 * <Button variant="danger" onPress={handleDelete} size="sm">
 *   Delete Wallet
 * </Button>
 *
 * // Disabled state
 * <Button onPress={handleAction} disabled={!isValid}>
 *   Continue
 * </Button>
 * ```
 *
 * ACCESSIBILITY NOTES
 * -------------------
 * - Minimum touch target of 44x44 points (iOS) / 48x48 dp (Android)
 * - Disabled state reduces opacity and removes touch feedback
 * - Loading state shows spinner and prevents double-taps
 * - Active opacity (0.7) provides clear press feedback
 *
 * @module app/components/Button
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

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Available button visual styles.
 *
 * Each variant is designed for specific use cases to maintain UI consistency.
 *
 * @example
 * // Use primary for main actions
 * <Button variant="primary" onPress={handleSend}>Send</Button>
 *
 * // Use danger for destructive actions
 * <Button variant="danger" onPress={handleDelete}>Delete</Button>
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

/**
 * Available button sizes.
 *
 * Sizes follow the design system spacing scale and ensure proper touch targets.
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Props for the Button component.
 *
 * @property children - Button content (typically text, but can be any React node)
 * @property onPress - Callback fired when button is pressed (not during loading/disabled)
 * @property variant - Visual style variant (default: 'primary')
 * @property size - Button size affecting height and text size (default: 'md')
 * @property disabled - Prevents interaction and shows disabled visual state
 * @property loading - Shows spinner and prevents interaction
 * @property fullWidth - Expands button to fill parent width
 * @property style - Additional container styles (merged with base styles)
 * @property textStyle - Additional text styles (merged with base text styles)
 */
export interface ButtonProps {
  /** Content to display inside the button (text or React nodes) */
  children: React.ReactNode;

  /** Handler called when button is pressed */
  onPress: () => void;

  /** Visual variant determining colors and styling */
  variant?: ButtonVariant;

  /** Size variant determining height and text size */
  size?: ButtonSize;

  /** Whether the button is disabled (no interaction, reduced opacity) */
  disabled?: boolean;

  /** Whether to show loading spinner (also disables interaction) */
  loading?: boolean;

  /** Whether button should fill parent width */
  fullWidth?: boolean;

  /** Additional styles for the button container */
  style?: ViewStyle;

  /** Additional styles for the button text */
  textStyle?: TextStyle;
}

// =============================================================================
// COMPONENT IMPLEMENTATION
// =============================================================================

/**
 * Button Component
 *
 * A versatile button component that handles common button patterns:
 * - Loading states with spinner
 * - Disabled states
 * - Multiple visual variants
 * - Multiple sizes
 * - Full-width layout option
 *
 * The button automatically handles:
 * - Combining loading and disabled states
 * - Proper touch feedback with activeOpacity
 * - Color-matched loading spinners
 * - Style composition in correct order
 *
 * @param props - See ButtonProps interface
 * @returns A styled TouchableOpacity button
 *
 * @example
 * ```tsx
 * // Simple button
 * <Button onPress={() => console.log('Pressed!')}>Click Me</Button>
 *
 * // Complex usage
 * <Button
 *   variant="primary"
 *   size="lg"
 *   loading={isLoading}
 *   disabled={!formIsValid}
 *   fullWidth
 *   onPress={handleSubmit}
 * >
 *   Submit Payment
 * </Button>
 * ```
 */
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
  // Combine disabled and loading states - both prevent interaction
  const isDisabled = disabled || loading;

  // Determine spinner color based on variant
  // Outline and ghost variants use primary color, others use white
  const spinnerColor =
    variant === 'outline' || variant === 'ghost'
      ? theme.colors.primary[500]
      : theme.colors.white;

  return (
    <TouchableOpacity
      // Apply styles in order: base → variant → size → fullWidth → disabled → custom
      // This order ensures proper cascading and override behavior
      style={[
        styles.base,
        styles[`${variant}Container`],
        styles[`${size}Container`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style, // Custom styles applied last to allow overrides
      ]}
      onPress={onPress}
      disabled={isDisabled}
      // Reduce opacity on press for visual feedback
      // 0.7 provides noticeable but not jarring feedback
      activeOpacity={0.7}
      // Accessibility: ensure button is properly announced
      accessibilityRole="button"
      accessibilityState={{
        disabled: isDisabled,
        busy: loading,
      }}
    >
      {/* Show spinner during loading, otherwise show children */}
      {loading ? (
        <ActivityIndicator color={spinnerColor} size="small" />
      ) : (
        <Text
          // Apply text styles: base → variant → size → disabled → custom
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

// =============================================================================
// STYLES
// =============================================================================

/**
 * StyleSheet for Button component.
 *
 * Organized into sections:
 * 1. Base styles (shared by all buttons)
 * 2. Size variants (height adjustments)
 * 3. Visual variants (colors, backgrounds)
 * 4. State modifiers (disabled)
 * 5. Text styles (matching each variant)
 *
 * Note: StyleSheet.create provides optimization through style ID caching
 */
const styles = StyleSheet.create({
  // ---------------------------------------------------------------------------
  // BASE STYLES
  // ---------------------------------------------------------------------------

  /** Base styles applied to all button variants */
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.lg,
    // Note: height is set by size variants
  },

  /** Full width modifier */
  fullWidth: {
    width: '100%',
  },

  // ---------------------------------------------------------------------------
  // SIZE VARIANTS
  // ---------------------------------------------------------------------------

  /** Small button: 32px height for compact UI */
  smContainer: {
    height: theme.buttonHeight.sm, // 32px
  },

  /** Medium button: 44px height (default, meets accessibility) */
  mdContainer: {
    height: theme.buttonHeight.md, // 44px
  },

  /** Large button: 56px height for prominent CTAs */
  lgContainer: {
    height: theme.buttonHeight.lg, // 56px
  },

  // ---------------------------------------------------------------------------
  // VISUAL VARIANTS
  // ---------------------------------------------------------------------------

  /** Primary: Cashu purple background for main actions */
  primaryContainer: {
    backgroundColor: theme.colors.button.primary,
  },

  /** Secondary: Gray background for secondary actions */
  secondaryContainer: {
    backgroundColor: theme.colors.button.secondary,
  },

  /** Outline: Transparent with purple border */
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: theme.borderWidth.medium,
    borderColor: theme.colors.primary[500],
  },

  /** Ghost: Fully transparent for subtle actions */
  ghostContainer: {
    backgroundColor: 'transparent',
  },

  /** Danger: Red background for destructive actions */
  dangerContainer: {
    backgroundColor: theme.colors.status.error,
  },

  // ---------------------------------------------------------------------------
  // STATE MODIFIERS
  // ---------------------------------------------------------------------------

  /** Disabled state: Reduced opacity and muted background */
  disabled: {
    backgroundColor: theme.colors.button.disabled,
    opacity: theme.opacity.disabled,
  },

  // ---------------------------------------------------------------------------
  // TEXT STYLES
  // ---------------------------------------------------------------------------

  /** Base text style for all buttons */
  text: {
    fontFamily: theme.fontFamily.medium,
    fontWeight: theme.fontWeight.semibold,
  },

  /** Small text size */
  smText: {
    fontSize: theme.fontSize.sm,
  },

  /** Medium text size (default) */
  mdText: {
    fontSize: theme.fontSize.base,
  },

  /** Large text size */
  lgText: {
    fontSize: theme.fontSize.lg,
  },

  /** Primary text: White for contrast on purple */
  primaryText: {
    color: theme.colors.white,
  },

  /** Secondary text: Dark for contrast on gray */
  secondaryText: {
    color: theme.colors.text.primary,
  },

  /** Outline text: Purple to match border */
  outlineText: {
    color: theme.colors.primary[500],
  },

  /** Ghost text: Purple for subtle visibility */
  ghostText: {
    color: theme.colors.primary[500],
  },

  /** Danger text: White for contrast on red */
  dangerText: {
    color: theme.colors.white,
  },

  /** Disabled text: Muted color */
  disabledText: {
    color: theme.colors.text.tertiary,
  },
});

// =============================================================================
// EXPORTS
// =============================================================================

export default Button;
