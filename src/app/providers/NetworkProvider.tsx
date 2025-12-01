/**
 * Network Provider
 *
 * React Context provider for network state management.
 * Provides global access to network status throughout the app.
 *
 * Features:
 * - Real-time network status
 * - Connection type and quality
 * - Network event listeners
 * - Automatic updates
 *
 * Usage:
 * ```tsx
 * import { useNetwork } from '@/app/providers/NetworkProvider';
 *
 * function MyComponent() {
 *   const { isConnected, connectionQuality, isWiFi } = useNetwork();
 *
 *   if (!isConnected) {
 *     return <OfflineBanner />;
 *   }
 *
 *   return <OnlineContent />;
 * }
 * ```
 */

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';

/**
 * Connection type - defined locally to avoid circular dependencies
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
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  VERY_POOR = 'very_poor',
  UNKNOWN = 'unknown',
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
 * Network state
 */
export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: ConnectionType;
  quality: ConnectionQuality;
  isMetered: boolean;
  isWiFi: boolean;
  isCellular: boolean;
  timestamp: number;
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
 * Network context value
 */
interface NetworkContextValue extends NetworkState {
  // Additional helper methods
  hasGoodConnection: () => boolean;
  testReachability: (url: string) => Promise<boolean>;
  waitForConnection: (timeoutMs?: number) => Promise<boolean>;
}

/**
 * Network context
 */
const NetworkContext = createContext<NetworkContextValue | null>(null);

/**
 * Network provider props
 */
interface NetworkProviderProps {
  children: ReactNode;
}

/**
 * Default network state
 */
const defaultNetworkState: NetworkState = {
  isConnected: false,
  isInternetReachable: false,
  type: ConnectionType.NONE,
  quality: ConnectionQuality.UNKNOWN,
  isMetered: true,
  isWiFi: false,
  isCellular: false,
  timestamp: Date.now(),
};

/**
 * Network Provider Component
 *
 * Uses lazy loading to avoid circular dependency issues with
 * NetworkStateProvider which has deep import chains.
 */
export function NetworkProvider({ children }: NetworkProviderProps) {
  const [networkState, setNetworkState] = useState<NetworkState>(defaultNetworkState);
  const providerRef = useRef<any>(null);

  useEffect(() => {
    // Lazy load the NetworkStateProvider to avoid circular dependencies
    const initialize = async () => {
      try {
        // Dynamic import to break circular dependency
        const NetworkStateProviderModule = await import('../../core/network/NetworkStateProvider');
        const NetworkStateProvider = NetworkStateProviderModule.default || NetworkStateProviderModule.NetworkStateProvider;
        providerRef.current = NetworkStateProvider.getInstance ? NetworkStateProvider.getInstance() : NetworkStateProvider;

        await providerRef.current.initialize();

        // Get initial state
        const initialState = providerRef.current.getState();
        setNetworkState(initialState);

        // Listen for network changes
        const handleNetworkEvent = (event: any) => {
          setNetworkState(event.state);
        };

        providerRef.current.addEventListener(handleNetworkEvent);

        // Cleanup
        return () => {
          if (providerRef.current) {
            providerRef.current.removeEventListener(handleNetworkEvent);
            providerRef.current.shutdown();
          }
        };
      } catch (error) {
        console.error('[NetworkProvider] Initialization error:', error);
        // Continue with defaults on error
      }
    };

    initialize();
  }, []);

  const contextValue: NetworkContextValue = {
    ...networkState,
    hasGoodConnection: () => {
      if (providerRef.current && providerRef.current.hasGoodConnection) {
        return providerRef.current.hasGoodConnection();
      }
      return false;
    },
    testReachability: async (url: string) => {
      if (providerRef.current && providerRef.current.testReachability) {
        return providerRef.current.testReachability(url);
      }
      return false;
    },
    waitForConnection: async (timeoutMs?: number) => {
      if (providerRef.current && providerRef.current.waitForConnection) {
        return providerRef.current.waitForConnection(timeoutMs);
      }
      return false;
    },
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
}

/**
 * Hook to access network context
 */
export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }

  return context;
}

// ConnectionType, ConnectionQuality, NetworkEvent, NetworkState, NetworkEventData
// are already exported above
