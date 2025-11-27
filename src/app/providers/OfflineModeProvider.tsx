/**
 * Offline Mode Provider
 *
 * React Context provider for offline mode management.
 * Provides global access to offline capabilities and status.
 *
 * Features:
 * - Offline mode status
 * - Offline capabilities (can send, can receive, etc.)
 * - OCR status
 * - Operation queue status
 *
 * Usage:
 * ```tsx
 * import { useOfflineMode } from '@/app/providers/OfflineModeProvider';
 *
 * function SendScreen() {
 *   const { isOffline, capabilities, mode } = useOfflineMode();
 *
 *   if (isOffline && !capabilities.canSend) {
 *     return <OCRDepletedMessage />;
 *   }
 *
 *   return <SendForm />;
 * }
 * ```
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { OfflineModeManager, OfflineMode, OfflineCapabilities } from '../../core/network/OfflineModeManager';

/**
 * Offline mode context value
 */
interface OfflineModeContextValue {
  mode: OfflineMode;
  capabilities: OfflineCapabilities;
  isOffline: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  offlineDuration: number | null;
  timeSinceOnline: number | null;
  queueOperation: (type: any, payload: any, priority?: any) => Promise<string>;
  forceReconcile: () => Promise<void>;
  getHealth: () => { healthy: boolean; issues: string[]; warnings: string[] };
}

/**
 * Offline mode context
 */
const OfflineModeContext = createContext<OfflineModeContextValue | null>(null);

/**
 * Offline mode provider props
 */
interface OfflineModeProviderProps {
  children: ReactNode;
}

/**
 * Offline Mode Provider Component
 */
export function OfflineModeProvider({ children }: OfflineModeProviderProps) {
  const [mode, setMode] = useState<OfflineMode>(OfflineMode.OFFLINE);
  const [capabilities, setCapabilities] = useState<OfflineCapabilities>({
    canSend: false,
    canReceive: true,
    canViewBalance: true,
    canViewHistory: true,
    canGeneratePaymentRequest: true,
    ocrAvailable: false,
    ocrBalance: 0,
  });

  const offlineModeManager = OfflineModeManager.getInstance();

  useEffect(() => {
    // Initialize offline mode manager
    const initialize = async () => {
      try {
        await offlineModeManager.initialize();

        // Update state periodically
        const interval = setInterval(() => {
          const currentMode = offlineModeManager.getMode();
          const currentCapabilities = offlineModeManager.getCapabilities();

          setMode(currentMode);
          setCapabilities(currentCapabilities);
        }, 1000); // Update every second

        // Initial update
        setMode(offlineModeManager.getMode());
        setCapabilities(offlineModeManager.getCapabilities());

        return () => clearInterval(interval);
      } catch (error) {
        console.error('[OfflineModeProvider] Initialization error:', error);
      }
    };

    initialize();
  }, []);

  const contextValue: OfflineModeContextValue = {
    mode,
    capabilities,
    isOffline: mode === OfflineMode.OFFLINE,
    isOnline: mode === OfflineMode.ONLINE,
    isSyncing: mode === OfflineMode.SYNCING,
    offlineDuration: offlineModeManager.getOfflineDuration(),
    timeSinceOnline: offlineModeManager.getTimeSinceOnline(),
    queueOperation: (type, payload, priority) =>
      offlineModeManager.queueOperation(type, payload, priority),
    forceReconcile: () => offlineModeManager.forceReconcile(),
    getHealth: () => offlineModeManager.getHealth(),
  };

  return (
    <OfflineModeContext.Provider value={contextValue}>
      {children}
    </OfflineModeContext.Provider>
  );
}

/**
 * Hook to access offline mode context
 */
export function useOfflineMode(): OfflineModeContextValue {
  const context = useContext(OfflineModeContext);

  if (!context) {
    throw new Error('useOfflineMode must be used within OfflineModeProvider');
  }

  return context;
}

/**
 * Re-export types for convenience
 */
export { OfflineMode };
export type { OfflineCapabilities };
