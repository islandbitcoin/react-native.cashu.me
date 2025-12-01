/**
 * Global Polyfills for React Native
 *
 * This file sets up all necessary polyfills for crypto operations
 * in React Native environment using native JSI modules.
 */

// Base64 polyfills - must be installed BEFORE buffer polyfill
// These are required by @craftzdog/react-native-buffer for base64 encoding
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

(global as any).base64FromArrayBuffer = (arrayBuffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(arrayBuffer);
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i];
    const byte2 = bytes[i + 1] || 0;
    const byte3 = bytes[i + 2] || 0;

    const enc1 = byte1 >> 2;
    const enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);
    const enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
    const enc4 = byte3 & 63;

    result += base64Chars[enc1] + base64Chars[enc2];
    result += (i + 1 < bytes.length) ? base64Chars[enc3] : '=';
    result += (i + 2 < bytes.length) ? base64Chars[enc4] : '=';
  }
  return result;
};

(global as any).base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  // Remove padding
  const cleanBase64 = base64.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor(cleanBase64.length * 3 / 4));

  let byteIndex = 0;
  for (let i = 0; i < cleanBase64.length; i += 4) {
    const enc1 = base64Chars.indexOf(cleanBase64[i]);
    const enc2 = base64Chars.indexOf(cleanBase64[i + 1]);
    const enc3 = base64Chars.indexOf(cleanBase64[i + 2]);
    const enc4 = base64Chars.indexOf(cleanBase64[i + 3]);

    bytes[byteIndex++] = (enc1 << 2) | (enc2 >> 4);
    if (enc3 !== -1) bytes[byteIndex++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    if (enc4 !== -1) bytes[byteIndex++] = ((enc3 & 3) << 6) | enc4;
  }

  return bytes.buffer;
};

// Install crypto polyfill using react-native-quick-crypto (80x faster via JSI)
import { install as installQuickCrypto } from 'react-native-quick-crypto';
installQuickCrypto();

// Install buffer polyfill
import { Buffer } from '@craftzdog/react-native-buffer';
(global as any).Buffer = Buffer;

// TextEncoder/TextDecoder polyfills - always install to ensure availability
// These are needed by cashu-ts for token encoding/decoding
const textEncoding = require('text-encoding');
(global as any).TextEncoder = textEncoding.TextEncoder;
(global as any).TextDecoder = textEncoding.TextDecoder;

// Also set on globalThis for module compatibility
if (typeof globalThis !== 'undefined') {
  (globalThis as any).TextEncoder = textEncoding.TextEncoder;
  (globalThis as any).TextDecoder = textEncoding.TextDecoder;
  (globalThis as any).Buffer = Buffer;
}

// Performance API polyfill for benchmarking
if (typeof (global as any).performance === 'undefined') {
  (global as any).performance = {
    now: () => Date.now(),
  };
}

console.log('[Polyfills] Crypto, buffer, and text encoding polyfills installed successfully');
