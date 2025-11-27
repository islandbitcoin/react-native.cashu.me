/**
 * Spacing & Layout
 *
 * Defines consistent spacing, sizing, and layout values.
 *
 * Spacing Scale:
 * - Based on 4px grid for consistency
 * - Ranges from 4px to 96px
 * - Common values: 8, 12, 16, 24, 32
 *
 * Design Principles:
 * - Consistent spacing creates visual rhythm
 * - Responsive to different screen sizes
 * - Follows iOS/Android design guidelines
 */

/**
 * Spacing scale (based on 4px grid)
 */
export const spacing = {
  xs: 4,      // Extra small spacing
  sm: 8,      // Small spacing
  md: 12,     // Medium spacing
  lg: 16,     // Large spacing
  xl: 24,     // Extra large spacing
  '2xl': 32,  // 2x extra large
  '3xl': 40,  // 3x extra large
  '4xl': 48,  // 4x extra large
  '5xl': 64,  // 5x extra large
  '6xl': 96,  // 6x extra large
};

/**
 * Border radius
 */
export const borderRadius = {
  none: 0,
  sm: 4,      // Small radius (buttons, inputs)
  md: 8,      // Medium radius (cards)
  lg: 12,     // Large radius (modals)
  xl: 16,     // Extra large radius
  '2xl': 24,  // 2x extra large
  full: 9999, // Fully rounded (pills, avatars)
};

/**
 * Border width
 */
export const borderWidth = {
  none: 0,
  thin: 1,
  medium: 2,
  thick: 3,
};

/**
 * Icon sizes
 */
export const iconSize = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
  '2xl': 48,
};

/**
 * Button heights
 */
export const buttonHeight = {
  sm: 32,
  md: 44,
  lg: 56,
};

/**
 * Input heights
 */
export const inputHeight = {
  sm: 36,
  md: 44,
  lg: 52,
};

/**
 * Card dimensions
 */
export const card = {
  padding: spacing.lg,
  gap: spacing.md,
  radius: borderRadius.md,
};

/**
 * Screen padding (horizontal margins)
 */
export const screenPadding = {
  horizontal: spacing.lg,
  vertical: spacing.lg,
};

/**
 * List item dimensions
 */
export const listItem = {
  height: 64,
  padding: spacing.lg,
  gap: spacing.md,
};

/**
 * Header dimensions
 */
export const header = {
  height: 64,
  padding: spacing.lg,
};

/**
 * Bottom tab bar dimensions
 */
export const tabBar = {
  height: 64,
  iconSize: iconSize.md,
  padding: spacing.sm,
};

/**
 * Modal dimensions
 */
export const modal = {
  padding: spacing.xl,
  radius: borderRadius.lg,
  maxWidth: 400,
};

/**
 * Shadows (iOS)
 */
export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
};

/**
 * Elevation (Android)
 */
export const elevation = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 8,
  xl: 16,
};

/**
 * Z-index layers
 */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  toast: 1400,
  tooltip: 1500,
};

/**
 * Animation durations (ms)
 */
export const duration = {
  fast: 150,
  normal: 250,
  slow: 350,
};

/**
 * Animation easing
 */
export const easing = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
};

/**
 * Breakpoints for responsive design
 */
export const breakpoints = {
  xs: 320,   // Small phones
  sm: 375,   // Standard phones
  md: 414,   // Large phones
  lg: 768,   // Tablets
  xl: 1024,  // Large tablets
};

export default spacing;
