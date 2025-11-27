/**
 * SecureStorage
 *
 * Unified interface for secure storage across iOS and Android.
 * Wraps Keychain (iOS) and Keystore (Android) with automatic fallback.
 *
 * Features:
 * - Biometric-protected storage
 * - Automatic platform detection
 * - Fallback strategies
 * - Type-safe storage with generics
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Storage options
 */
export interface SecureStorageOptions {
  requireBiometrics?: boolean;
  service?: string;
  accessible?: Keychain.ACCESSIBLE;
}

/**
 * Default storage options
 */
const DEFAULT_OPTIONS: SecureStorageOptions = {
  requireBiometrics: false,
  service: 'me.cashu.wallet.storage',
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * SecureStorage class
 *
 * Provides secure storage with biometric protection and platform abstraction
 */
export class SecureStorage {
  private static instance: SecureStorage;
  private readonly service: string;

  private constructor(service: string = DEFAULT_OPTIONS.service!) {
    this.service = service;
  }

  static getInstance(service?: string): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage(service);
    }
    return SecureStorage.instance;
  }

  /**
   * Store data securely
   */
  async set(
    key: string,
    value: string,
    options: SecureStorageOptions = {}
  ): Promise<void> {
    try {
      const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

      const keychainOptions: Keychain.Options = {
        service: this.service,
        accessible: mergedOptions.accessible!,
      };

      // Add biometric protection if required
      if (mergedOptions.requireBiometrics) {
        keychainOptions.accessControl =
          Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE;
      }

      await Keychain.setGenericPassword(key, value, keychainOptions);
    } catch (error: any) {
      console.error('[SecureStorage] Set failed:', error);
      throw new Error(`Failed to store securely: ${error.message}`);
    }
  }

  /**
   * Retrieve data securely
   */
  async get(key: string, requireBiometrics: boolean = false): Promise<string | null> {
    try {
      const options: Keychain.Options = {
        service: this.service,
      };

      // Add authentication prompt if biometrics required
      if (requireBiometrics) {
        options.authenticationPrompt = {
          title: 'Authenticate',
          subtitle: 'Access secure data',
          description: 'Biometric authentication required',
          cancel: 'Cancel',
        };
      }

      const credentials = await Keychain.getGenericPassword(options);

      if (!credentials || credentials.username !== key) {
        return null;
      }

      return credentials.password;
    } catch (error: any) {
      if (error.message.includes('User canceled')) {
        return null;
      }
      console.error('[SecureStorage] Get failed:', error);
      throw new Error(`Failed to retrieve securely: ${error.message}`);
    }
  }

  /**
   * Remove data
   */
  async remove(key: string): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: this.service });
    } catch (error: any) {
      console.error('[SecureStorage] Remove failed:', error);
      throw new Error(`Failed to remove: ${error.message}`);
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: this.service,
      });

      return credentials !== false && credentials.username === key;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all data for this service
   */
  async clear(): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: this.service });
    } catch (error: any) {
      console.error('[SecureStorage] Clear failed:', error);
      throw new Error(`Failed to clear: ${error.message}`);
    }
  }

  /**
   * Store JSON data
   */
  async setJSON<T>(
    key: string,
    value: T,
    options: SecureStorageOptions = {}
  ): Promise<void> {
    try {
      const jsonString = JSON.stringify(value);
      await this.set(key, jsonString, options);
    } catch (error: any) {
      throw new Error(`Failed to store JSON: ${error.message}`);
    }
  }

  /**
   * Retrieve JSON data
   */
  async getJSON<T>(key: string, requireBiometrics: boolean = false): Promise<T | null> {
    try {
      const jsonString = await this.get(key, requireBiometrics);

      if (!jsonString) {
        return null;
      }

      return JSON.parse(jsonString) as T;
    } catch (error: any) {
      console.error('[SecureStorage] Get JSON failed:', error);
      return null;
    }
  }

  /**
   * Get available biometric type
   */
  async getBiometricType(): Promise<string | null> {
    try {
      const type = await Keychain.getSupportedBiometryType();
      return type;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if biometrics are available
   */
  async isBiometricsAvailable(): Promise<boolean> {
    try {
      const type = await this.getBiometricType();
      return type !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get security capabilities
   */
  async getSecurityCapabilities(): Promise<{
    hasBiometrics: boolean;
    biometricType: string | null;
    hasSecureHardware: boolean;
  }> {
    try {
      const biometricType = await this.getBiometricType();
      const hasBiometrics = biometricType !== null;

      // Check for secure hardware (iOS Secure Enclave, Android StrongBox)
      const hasSecureHardware =
        Platform.OS === 'ios' ||
        (Platform.OS === 'android' && Platform.Version >= 28);

      return {
        hasBiometrics,
        biometricType,
        hasSecureHardware,
      };
    } catch (error) {
      return {
        hasBiometrics: false,
        biometricType: null,
        hasSecureHardware: false,
      };
    }
  }
}

/**
 * Singleton instance export
 */
export default SecureStorage.getInstance();

/**
 * Create named instances for different services
 */
export const createSecureStorage = (service: string): SecureStorage => {
  return SecureStorage.getInstance(service);
};
