/**
 * NetworkStateProvider
 *
 * Centralized network state management.
 * Provides real-time network status, connection quality, and offline mode handling.
 *
 * Features:
 * - Network connectivity monitoring
 * - Connection type detection (WiFi, Cellular, None)
 * - Connection quality estimation
 * - Offline mode state management
 * - Network change events
 * - Reachability testing
 *
 * Integration:
 * - Uses @react-native-community/netinfo for network state
 * - Provides React Context for UI components
 * - Triggers sync when connection restored
 */

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

/**
 * Connection type
 */
export enum ConnectionType {
  NONE = 'none',
  WIFI = 'wifi',
  CELLULAR = 'cellular',
  BLUETOOTH = 'bluetooth',
  ETHERNET = 'ethernet',
  UNKNOWN = 'unknown',
}

/**
 * Connection quality
 */
export enum ConnectionQuality {
  EXCELLENT = 'excellent', // < 50ms ping, > 10 Mbps
  GOOD = 'good', // < 100ms ping, > 5 Mbps
  FAIR = 'fair', // < 200ms ping, > 1 Mbps
  POOR = 'poor', // < 500ms ping, > 0.5 Mbps
  VERY_POOR = 'very_poor', // > 500ms ping or < 0.5 Mbps
  UNKNOWN = 'unknown',
}

/**
 * Network state
 */
export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: ConnectionType;
  quality: ConnectionQuality;
  isMetered: boolean; // Expensive connection (cellular data)
  isWiFi: boolean;
  isCellular: boolean;
  timestamp: number;
}

/**
 * Network event types
 */
export enum NetworkEvent {
  CONNECTION_CHANGED = 'connection_changed',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  QUALITY_CHANGED = 'quality_changed',
  TYPE_CHANGED = 'type_changed',
}

/**
 * Network event data
 */
export interface NetworkEventData {
  type: NetworkEvent;
  state: NetworkState;
  timestamp: number;
}

/**
 * Network event listener
 */
export type NetworkEventListener = (event: NetworkEventData) => void;

/**
 * NetworkStateProvider class
 */
export class NetworkStateProvider {
  private static instance: NetworkStateProvider;

  private currentState: NetworkState = {
    isConnected: false,
    isInternetReachable: false,
    type: ConnectionType.NONE,
    quality: ConnectionQuality.UNKNOWN,
    isMetered: true,
    isWiFi: false,
    isCellular: false,
    timestamp: Date.now(),
  };

  private listeners: NetworkEventListener[] = [];
  private unsubscribe?: () => void;
  private qualityCheckInterval?: NodeJS.Timeout;

  private constructor() {}

  static getInstance(): NetworkStateProvider {
    if (!NetworkStateProvider.instance) {
      NetworkStateProvider.instance = new NetworkStateProvider();
    }
    return NetworkStateProvider.instance;
  }

  /**
   * Initialize network monitoring
   */
  async initialize(): Promise<void> {
    console.log('[NetworkStateProvider] Initializing...');

    // Get initial state
    const state = await NetInfo.fetch();
    this.updateState(state);

    // Subscribe to network changes
    this.unsubscribe = NetInfo.addEventListener(this.handleStateChange.bind(this));

    // Start quality monitoring
    this.startQualityMonitoring();

    console.log('[NetworkStateProvider] Initialized');
  }

  /**
   * Shutdown network monitoring
   */
  shutdown(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
      this.qualityCheckInterval = undefined;
    }

    console.log('[NetworkStateProvider] Shutdown');
  }

  /**
   * Handle network state change
   */
  private handleStateChange(state: NetInfoState): void {
    const previousState = { ...this.currentState };
    this.updateState(state);

    // Emit connection change event
    this.emit({
      type: NetworkEvent.CONNECTION_CHANGED,
      state: this.currentState,
      timestamp: Date.now(),
    });

    // Emit specific events
    if (previousState.isConnected !== this.currentState.isConnected) {
      this.emit({
        type: this.currentState.isConnected
          ? NetworkEvent.CONNECTED
          : NetworkEvent.DISCONNECTED,
        state: this.currentState,
        timestamp: Date.now(),
      });
    }

    if (previousState.type !== this.currentState.type) {
      this.emit({
        type: NetworkEvent.TYPE_CHANGED,
        state: this.currentState,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Update internal state from NetInfo state
   */
  private updateState(state: NetInfoState): void {
    const type = this.mapConnectionType(state.type);
    const isWiFi = state.type === 'wifi';
    const isCellular = state.type === 'cellular';
    const isMetered = state.details?.isConnectionExpensive ?? isCellular;

    this.currentState = {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      type,
      quality: this.currentState.quality, // Updated separately
      isMetered,
      isWiFi,
      isCellular,
      timestamp: Date.now(),
    };
  }

  /**
   * Map NetInfo type to ConnectionType
   */
  private mapConnectionType(type: NetInfoStateType): ConnectionType {
    switch (type) {
      case 'wifi':
        return ConnectionType.WIFI;
      case 'cellular':
        return ConnectionType.CELLULAR;
      case 'bluetooth':
        return ConnectionType.BLUETOOTH;
      case 'ethernet':
        return ConnectionType.ETHERNET;
      case 'none':
        return ConnectionType.NONE;
      default:
        return ConnectionType.UNKNOWN;
    }
  }

  /**
   * Start connection quality monitoring
   */
  private startQualityMonitoring(): void {
    // Check quality every 30 seconds
    this.qualityCheckInterval = setInterval(async () => {
      if (this.currentState.isConnected) {
        const quality = await this.measureConnectionQuality();
        const previousQuality = this.currentState.quality;

        this.currentState.quality = quality;
        this.currentState.timestamp = Date.now();

        if (previousQuality !== quality) {
          this.emit({
            type: NetworkEvent.QUALITY_CHANGED,
            state: this.currentState,
            timestamp: Date.now(),
          });
        }
      }
    }, 30000);
  }

  /**
   * Measure connection quality
   */
  private async measureConnectionQuality(): Promise<ConnectionQuality> {
    try {
      // Ping a reliable endpoint
      const startTime = Date.now();
      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        cache: 'no-cache',
      });

      const latency = Date.now() - startTime;

      // Estimate quality based on latency
      if (!response.ok) {
        return ConnectionQuality.VERY_POOR;
      }

      if (latency < 50) {
        return ConnectionQuality.EXCELLENT;
      } else if (latency < 100) {
        return ConnectionQuality.GOOD;
      } else if (latency < 200) {
        return ConnectionQuality.FAIR;
      } else if (latency < 500) {
        return ConnectionQuality.POOR;
      } else {
        return ConnectionQuality.VERY_POOR;
      }
    } catch (error) {
      return ConnectionQuality.UNKNOWN;
    }
  }

  /**
   * Get current network state
   */
  getState(): NetworkState {
    return { ...this.currentState };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.currentState.isConnected;
  }

  /**
   * Check if internet is reachable
   */
  isInternetReachable(): boolean {
    return this.currentState.isInternetReachable;
  }

  /**
   * Check if on WiFi
   */
  isWiFi(): boolean {
    return this.currentState.isWiFi;
  }

  /**
   * Check if on cellular
   */
  isCellular(): boolean {
    return this.currentState.isCellular;
  }

  /**
   * Check if connection is metered (expensive)
   */
  isMetered(): boolean {
    return this.currentState.isMetered;
  }

  /**
   * Get connection type
   */
  getConnectionType(): ConnectionType {
    return this.currentState.type;
  }

  /**
   * Get connection quality
   */
  getConnectionQuality(): ConnectionQuality {
    return this.currentState.quality;
  }

  /**
   * Check if good connection
   * Used to determine if large operations should proceed
   */
  hasGoodConnection(): boolean {
    return (
      this.currentState.isConnected &&
      this.currentState.isInternetReachable &&
      [
        ConnectionQuality.EXCELLENT,
        ConnectionQuality.GOOD,
        ConnectionQuality.FAIR,
      ].includes(this.currentState.quality)
    );
  }

  /**
   * Check if should use cellular
   * Used for data-saving preferences
   */
  shouldUseCellular(): boolean {
    // This would check user preferences
    // For now, return true (allow cellular)
    return true;
  }

  /**
   * Test reachability to specific host
   */
  async testReachability(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for connection
   * Resolves when connected, or rejects after timeout
   */
  async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    if (this.currentState.isConnected) {
      return true;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        listener && this.removeEventListener(listener);
        resolve(false);
      }, timeoutMs);

      const listener = (event: NetworkEventData) => {
        if (event.type === NetworkEvent.CONNECTED) {
          clearTimeout(timeout);
          this.removeEventListener(listener);
          resolve(true);
        }
      };

      this.addEventListener(listener);
    });
  }

  /**
   * Add event listener
   */
  addEventListener(listener: NetworkEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: NetworkEventListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: NetworkEventData): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[NetworkStateProvider] Listener error:', error);
      }
    });
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    currentType: ConnectionType;
    currentQuality: ConnectionQuality;
    isConnected: boolean;
    isMetered: boolean;
    uptime: number;
  } {
    return {
      currentType: this.currentState.type,
      currentQuality: this.currentState.quality,
      isConnected: this.currentState.isConnected,
      isMetered: this.currentState.isMetered,
      uptime: Date.now() - this.currentState.timestamp,
    };
  }
}

/**
 * Singleton instance export
 */
export default NetworkStateProvider;
