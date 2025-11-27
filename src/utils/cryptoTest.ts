/**
 * Crypto Test Utility
 * Verifies that crypto polyfills are working correctly
 */

import crypto from 'crypto';
import { Buffer } from '@craftzdog/react-native-buffer';

export interface CryptoTestResult {
  success: boolean;
  tests: Array<{
    name: string;
    passed: boolean;
    duration: number;
    error?: string;
  }>;
}

/**
 * Run comprehensive crypto tests
 */
export async function runCryptoTests(): Promise<CryptoTestResult> {
  const results: CryptoTestResult = {
    success: true,
    tests: [],
  };

  // Test 1: Random bytes generation
  try {
    const start = performance.now();
    const randomBytes = crypto.randomBytes(32);
    const duration = performance.now() - start;

    results.tests.push({
      name: 'Random Bytes (32 bytes)',
      passed: randomBytes.length === 32,
      duration,
    });
  } catch (error: any) {
    results.success = false;
    results.tests.push({
      name: 'Random Bytes (32 bytes)',
      passed: false,
      duration: 0,
      error: error.message,
    });
  }

  // Test 2: SHA-256 hashing
  try {
    const start = performance.now();
    const hash = crypto.createHash('sha256');
    hash.update('Hello, Cashu!');
    const digest = hash.digest('hex');
    const duration = performance.now() - start;

    results.tests.push({
      name: 'SHA-256 Hash',
      passed: digest.length === 64 && /^[a-f0-9]{64}$/.test(digest),
      duration,
    });
  } catch (error: any) {
    results.success = false;
    results.tests.push({
      name: 'SHA-256 Hash',
      passed: false,
      duration: 0,
      error: error.message,
    });
  }

  // Test 3: Buffer operations
  try {
    const start = performance.now();
    const buf1 = Buffer.from('Cashu Wallet');
    const buf2 = Buffer.from(buf1);
    const passed = buf1.equals(buf2) && buf1.toString() === 'Cashu Wallet';
    const duration = performance.now() - start;

    results.tests.push({
      name: 'Buffer Operations',
      passed,
      duration,
    });
  } catch (error: any) {
    results.success = false;
    results.tests.push({
      name: 'Buffer Operations',
      passed: false,
      duration: 0,
      error: error.message,
    });
  }

  // Test 4: PBKDF2 key derivation
  try {
    const start = performance.now();
    const password = 'test_password';
    const salt = crypto.randomBytes(16);

    await new Promise<void>((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else {
          results.tests.push({
            name: 'PBKDF2 Key Derivation (100k iterations)',
            passed: derivedKey.length === 32,
            duration: performance.now() - start,
          });
          resolve();
        }
      });
    });
  } catch (error: any) {
    results.success = false;
    results.tests.push({
      name: 'PBKDF2 Key Derivation (100k iterations)',
      passed: false,
      duration: 0,
      error: error.message,
    });
  }

  // Check overall success
  results.success = results.tests.every(t => t.passed);

  return results;
}

/**
 * Format test results for display
 */
export function formatTestResults(results: CryptoTestResult): string {
  let output = '\n=== Crypto Test Results ===\n\n';

  results.tests.forEach(test => {
    const status = test.passed ? '✅' : '❌';
    output += `${status} ${test.name}\n`;
    output += `   Duration: ${test.duration.toFixed(2)}ms\n`;
    if (test.error) {
      output += `   Error: ${test.error}\n`;
    }
    output += '\n';
  });

  output += `Overall: ${results.success ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`;
  output += '==========================\n';

  return output;
}
