/**
 * Global Polyfills for React Native
 *
 * This file sets up all necessary polyfills for crypto operations
 * in React Native environment using native JSI modules.
 */

// Install crypto polyfill using react-native-quick-crypto (80x faster via JSI)
import { install as installQuickCrypto } from 'react-native-quick-crypto';
installQuickCrypto();

// Install buffer polyfill
import { Buffer } from '@craftzdog/react-native-buffer';
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// TextEncoder/TextDecoder polyfills if needed
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('text-encoding');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Performance API polyfill for benchmarking
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  } as Performance;
}

console.log('[Polyfills] Crypto and buffer polyfills installed successfully');
