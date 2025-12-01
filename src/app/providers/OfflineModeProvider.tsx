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

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';

/**
 * Offline mode states - defined locally to avoid circular dependencies
 */
export enum OfflineMode {
  ONLINE = 'online',
  OFFLINE = 'offline',
  SYNCING = 'syncing',
  ERROR = 'error',
}

/**
 * Offline capabilities - what can be done when offline
 */
export interface OfflineCapabilities {
  canSend: boolean;
  canReceive: boolean;
  canViewBalance: boolean;
  canViewHistory: boolean;
  canGeneratePaymentRequest: boolean;
  ocrAvailable: boolean;
  ocrBalance: number;
}

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
 * Default capabilities when manager is not ready
 */
const defaultCapabilities: OfflineCapabilities = {
  canSend: false,
  canReceive: true,
  canViewBalance: true,
  canViewHistory: true,
  canGeneratePaymentRequest: true,
  ocrAvailable: false,
  ocrBalance: 0,
};

/**
 * Offline Mode Provider Component
 *
 * Uses lazy loading to avoid circular dependency issues with
 * OfflineModeManager which has deep import chains.
 */
export function OfflineModeProvider({ children }: OfflineModeProviderProps) {
  const [mode, setMode] = useState<OfflineMode>(OfflineMode.OFFLINE);
  const [capabilities, setCapabilities] = useState<OfflineCapabilities>(defaultCapabilities);
  const [offlineDuration, setOfflineDuration] = useState<number | null>(null);
  const [timeSinceOnline, setTimeSinceOnline] = useState<number | null>(null);
  const managerRef = useRef<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Lazy load the OfflineModeManager to avoid circular dependencies
    const initialize = async () => {
      try {
        // Dynamic import to break circular dependency
        const { OfflineModeManager } = await import('../../core/network/OfflineModeManager');
        managerRef.current = OfflineModeManager.getInstance();

        await managerRef.current.initialize();

        // Update state periodically
        const interval = setInterval(() => {
          if (managerRef.current) {
            const currentMode = managerRef.current.getMode();
            const currentCapabilities = managerRef.current.getCapabilities();

            setMode(currentMode);
            setCapabilities(currentCapabilities);
            setOfflineDuration(managerRef.current.getOfflineDuration());
            setTimeSinceOnline(managerRef.current.getTimeSinceOnline());
          }
        }, 1000); // Update every second

        // Initial update
        setMode(managerRef.current.getMode());
        setCapabilities(managerRef.current.getCapabilities());
        setIsInitialized(true);

        return () => clearInterval(interval);
      } catch (error) {
        console.error('[OfflineModeProvider] Initialization error:', error);
        // Continue with defaults on error
        setIsInitialized(true);
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
    offlineDuration,
    timeSinceOnline,
    queueOperation: async (type, payload, priority) => {
      if (managerRef.current) {
        return managerRef.current.queueOperation(type, payload, priority);
      }
      return 'not-initialized';
    },
    forceReconcile: async () => {
      if (managerRef.current) {
        return managerRef.current.forceReconcile();
      }
    },
    getHealth: () => {
      if (managerRef.current) {
        return managerRef.current.getHealth();
      }
      return { healthy: true, issues: [], warnings: ['Manager not initialized'] };
    },
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

// OfflineMode and OfflineCapabilities are already exported above
