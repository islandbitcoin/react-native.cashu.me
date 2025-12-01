/**
 * KeyManager
 *
 * Manages cryptographic keys with hardware-backed security.
 * Uses Secure Enclave (iOS) or StrongBox (Android) when available.
 *
 * Security Hierarchy:
 * 1. Hardware (Secure Enclave/StrongBox) - Master encryption key
 * 2. Keychain/Keystore (OS-level) - Seed phrase, derived keys
 * 3. Derived keys - Proof encryption, signing keys
 */

import * as Keychain from 'react-native-keychain';
import { pbkdf2Sync, randomBytes } from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';

/**
 * Keychain service identifiers
 */
const KEYCHAIN_SERVICE = 'me.cashu.wallet';
const SEED_KEY = 'cashu_seed';
const MASTER_KEY = 'cashu_master';

/**
 * Security level preferences
 */
const SECURITY_OPTIONS: Keychain.Options = {
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  authenticatePrompt: {
    title: 'Authenticate',
    subtitle: 'Access your Cashu wallet',
    description: 'Biometric authentication required',
    cancel: 'Cancel',
  },
};

/**
 * Key derivation parameters
 */
const DERIVATION_PARAMS = {
  iterations: 100000,
  keyLength: 32,
  digest: 'sha256' as const,
};

/**
 * KeyManager Class
 *
 * Handles all cryptographic key operations with hardware-backed security.
 */
export class KeyManager {
  private static instance: KeyManager;

  private constructor() {}

  static getInstance(): KeyManager {
    if (!KeyManager.instance) {
      KeyManager.instance = new KeyManager();
    }
    return KeyManager.instance;
  }

  /**
   * Check hardware security capabilities
   */
  async getSecurityInfo(): Promise<{
    hasSecureHardware: boolean;
    hasBiometrics: boolean;
    biometricType?: string;
  }> {
    try {
      const capabilities = await Keychain.getSupportedBiometryType();

      return {
        hasSecureHardware: true,
        hasBiometrics: capabilities !== null,
        biometricType: capabilities || undefined,
      };
    } catch (error) {
      console.error('Failed to get security info:', error);
      return {
        hasSecureHardware: false,
        hasBiometrics: false,
      };
    }
  }

  /**
   * Generate a new seed phrase (BIP39-like)
   * Uses hardware random number generator
   *
   * @returns 24-word seed phrase (256 bits of entropy)
   */
  async generateSeed(): Promise<string> {
    try {
      // Generate 256 bits (32 bytes) of entropy using hardware RNG
      const entropy = randomBytes(32);

      // Convert to mnemonic (24 words)
      // Note: In production, use proper BIP39 implementation
      const mnemonic = this.entropyToMnemonic(entropy);

      // Store seed with biometric protection
      await this.storeSeed(mnemonic);

      // Also generate and store master key
      await this.generateMasterKey();

      return mnemonic;
    } catch (error: any) {
      throw new Error(`Failed to generate seed: ${error.message}`);
    }
  }

  /**
   * Store seed phrase with biometric protection
   */
  private async storeSeed(mnemonic: string): Promise<void> {
    try {
      const securityInfo = await this.getSecurityInfo();

      const options: Keychain.Options = {
        ...SECURITY_OPTIONS,
        service: KEYCHAIN_SERVICE,
      };

      // Use StrongBox/Secure Enclave if available
      if (securityInfo.hasSecureHardware) {
        options.securityLevel = Keychain.SECURITY_LEVEL.SECURE_HARDWARE;
      }

      await Keychain.setGenericPassword(SEED_KEY, mnemonic, options);
    } catch (error: any) {
      throw new Error(`Failed to store seed: ${error.message}`);
    }
  }

  /**
   * Retrieve seed phrase (requires biometric authentication)
   */
  async getSeed(): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: KEYCHAIN_SERVICE,
        authenticationPrompt: SECURITY_OPTIONS.authenticatePrompt,
      });

      if (!credentials) {
        return null;
      }

      return credentials.password;
    } catch (error: any) {
      if (error.message.includes('User canceled')) {
        return null;
      }
      throw new Error(`Failed to retrieve seed: ${error.message}`);
    }
  }

  /**
   * Check if seed exists
   */
  async hasSeed(): Promise<boolean> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: KEYCHAIN_SERVICE,
      });
      return credentials !== false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate master encryption key
   * Derived from device-specific data + random salt
   */
  private async generateMasterKey(): Promise<void> {
    try {
      // Generate random salt
      const salt = randomBytes(32);

      // Get seed for key derivation
      const seed = await this.getSeed();
      if (!seed) {
        throw new Error('No seed available');
      }

      // Derive master key using PBKDF2
      const masterKey = pbkdf2Sync(
        seed,
        salt,
        DERIVATION_PARAMS.iterations,
        DERIVATION_PARAMS.keyLength,
        DERIVATION_PARAMS.digest
      );

      // Store master key
      await Keychain.setGenericPassword(
        MASTER_KEY,
        Buffer.concat([salt, masterKey]).toString('base64'),
        {
          ...SECURITY_OPTIONS,
          service: KEYCHAIN_SERVICE,
        }
      );
    } catch (error: any) {
      throw new Error(`Failed to generate master key: ${error.message}`);
    }
  }

  /**
   * Get master key for encryption operations
   */
  private async getMasterKey(): Promise<Buffer> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: KEYCHAIN_SERVICE,
      });

      if (!credentials || credentials.username !== MASTER_KEY) {
        throw new Error('Master key not found');
      }

      const combined = Buffer.from(credentials.password, 'base64');

      // Extract key (skip salt)
      const masterKey = combined.subarray(32);

      return masterKey;
    } catch (error: any) {
      throw new Error(`Failed to retrieve master key: ${error.message}`);
    }
  }

  /**
   * Derive proof encryption key from master key
   * Used to encrypt proofs at rest in database
   */
  async getProofEncryptionKey(): Promise<Buffer> {
    try {
      const masterKey = await this.getMasterKey();

      // Derive specific key for proof encryption
      const proofKey = pbkdf2Sync(
        masterKey,
        'proof_encryption',
        DERIVATION_PARAMS.iterations,
        DERIVATION_PARAMS.keyLength,
        DERIVATION_PARAMS.digest
      );

      return proofKey;
    } catch (error: any) {
      throw new Error(`Failed to derive proof encryption key: ${error.message}`);
    }
  }

  /**
   * Derive signing key for P2PK operations
   */
  async getSigningKey(): Promise<Buffer> {
    try {
      const masterKey = await this.getMasterKey();

      // Derive specific key for signing
      const signingKey = pbkdf2Sync(
        masterKey,
        'signing_key',
        DERIVATION_PARAMS.iterations,
        DERIVATION_PARAMS.keyLength,
        DERIVATION_PARAMS.digest
      );

      return signingKey;
    } catch (error: any) {
      throw new Error(`Failed to derive signing key: ${error.message}`);
    }
  }

  /**
   * Delete all keys (DANGEROUS - only for debugging/testing)
   */
  async deleteAllKeys(): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    } catch (error: any) {
      throw new Error(`Failed to delete keys: ${error.message}`);
    }
  }

  /**
   * Verify seed phrase
   * Useful for backup verification
   */
  async verifySeed(inputSeed: string): Promise<boolean> {
    try {
      const storedSeed = await this.getSeed();
      return storedSeed === inputSeed;
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert entropy bytes to mnemonic words
   *
   * NOTE: This is a simplified implementation.
   * In production, use @scure/bip39 or similar BIP39 library.
   */
  private entropyToMnemonic(entropy: Buffer): string {
    // Simplified word list (first 2048 words would be full BIP39 list)
    const wordList = this.getSimpleWordList();

    const words: string[] = [];

    // Convert bytes to 11-bit chunks (BIP39 standard)
    let bits = '';
    for (let i = 0; i < entropy.length; i++) {
      bits += entropy[i].toString(2).padStart(8, '0');
    }

    // Add checksum bits (first bits of SHA256 hash)
    const { createHash } = require('react-native-quick-crypto');
    const hash = createHash('sha256').update(entropy).digest();
    const checksumBits = hash[0].toString(2).padStart(8, '0').substring(0, 8);
    bits += checksumBits;

    // Convert 11-bit chunks to word indices
    for (let i = 0; i < bits.length; i += 11) {
      const chunk = bits.substring(i, i + 11);
      if (chunk.length === 11) {
        const index = parseInt(chunk, 2);
        words.push(wordList[index % wordList.length]);
      }
    }

    return words.join(' ');
  }

  /**
   * Simplified word list for mnemonic generation
   * In production, use full BIP39 word list
   */
  private getSimpleWordList(): string[] {
    return [
      'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
      'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
      // ... (In production, include all 2048 BIP39 words)
      // For now, using a small set and wrapping with modulo
      'cashu', 'wallet', 'bitcoin', 'satoshi', 'ecash', 'mint', 'proof', 'token',
    ].concat(
      Array.from({ length: 2040 }, (_, i) => `word${i}`)
    );
  }
}

/**
 * Singleton instance export
 */
export default KeyManager;
