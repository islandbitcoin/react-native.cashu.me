/**
 * Transport Interface
 *
 * Defines the abstract interface for all payment transport layers.
 * Enables offline payments via NFC, Bluetooth, and QR codes.
 *
 * Transport Types:
 * - NFC: Tap-to-pay (Android/iOS)
 * - Bluetooth LE: Nearby devices (peer-to-peer)
 * - QR Code: Visual encoding (camera scan)
 *
 * All transports share the same interface for:
 * - Sending tokens
 * - Receiving tokens
 * - Connection management
 * - Error handling
 */

/**
 * Transport type enum
 */
export enum TransportType {
  NFC = 'nfc',
  BLUETOOTH = 'bluetooth',
  QR_CODE = 'qr_code',
}

/**
 * Transport status
 */
export enum TransportStatus {
  IDLE = 'idle',
  READY = 'ready',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SENDING = 'sending',
  RECEIVING = 'receiving',
  ERROR = 'error',
}

/**
 * Transport capabilities
 */
export interface TransportCapabilities {
  canSend: boolean;
  canReceive: boolean;
  maxPayloadSize: number; // In bytes
  requiresPairing: boolean;
  supportsMultipleDevices: boolean;
}

/**
 * Transport event types
 */
export enum TransportEvent {
  STATUS_CHANGED = 'status_changed',
  DATA_RECEIVED = 'data_received',
  SEND_COMPLETE = 'send_complete',
  ERROR = 'error',
  DEVICE_DISCOVERED = 'device_discovered',
  CONNECTION_ESTABLISHED = 'connection_established',
  CONNECTION_LOST = 'connection_lost',
}

/**
 * Transport event data
 */
export interface TransportEventData {
  type: TransportEvent;
  timestamp: number;
  data?: any;
  error?: string;
}

/**
 * Transport event listener
 */
export type TransportEventListener = (event: TransportEventData) => void;

/**
 * Send options
 */
export interface SendOptions {
  timeout?: number; // In milliseconds
  retries?: number;
  compress?: boolean;
}

/**
 * Receive options
 */
export interface ReceiveOptions {
  timeout?: number; // In milliseconds
  autoAccept?: boolean;
}

/**
 * Send result
 */
export interface SendResult {
  success: boolean;
  bytesTransferred?: number;
  duration?: number;
  error?: string;
}

/**
 * Receive result
 */
export interface ReceiveResult {
  success: boolean;
  data?: string;
  bytesReceived?: number;
  duration?: number;
  error?: string;
}

/**
 * Abstract Transport Interface
 *
 * All transport implementations must implement this interface
 */
export interface ITransport {
  /**
   * Get transport type
   */
  getType(): TransportType;

  /**
   * Get transport capabilities
   */
  getCapabilities(): TransportCapabilities;

  /**
   * Get current status
   */
  getStatus(): TransportStatus;

  /**
   * Check if transport is available on this device
   */
  isAvailable(): Promise<boolean>;

  /**
   * Initialize transport
   */
  initialize(): Promise<void>;

  /**
   * Cleanup and shutdown transport
   */
  shutdown(): Promise<void>;

  /**
   * Send data (Cashu token)
   */
  send(data: string, options?: SendOptions): Promise<SendResult>;

  /**
   * Receive data (Cashu token)
   */
  receive(options?: ReceiveOptions): Promise<ReceiveResult>;

  /**
   * Cancel ongoing operation
   */
  cancel(): Promise<void>;

  /**
   * Add event listener
   */
  addEventListener(listener: TransportEventListener): void;

  /**
   * Remove event listener
   */
  removeEventListener(listener: TransportEventListener): void;
}

/**
 * Base Transport class
 *
 * Provides common functionality for all transports
 */
export abstract class BaseTransport implements ITransport {
  protected status: TransportStatus = TransportStatus.IDLE;
  protected listeners: TransportEventListener[] = [];

  /**
   * Emit event to all listeners
   */
  protected emit(event: TransportEventData): void {
    this.listeners.forEach(listener => listener(event));
  }

  /**
   * Change status and emit event
   */
  protected setStatus(status: TransportStatus): void {
    this.status = status;
    this.emit({
      type: TransportEvent.STATUS_CHANGED,
      timestamp: Date.now(),
      data: { status },
    });
  }

  /**
   * Emit error event
   */
  protected emitError(error: string): void {
    this.emit({
      type: TransportEvent.ERROR,
      timestamp: Date.now(),
      error,
    });
  }

  /**
   * Get current status
   */
  getStatus(): TransportStatus {
    return this.status;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: TransportEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: TransportEventListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Abstract methods that must be implemented
   */
  abstract getType(): TransportType;
  abstract getCapabilities(): TransportCapabilities;
  abstract isAvailable(): Promise<boolean>;
  abstract initialize(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract send(data: string, options?: SendOptions): Promise<SendResult>;
  abstract receive(options?: ReceiveOptions): Promise<ReceiveResult>;
  abstract cancel(): Promise<void>;
}

/**
 * Transport Manager
 *
 * Manages all available transports
 */
export class TransportManager {
  private static instance: TransportManager;
  private transports: Map<TransportType, ITransport> = new Map();

  private constructor() {}

  static getInstance(): TransportManager {
    if (!TransportManager.instance) {
      TransportManager.instance = new TransportManager();
    }
    return TransportManager.instance;
  }

  /**
   * Register a transport
   */
  registerTransport(transport: ITransport): void {
    this.transports.set(transport.getType(), transport);
  }

  /**
   * Get transport by type
   */
  getTransport(type: TransportType): ITransport | undefined {
    return this.transports.get(type);
  }

  /**
   * Get all available transports
   */
  async getAvailableTransports(): Promise<ITransport[]> {
    const available: ITransport[] = [];

    for (const transport of this.transports.values()) {
      if (await transport.isAvailable()) {
        available.push(transport);
      }
    }

    return available;
  }

  /**
   * Get best transport for sending (based on availability and capabilities)
   */
  async getBestTransport(): Promise<ITransport | null> {
    const available = await this.getAvailableTransports();

    if (available.length === 0) {
      return null;
    }

    // Priority: NFC > Bluetooth > QR Code
    const priority = [TransportType.NFC, TransportType.BLUETOOTH, TransportType.QR_CODE];

    for (const type of priority) {
      const transport = available.find(t => t.getType() === type);
      if (transport) {
        return transport;
      }
    }

    return available[0];
  }

  /**
   * Initialize all transports
   */
  async initializeAll(): Promise<void> {
    for (const transport of this.transports.values()) {
      try {
        if (await transport.isAvailable()) {
          await transport.initialize();
        }
      } catch (error) {
        console.error(`Failed to initialize ${transport.getType()}:`, error);
      }
    }
  }

  /**
   * Shutdown all transports
   */
  async shutdownAll(): Promise<void> {
    for (const transport of this.transports.values()) {
      try {
        await transport.shutdown();
      } catch (error) {
        console.error(`Failed to shutdown ${transport.getType()}:`, error);
      }
    }
  }
}

/**
 * Export singleton instance
 */
export default TransportManager;
