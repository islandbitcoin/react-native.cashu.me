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

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import NetworkStateProvider, {
  NetworkState,
  NetworkEvent,
  NetworkEventData,
  ConnectionType,
  ConnectionQuality,
} from '../../core/network/NetworkStateProvider';

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
 * Network Provider Component
 */
export function NetworkProvider({ children }: NetworkProviderProps) {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: false,
    isInternetReachable: false,
    type: ConnectionType.NONE,
    quality: ConnectionQuality.UNKNOWN,
    isMetered: true,
    isWiFi: false,
    isCellular: false,
    timestamp: Date.now(),
  });

  const networkProvider = NetworkStateProvider.getInstance();

  useEffect(() => {
    // Initialize network provider
    const initialize = async () => {
      try {
        await networkProvider.initialize();

        // Get initial state
        const initialState = networkProvider.getState();
        setNetworkState(initialState);

        // Listen for network changes
        const handleNetworkEvent = (event: NetworkEventData) => {
          setNetworkState(event.state);
        };

        networkProvider.addEventListener(handleNetworkEvent);

        // Cleanup
        return () => {
          networkProvider.removeEventListener(handleNetworkEvent);
          networkProvider.shutdown();
        };
      } catch (error) {
        console.error('[NetworkProvider] Initialization error:', error);
      }
    };

    initialize();
  }, []);

  const contextValue: NetworkContextValue = {
    ...networkState,
    hasGoodConnection: () => networkProvider.hasGoodConnection(),
    testReachability: (url: string) => networkProvider.testReachability(url),
    waitForConnection: (timeoutMs?: number) => networkProvider.waitForConnection(timeoutMs),
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

/**
 * Re-export types for convenience
 */
export { ConnectionType, ConnectionQuality, NetworkEvent };
export type { NetworkState, NetworkEventData };
