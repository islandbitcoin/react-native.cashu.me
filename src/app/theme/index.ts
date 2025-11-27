/**
 * Theme
 *
 * Central theme configuration for Cashu Wallet.
 * Exports all design tokens (colors, typography, spacing, etc.)
 *
 * Usage:
 * import { theme } from '@/app/theme';
 *
 * const MyComponent = () => (
 *   <View style={{ backgroundColor: theme.colors.background.primary }}>
 *     <Text style={theme.typography.h1}>Hello</Text>
 *   </View>
 * );
 */

import colors, { getOCRStatusColor, getNetworkStatusColor, getTransportColor, opacity } from './colors';
import typography, { fontFamily, fontWeight, fontSize, lineHeight, letterSpacing } from './typography';
import spacing, {
  borderRadius,
  borderWidth,
  iconSize,
  buttonHeight,
  inputHeight,
  card,
  screenPadding,
  listItem,
  header,
  tabBar,
  modal,
  shadow,
  elevation,
  zIndex,
  duration,
  easing,
  breakpoints,
} from './spacing';

/**
 * Complete theme object
 */
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  borderWidth,
  iconSize,
  buttonHeight,
  inputHeight,
  card,
  screenPadding,
  listItem,
  header,
  tabBar,
  modal,
  shadow,
  elevation,
  zIndex,
  duration,
  easing,
  breakpoints,
  opacity,

  // Typography values (for direct access)
  fontFamily,
  fontWeight,
  fontSize,
  lineHeight,
  letterSpacing,

  // Helper functions
  getOCRStatusColor,
  getNetworkStatusColor,
  getTransportColor,
};

/**
 * Type-safe theme access
 */
export type Theme = typeof theme;

/**
 * Re-export individual modules for convenience
 */
export {
  colors,
  typography,
  spacing,
  borderRadius,
  borderWidth,
  iconSize,
  buttonHeight,
  inputHeight,
  card,
  screenPadding,
  listItem,
  header,
  tabBar,
  modal,
  shadow,
  elevation,
  zIndex,
  duration,
  easing,
  breakpoints,
  opacity,
  fontFamily,
  fontWeight,
  fontSize,
  lineHeight,
  letterSpacing,
  getOCRStatusColor,
  getNetworkStatusColor,
  getTransportColor,
};

export default theme;
