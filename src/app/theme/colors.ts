/**
 * Color Palette
 *
 * Cashu Wallet color scheme with dark theme primary design.
 *
 * Primary Colors:
 * - Background: Deep dark (#0A0A0F) - Reduces eye strain
 * - Primary: Cashu Purple (#8B5CF6) - Brand color
 * - Success: Green (#10B981) - Confirmations, OCR synced
 * - Warning: Amber (#F59E0B) - OCR low, network issues
 * - Error: Red (#EF4444) - Failures, OCR depleted
 *
 * Design Philosophy:
 * - Dark theme reduces battery drain on OLED screens
 * - High contrast for outdoor visibility
 * - Color-coded status indicators for quick scanning
 * - Purple accent maintains Cashu brand identity
 */

export const colors = {
  // Background colors
  background: {
    primary: '#0A0A0F',      // Main background
    secondary: '#1A1A24',    // Card backgrounds
    tertiary: '#2A2A3A',     // Input backgrounds
    elevated: '#323242',     // Modal/overlay backgrounds
  },

  // Text colors
  text: {
    primary: '#FFFFFF',      // Main text
    secondary: '#A0A0B0',    // Secondary text
    tertiary: '#707080',     // Disabled text
    inverse: '#0A0A0F',      // Text on light backgrounds
  },

  // Brand colors
  primary: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',          // Main Cashu purple
    600: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },

  // Status colors
  status: {
    success: '#10B981',      // Green - Success states
    warning: '#F59E0B',      // Amber - Warning states
    error: '#EF4444',        // Red - Error states
    info: '#3B82F6',         // Blue - Info states
    successBackground: '#10B98120',  // Green with opacity
    warningBackground: '#F59E0B20',  // Amber with opacity
    errorBackground: '#EF444420',    // Red with opacity
    infoBackground: '#3B82F620',     // Blue with opacity
  },

  // OCR status colors
  ocr: {
    synced: '#10B981',       // Green - OCR fully synced
    ready: '#10B981',        // Green - OCR ready for offline
    low: '#F59E0B',          // Amber - OCR below 50%
    depleted: '#EF4444',     // Red - OCR empty
    syncing: '#3B82F6',      // Blue - OCR currently syncing
  },

  // Network status colors
  network: {
    online: '#10B981',       // Green - Connected
    offline: '#EF4444',      // Red - Disconnected
    syncing: '#3B82F6',      // Blue - Currently syncing
    excellent: '#10B981',    // Green - Excellent quality
    good: '#84CC16',         // Lime - Good quality
    fair: '#F59E0B',         // Amber - Fair quality
    poor: '#F97316',         // Orange - Poor quality
  },

  // Transport colors
  transport: {
    nfc: '#8B5CF6',          // Purple - NFC
    bluetooth: '#3B82F6',    // Blue - Bluetooth
    qr: '#10B981',           // Green - QR code
  },

  // UI element colors
  border: {
    primary: '#323242',      // Default borders
    secondary: '#424252',    // Hover/focus borders
    tertiary: '#525262',     // Active borders
  },

  // Button colors
  button: {
    primary: '#8B5CF6',      // Primary button background
    primaryHover: '#7C3AED', // Primary button hover
    primaryActive: '#6D28D9',// Primary button active
    secondary: '#2A2A3A',    // Secondary button background
    disabled: '#424252',     // Disabled button background
  },

  // Chart colors (for transaction history)
  chart: {
    positive: '#10B981',     // Received funds
    negative: '#EF4444',     // Sent funds
    neutral: '#8B5CF6',      // Swaps/internal
  },

  // Semantic colors
  semantic: {
    received: '#10B981',     // Money received
    sent: '#EF4444',         // Money sent
    pending: '#F59E0B',      // Pending transactions
    failed: '#EF4444',       // Failed transactions
  },

  // Utility colors
  overlay: 'rgba(10, 10, 15, 0.8)',  // Modal overlay
  shadow: 'rgba(0, 0, 0, 0.5)',      // Drop shadows
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
};

/**
 * Opacity values for consistent transparency
 */
export const opacity = {
  disabled: 0.4,
  hover: 0.8,
  pressed: 0.6,
  overlay: 0.8,
  light: 0.1,
  medium: 0.3,
  heavy: 0.6,
};

/**
 * Get OCR status color
 */
export function getOCRStatusColor(status: string): string {
  switch (status) {
    case 'SYNCED':
    case 'OFFLINE_READY':
      return colors.ocr.synced;
    case 'LOW':
      return colors.ocr.low;
    case 'DEPLETED':
    case 'OUT_OF_SYNC':
      return colors.ocr.depleted;
    case 'SYNCING':
      return colors.ocr.syncing;
    default:
      return colors.text.secondary;
  }
}

/**
 * Get network status color
 */
export function getNetworkStatusColor(quality: string): string {
  switch (quality) {
    case 'excellent':
      return colors.network.excellent;
    case 'good':
      return colors.network.good;
    case 'fair':
      return colors.network.fair;
    case 'poor':
    case 'very_poor':
      return colors.network.poor;
    default:
      return colors.text.secondary;
  }
}

/**
 * Get transport color
 */
export function getTransportColor(transport: string): string {
  switch (transport) {
    case 'nfc':
      return colors.transport.nfc;
    case 'bluetooth':
      return colors.transport.bluetooth;
    case 'qr':
      return colors.transport.qr;
    default:
      return colors.primary[500];
  }
}

export default colors;
