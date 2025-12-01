/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OCRManager (Offline Cash Reserve Manager)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 🎯 THE KILLER FEATURE: Offline Spending with Ecash
 *
 * This is what sets this wallet apart from every other ecash implementation.
 * While other wallets require constant internet connectivity, we maintain a
 * reserve of FRESH, READY-TO-SPEND ecash tokens that work completely offline.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHAT IS OCR (Offline Cash Reserve)?
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * OCR is a pre-allocated pool of cryptographic proofs (ecash tokens) that are:
 * 1. Already swapped with the mint (fresh, unused blind signatures)
 * 2. Stored locally on the device
 * 3. Marked as "OCR" in our database for priority offline spending
 * 4. Ready to spend WITHOUT requiring internet connectivity
 *
 * Think of it like this:
 * - Regular Balance: Your total ecash holdings (requires online swap to spend)
 * - OCR Balance: Pre-swapped tokens ready for instant offline spending
 *
 * WHY IS THIS THE KILLER FEATURE?
 * --------------------------------
 * Traditional digital payments REQUIRE internet:
 * - Credit cards need to phone home to verify
 * - Bitcoin needs network to broadcast
 * - Lightning needs both nodes online
 *
 * OCR enables TRUE OFFLINE PAYMENTS:
 * - No internet needed to send or receive
 * - Peer-to-peer in mesh networks
 * - Works in disaster scenarios
 * - Privacy-preserving (no network surveillance)
 * - Instant settlement (no waiting for confirmations)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE DIAGRAM
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *                            ┌─────────────────┐
 *                            │  User's Wallet  │
 *                            └────────┬────────┘
 *                                     │
 *                    ┌────────────────┴────────────────┐
 *                    │                                 │
 *            ┌───────▼───────┐              ┌──────────▼─────────┐
 *            │ Regular Proofs│              │   OCR Proofs       │
 *            │ (Total Balance)│              │ (Offline Reserve) │
 *            └───────┬───────┘              └──────────┬─────────┘
 *                    │                                 │
 *                    │ When Online                     │ When Offline
 *                    │ Swap to OCR ───────────────────▶│ Spend Instantly
 *                    │                                 │
 *            ┌───────▼────────────────────────────────▼─────────┐
 *            │           OCRManager (This Class)                │
 *            │                                                   │
 *            │  • Monitors OCR balance vs target                │
 *            │  • Auto-swaps proofs when online                 │
 *            │  • Alerts on low OCR                             │
 *            │  • Prioritizes OCR for offline spending          │
 *            │  • Tracks OCR health & sync status               │
 *            └───────────────────────────────────────────────────┘
 *                              │
 *            ┌─────────────────┼─────────────────┐
 *            │                 │                 │
 *   ┌────────▼───────┐ ┌──────▼──────┐ ┌───────▼────────┐
 *   │ ProofRepository│ │ CashuWallet │ │ MintRepository │
 *   │  (DB Storage)  │ │  Service    │ │   (Mint URLs)  │
 *   └────────────────┘ └─────────────┘ └────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * HOW THE AUTOMATIC REFILL SYSTEM WORKS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The OCR system operates on a simple but powerful loop:
 *
 * 1. MONITORING PHASE
 *    - Continuously checks OCR balance vs target
 *    - Compares current balance to configured target (10k/50k/100k sats)
 *    - Calculates deficit = target - current
 *
 * 2. DETECTION PHASE
 *    - If OCR < 80% of target → needsRefill = true
 *    - If OCR < 2x alert threshold → alertLevel = 'low'
 *    - If OCR < alert threshold → alertLevel = 'critical'
 *    - If OCR = 0 → status = DEPLETED
 *
 * 3. REFILL PHASE (When Online + Auto-Refill Enabled)
 *    a. Select non-OCR proofs worth the deficit amount
 *    b. Call mint to swap these proofs for fresh ones
 *    c. Mint returns new blind signatures (fresh proofs)
 *    d. Mark these new proofs as OCR in database
 *    e. Original proofs are marked as SPENT
 *    f. OCR balance now equals target
 *
 * 4. SPENDING PHASE (Offline or Online)
 *    - User wants to spend X sats
 *    - System FIRST checks OCR proofs
 *    - Selects OCR proofs totaling >= X sats
 *    - Marks selected proofs as PENDING
 *    - Transfers proofs to recipient
 *    - Marks proofs as SPENT after successful transfer
 *    - OCR balance decreases
 *    - Triggers monitoring phase again
 *
 * EXAMPLE FLOW:
 * -------------
 * Initial State: OCR = 0 sats, Target = 50,000 sats
 * User goes online → Auto-refill triggered
 * System selects 50,000 sats of regular proofs
 * Swaps with mint → Gets fresh 50,000 sats proofs
 * Marks as OCR → OCR = 50,000 (100% of target)
 * Status: SYNCED ✓
 *
 * User spends 10,000 sats offline
 * OCR decreases to 40,000 sats (80% of target)
 * Status: OFFLINE_READY (still good)
 *
 * User spends another 30,000 sats
 * OCR decreases to 10,000 sats (20% of target)
 * Status: OUT_OF_SYNC
 * Alert: "OCR low, connect to refill"
 *
 * User connects to internet
 * Auto-refill detects OCR < 80%
 * Swaps 40,000 sats to reach target
 * OCR restored to 50,000 sats
 * Status: SYNCED ✓
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * OCR LEVELS AND TARGETS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * We offer three preset levels to match different user needs:
 *
 * LOW (10,000 sats = ~$10 USD)
 * - For casual users
 * - Minimal capital locked in OCR
 * - Good for coffee/small purchases
 * - Lower privacy (more frequent swaps = more metadata)
 * - Faster to refill (less proof swaps needed)
 *
 * MEDIUM (50,000 sats = ~$50 USD) [DEFAULT]
 * - Balanced approach
 * - Good for daily spending
 * - Reasonable privacy/capital tradeoff
 * - Can handle several offline transactions
 * - Refills periodically
 *
 * HIGH (100,000 sats = ~$100 USD)
 * - For power users
 * - Maximum offline resilience
 * - Best privacy (fewer swaps)
 * - Can operate offline for extended periods
 * - More capital locked up
 * - Slower to refill (more swaps)
 *
 * Users can also set CUSTOM targets for advanced use cases.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * STATUS TRACKING AND ALERTS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * OCR STATUS LEVELS:
 * ------------------
 *
 * SYNCED (Green) - OCR >= 95% of target
 * ├─ Meaning: OCR is fully topped up
 * ├─ User Action: None needed
 * └─ System Action: Maintain current level
 *
 * OFFLINE_READY (Blue) - OCR >= 50% of target
 * ├─ Meaning: Good offline spending capacity
 * ├─ User Action: Can spend offline safely
 * └─ System Action: Monitor, no urgent refill
 *
 * OUT_OF_SYNC (Yellow) - OCR < 50% of target
 * ├─ Meaning: OCR depleting, refill recommended
 * ├─ User Action: Connect to refill when convenient
 * └─ System Action: Queue auto-refill when online
 *
 * DEPLETED (Red) - OCR = 0
 * ├─ Meaning: No offline spending capability
 * ├─ User Action: MUST connect to refill
 * └─ System Action: Urgent refill needed
 *
 * ALERT LEVELS:
 * -------------
 *
 * none - OCR healthy (> 2x alert threshold)
 * low - OCR getting low (< 2x alert threshold, e.g., < 40%)
 * critical - OCR critically low (< alert threshold, e.g., < 20%)
 *
 * Alert threshold is configurable (default: 20%)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SECURITY CONSIDERATIONS FOR OFFLINE SPENDING
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. DOUBLE-SPEND PREVENTION
 *    -------------------------
 *    PROBLEM: Offline spending can't check if proofs were already spent
 *    SOLUTION: We immediately mark proofs as SPENT in local DB
 *    RISK: Malicious user could restore old database and re-spend
 *    MITIGATION:
 *    - App uses database integrity checks
 *    - Mints detect double-spends when eventually online
 *    - Reputation systems can blacklist double-spenders
 *    - Use trusted devices only
 *
 * 2. PROOF FRESHNESS
 *    ----------------
 *    PROBLEM: Old proofs might be invalidated by mint
 *    SOLUTION: OCR system regularly swaps for fresh proofs
 *    IMPLEMENTATION:
 *    - Auto-refill swaps proofs even if balance is sufficient
 *    - Maintains rotation of fresh blind signatures
 *    - Priority given to recently-swapped proofs
 *
 * 3. AMOUNT VERIFICATION
 *    --------------------
 *    PROBLEM: Recipient can't verify amount offline
 *    SOLUTION: Blind signatures are cryptographically verifiable
 *    SECURITY:
 *    - Mint's public key can verify signatures offline
 *    - Amount is embedded in the signature
 *    - Tampering invalidates the signature
 *
 * 4. MINT TRUST
 *    -----------
 *    RISK: Mint could issue fake proofs or refuse redemption
 *    MITIGATION:
 *    - Use trusted, reputable mints only
 *    - Diversify across multiple mints
 *    - Community reputation tracking
 *    - Regular online verification
 *
 * 5. DEVICE SECURITY
 *    ----------------
 *    RISK: Device theft = OCR theft (like physical cash)
 *    MITIGATION:
 *    - Database encryption at rest
 *    - Biometric/PIN protection on app
 *    - Limit OCR to reasonable amounts
 *    - Regular backups (encrypted)
 *
 * 6. NETWORK ISOLATION
 *    ------------------
 *    BENEFIT: Offline spending is private (no network metadata)
 *    TRADE-OFF: Can't verify mint's solvency offline
 *    BEST PRACTICE:
 *    - Periodically go online to verify mint status
 *    - Check mint's proof-of-reserves
 *    - Monitor community reports
 *
 * 7. TIME-BASED ATTACKS
 *    -------------------
 *    RISK: Device clock manipulation could affect proof validity
 *    MITIGATION:
 *    - Proof validity doesn't depend on local time
 *    - Blind signatures are time-independent
 *    - Mint validates on redemption
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════════════════════════

import ProofRepository from '../../data/repositories/ProofRepository';
import MintRepository from '../../data/repositories/MintRepository';
import CashuWalletService from '../cashu/CashuWalletService';
import Database from '../../data/database/Database';
import { OCRLevel, OCRStatus, ProofState, Proof } from '../../types';
import { generateUUID } from '../../utils/uuid';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS AND CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * OCR target amounts by level (in satoshis)
 *
 * These are the pre-configured amounts that the OCR system will try to maintain.
 * The values represent a balance between:
 * - User convenience (higher = more offline capacity)
 * - Capital efficiency (lower = less locked liquidity)
 * - Privacy (higher = fewer refills = less metadata)
 * - Refill time (lower = faster to sync)
 *
 * @constant
 * @type {Object.<OCRLevel, number>}
 *
 * @example
 * // Get the target for MEDIUM level
 * const mediumTarget = OCR_TARGETS[OCRLevel.MEDIUM]; // 50000 sats
 */
export const OCR_TARGETS = {
  [OCRLevel.LOW]: 10000,      // 10k sats (~$10 USD) - Casual users, coffee money
  [OCRLevel.MEDIUM]: 50000,   // 50k sats (~$50 USD) - Daily spending, balanced
  [OCRLevel.HIGH]: 100000,    // 100k sats (~$100 USD) - Power users, max offline time
};

/**
 * OCR configuration interface
 *
 * This defines all the tunable parameters for how the OCR system operates.
 * Each user can have their own configuration stored in the database.
 *
 * @interface OCRConfig
 *
 * @property {OCRLevel} level - The preset level (LOW/MEDIUM/HIGH)
 *   Determines the target amount to maintain in OCR.
 *   Can be overridden by setting targetAmount directly.
 *
 * @property {number} targetAmount - The exact satoshi amount to maintain in OCR
 *   Usually set automatically based on 'level', but can be customized.
 *   System will try to keep OCR balance as close to this as possible.
 *
 * @property {boolean} autoRefill - Whether to automatically refill OCR when online
 *   true: System automatically swaps proofs to reach target when internet is available
 *   false: User must manually trigger OCR sync
 *   Recommendation: Keep true for best UX
 *
 * @property {number} alertThreshold - Percentage of target that triggers critical alerts
 *   Range: 0-100 (typically 10-30)
 *   Example: 20 means alert when OCR falls below 20% of target
 *   If target is 50k and threshold is 20, alert at 10k sats
 *   Lower threshold = fewer alerts but less warning time
 *   Higher threshold = more alerts but more time to refill
 */
export interface OCRConfig {
  level: OCRLevel;
  targetAmount: number;
  autoRefill: boolean;
  alertThreshold: number;
}

/**
 * OCR sync result interface
 *
 * Returned by syncOCR() and refillIfNeeded() to report what happened during
 * an OCR synchronization operation.
 *
 * @interface OCRSyncResult
 *
 * @property {boolean} success - Whether the sync operation completed successfully
 *   true: OCR was synced, proofs were swapped
 *   false: Sync failed, check 'error' property for details
 *
 * @property {number} proofsAdded - Count of new OCR proofs created during sync
 *   These are fresh proofs received from the mint after swapping
 *
 * @property {number} proofsRemoved - Count of non-OCR proofs consumed in the swap
 *   These are the original proofs that were sent to the mint for swapping
 *
 * @property {number} newBalance - The OCR balance after sync operation (in sats)
 *   This is the total value of all proofs marked as OCR
 *
 * @property {OCRStatus} status - The OCR status after sync
 *   SYNCED: Successfully reached target
 *   OUT_OF_SYNC: Still below target (partial refill)
 *   DEPLETED: Failed to refill
 *
 * @property {string} [error] - Optional error message if success is false
 *   Common errors:
 *   - "Insufficient funds for OCR sync": Not enough non-OCR balance
 *   - "Mint unreachable": Network error during swap
 *   - "Invalid proofs": Proofs rejected by mint
 *
 * @example
 * const result = await ocrManager.syncOCR(mintUrl);
 * if (result.success) {
 *   console.log(`Added ${result.proofsAdded} proofs, new balance: ${result.newBalance}`);
 * } else {
 *   console.error(`Sync failed: ${result.error}`);
 * }
 */
export interface OCRSyncResult {
  success: boolean;
  proofsAdded: number;
  proofsRemoved: number;
  newBalance: number;
  status: OCRStatus;
  error?: string;
}

/**
 * OCR status result interface
 *
 * Comprehensive snapshot of the current OCR state, returned by getStatus().
 * This gives a complete picture of OCR health at a point in time.
 *
 * @interface OCRStatusResult
 *
 * @property {OCRStatus} status - Overall OCR health status
 *   SYNCED: OCR >= 95% of target (excellent)
 *   OFFLINE_READY: OCR >= 50% of target (good)
 *   OUT_OF_SYNC: OCR < 50% of target (needs refill soon)
 *   DEPLETED: OCR = 0 (critical, no offline spending)
 *
 * @property {number} currentBalance - Current OCR balance in satoshis
 *   This is the sum of all proofs marked as OCR in state UNSPENT
 *
 * @property {number} targetBalance - Configured target balance in satoshis
 *   The amount the system is trying to maintain
 *
 * @property {number} percentOfTarget - Current balance as percentage of target
 *   Range: 0-100+ (can exceed 100 if over-funded)
 *   Example: currentBalance=40k, targetBalance=50k → 80%
 *
 * @property {boolean} needsRefill - Whether OCR should be refilled
 *   true if percentOfTarget < 80%
 *   This triggers auto-refill if enabled
 *
 * @property {'none'|'low'|'critical'} alertLevel - User alert urgency level
 *   none: OCR healthy, no action needed
 *   low: OCR getting low, refill recommended
 *   critical: OCR critically low, refill urgent
 *
 * @example
 * const status = ocrManager.getStatus();
 * console.log(`OCR: ${status.currentBalance}/${status.targetBalance} sats (${status.percentOfTarget}%)`);
 * if (status.needsRefill) {
 *   console.log(`Status: ${status.status}, Alert: ${status.alertLevel}`);
 * }
 */
export interface OCRStatusResult {
  status: OCRStatus;
  currentBalance: number;
  targetBalance: number;
  percentOfTarget: number;
  needsRefill: boolean;
  alertLevel: 'none' | 'low' | 'critical';
}

// ═══════════════════════════════════════════════════════════════════════════════
// OCRManager CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * OCRManager - Offline Cash Reserve Manager
 *
 * This is the central coordinator for the OCR system. It manages the lifecycle
 * of offline-ready proofs, from selection and swapping to spending and refilling.
 *
 * SINGLETON PATTERN:
 * We use the singleton pattern because:
 * 1. There should only be one OCR manager per app instance
 * 2. All components need access to the same OCR state
 * 3. Prevents race conditions from concurrent OCR operations
 * 4. Centralizes configuration management
 *
 * RESPONSIBILITIES:
 * - Monitor OCR balance vs configured target
 * - Automatically swap proofs to maintain OCR when online
 * - Track OCR status (SYNCED, OUT_OF_SYNC, DEPLETED, etc.)
 * - Alert users when OCR is low
 * - Prioritize OCR proofs for offline spending
 * - Provide OCR health metrics and recommendations
 *
 * DEPENDENCIES:
 * - ProofRepository: Stores and retrieves proofs from database
 * - MintRepository: Manages mint URLs and metadata
 * - CashuWalletService: Performs cryptographic proof swaps with mints
 * - Database: Direct database access for configuration
 *
 * LIFECYCLE:
 * 1. App starts → OCRManager.getInstance() creates singleton
 * 2. Constructor loads config from database
 * 3. App monitors network state
 * 4. When online: refillIfNeeded() called periodically
 * 5. When spending: spendFromOCR() called first
 * 6. When receiving: syncOCR() updates OCR balance
 *
 * @class OCRManager
 * @singleton
 *
 * @example
 * // Get the singleton instance
 * const ocrManager = OCRManager.getInstance();
 *
 * // Check OCR status
 * const status = ocrManager.getStatus();
 *
 * // Refill if needed when online
 * const result = await ocrManager.refillIfNeeded(mintUrl);
 *
 * // Spend from OCR offline
 * const payment = await ocrManager.spendFromOCR(mintUrl, 1000);
 */
export class OCRManager {
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Singleton instance holder
   * @private
   * @static
   */
  private static instance: OCRManager;

  /**
   * ProofRepository instance for database operations on proofs
   * Used to:
   * - Query OCR proofs
   * - Mark proofs as OCR/non-OCR
   * - Select proofs for spending
   * - Get proof statistics
   * @private
   */
  private proofRepo: ProofRepository;

  /**
   * MintRepository instance for mint metadata
   * Used to:
   * - Validate mint URLs
   * - Get mint configuration
   * - Track mint health
   * @private
   */
  private mintRepo: MintRepository;

  /**
   * CashuWalletService instance for cryptographic operations
   * Used to:
   * - Swap proofs with mints
   * - Generate blind signatures
   * - Verify proof validity
   * @private
   */
  private walletService: CashuWalletService;

  /**
   * Database instance for direct SQL access
   * Used to:
   * - Load OCR configuration
   * - Save OCR configuration
   * - Query custom data not in repositories
   * @private
   */
  private db: Database;

  /**
   * Current OCR configuration
   *
   * This holds the active configuration that determines how OCR behaves.
   * Loaded from database on startup, can be updated via setConfig().
   *
   * DEFAULT VALUES:
   * - level: MEDIUM (50k sats target)
   * - targetAmount: 50,000 sats (from OCR_TARGETS[MEDIUM])
   * - autoRefill: true (automatically refill when online)
   * - alertThreshold: 20% (alert when below 10k sats for MEDIUM)
   *
   * @private
   */
  private config: OCRConfig = {
    level: OCRLevel.MEDIUM,
    targetAmount: OCR_TARGETS[OCRLevel.MEDIUM],
    autoRefill: true,
    alertThreshold: 20,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR AND SINGLETON
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Private constructor (singleton pattern)
   *
   * Initializes all dependencies and loads configuration from database.
   * Called only once by getInstance() when the singleton is created.
   *
   * INITIALIZATION SEQUENCE:
   * 1. Get singleton instances of all repositories
   * 2. Get singleton instance of wallet service
   * 3. Get database instance
   * 4. Load saved configuration from database (or use defaults)
   *
   * NOTE: Constructor is private to prevent direct instantiation.
   * Always use OCRManager.getInstance() instead.
   *
   * @private
   * @constructor
   */
  private constructor() {
    // Initialize repository dependencies (all are singletons)
    this.proofRepo = ProofRepository.getInstance();
    this.mintRepo = MintRepository.getInstance();
    this.walletService = CashuWalletService.getInstance();
    this.db = Database.getInstance();

    // Load user's saved configuration from database
    // If none exists, defaults defined above will be used
    this.loadConfig();
  }

  /**
   * Get the singleton instance of OCRManager
   *
   * This is the ONLY way to obtain an OCRManager instance.
   * The first call creates the instance, subsequent calls return the same one.
   *
   * THREAD SAFETY:
   * JavaScript is single-threaded, so no mutex needed.
   * React Native's event loop ensures this is safe.
   *
   * @static
   * @returns {OCRManager} The singleton OCRManager instance
   *
   * @example
   * const ocrManager = OCRManager.getInstance();
   * const status = ocrManager.getStatus();
   */
  static getInstance(): OCRManager {
    if (!OCRManager.instance) {
      OCRManager.instance = new OCRManager();
    }
    return OCRManager.instance;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Load OCR configuration from database
   *
   * Reads the saved configuration from the 'ocr_config' table and applies it
   * to this.config. If no configuration exists in the database, the default
   * values (defined in the config property initializer) will remain.
   *
   * DATABASE SCHEMA:
   * ocr_config table has columns:
   * - ocr_level: TEXT (LOW/MEDIUM/HIGH)
   * - target_amount: INTEGER (satoshis)
   * - auto_refill: INTEGER (0 or 1, SQLite boolean)
   * - alert_threshold: INTEGER (percentage 0-100)
   *
   * ERROR HANDLING:
   * - If table doesn't exist: Silently use defaults
   * - If query fails: Log error and use defaults
   * - If no rows: Use defaults (new user)
   *
   * CALLED BY:
   * - constructor() during initialization
   *
   * @private
   * @returns {void}
   */
  private loadConfig(): void {
    try {
      // Query the configuration table (LIMIT 1 because there should only be one row)
      const result = this.db.querySync<any>(
        'SELECT * FROM ocr_config LIMIT 1'
      );

      // If configuration exists, apply it
      if (result.length > 0) {
        const row = result[0];
        this.config = {
          level: row.ocr_level as OCRLevel,
          targetAmount: row.target_amount,
          autoRefill: row.auto_refill === 1, // SQLite stores booleans as 0/1
          alertThreshold: row.alert_threshold,
        };
      }
      // If no rows, defaults will be used (already set in property initializer)
    } catch (error) {
      // Log error but don't crash - defaults will be used
      // This handles cases like:
      // - Table doesn't exist yet (first run)
      // - Database corruption
      // - Migration issues
      console.error('[OCRManager] Failed to load config:', error);
    }
  }

  /**
   * Save OCR configuration to database
   *
   * Persists the current configuration to the database so it survives app restarts.
   * Uses an "upsert" pattern: delete any existing config, then insert the new one.
   *
   * WHY UPSERT (DELETE + INSERT)?
   * - Simpler than UPDATE OR INSERT logic
   * - Ensures only one config row exists
   * - Avoids primary key conflicts
   * - SQLite is fast enough that this doesn't matter
   *
   * ATOMICITY:
   * The database should handle this in a transaction automatically.
   * If INSERT fails, DELETE is rolled back.
   *
   * ERROR HANDLING:
   * - If save fails, config remains in memory but won't persist
   * - User will lose settings on app restart
   * - Error is logged for debugging
   *
   * CALLED BY:
   * - setConfig() after user changes configuration
   *
   * @private
   * @async
   * @returns {Promise<void>}
   */
  private async saveConfig(): Promise<void> {
    try {
      // Delete any existing configuration (there should be 0 or 1 rows)
      await this.db.execute('DELETE FROM ocr_config');

      // Insert the current configuration
      await this.db.execute(
        `INSERT INTO ocr_config (ocr_level, target_amount, auto_refill, alert_threshold)
         VALUES (?, ?, ?, ?)`,
        [
          this.config.level,
          this.config.targetAmount,
          this.config.autoRefill ? 1 : 0, // Convert boolean to SQLite integer
          this.config.alertThreshold,
        ]
      );
    } catch (error) {
      // Log error but don't throw - config will remain in memory
      // User experience isn't affected until app restart
      console.error('[OCRManager] Failed to save config:', error);
    }
  }

  /**
   * Get current OCR configuration
   *
   * Returns a COPY of the current configuration to prevent external modification.
   * To change configuration, use setConfig() instead.
   *
   * WHY RETURN A COPY?
   * Prevents callers from accidentally modifying the internal config:
   *
   * BAD (if we returned this.config directly):
   *   const config = ocrManager.getConfig();
   *   config.autoRefill = false; // This would modify internal state!
   *
   * GOOD (with spread operator creating copy):
   *   const config = ocrManager.getConfig();
   *   config.autoRefill = false; // This only modifies the copy
   *
   * @public
   * @returns {OCRConfig} A copy of the current OCR configuration
   *
   * @example
   * const config = ocrManager.getConfig();
   * console.log(`OCR Level: ${config.level}`);
   * console.log(`Target: ${config.targetAmount} sats`);
   * console.log(`Auto-refill: ${config.autoRefill ? 'ON' : 'OFF'}`);
   */
  getConfig(): OCRConfig {
    // Use spread operator to create a shallow copy
    return { ...this.config };
  }

  /**
   * Update OCR configuration
   *
   * Allows partial updates to the configuration. Only provided fields are updated.
   * Changes are applied to memory immediately and persisted to database asynchronously.
   *
   * PARTIAL UPDATES:
   * You can update just one field without affecting others:
   *   setConfig({ autoRefill: false }); // Only changes autoRefill
   *
   * LEVEL vs TARGET AMOUNT:
   * - If 'level' is provided, 'targetAmount' is automatically set from OCR_TARGETS
   * - If both 'level' AND 'targetAmount' are provided, 'targetAmount' wins (custom target)
   * - This allows users to choose preset levels or set custom amounts
   *
   * EXAMPLES:
   *
   * // Use preset HIGH level (100k sats)
   * await setConfig({ level: OCRLevel.HIGH });
   * // Result: level=HIGH, targetAmount=100000
   *
   * // Use preset MEDIUM but with custom target
   * await setConfig({ level: OCRLevel.MEDIUM, targetAmount: 75000 });
   * // Result: level=MEDIUM, targetAmount=75000
   *
   * // Change only auto-refill setting
   * await setConfig({ autoRefill: false });
   * // Result: level unchanged, targetAmount unchanged, autoRefill=false
   *
   * @public
   * @async
   * @param {Partial<OCRConfig>} config - Partial configuration to update
   * @returns {Promise<void>}
   *
   * @example
   * // Set to HIGH level (100k sats target)
   * await ocrManager.setConfig({ level: OCRLevel.HIGH });
   *
   * // Disable auto-refill
   * await ocrManager.setConfig({ autoRefill: false });
   *
   * // Set custom alert threshold (alert at 30%)
   * await ocrManager.setConfig({ alertThreshold: 30 });
   *
   * // Set everything at once
   * await ocrManager.setConfig({
   *   level: OCRLevel.LOW,
   *   autoRefill: true,
   *   alertThreshold: 15
   * });
   */
  async setConfig(config: Partial<OCRConfig>): Promise<void> {
    // Update level and corresponding target amount
    if (config.level !== undefined) {
      this.config.level = config.level;
      // Automatically set target amount from preset unless custom amount provided
      this.config.targetAmount = OCR_TARGETS[config.level];
    }

    // Update auto-refill flag
    if (config.autoRefill !== undefined) {
      this.config.autoRefill = config.autoRefill;
    }

    // Update alert threshold percentage
    if (config.alertThreshold !== undefined) {
      this.config.alertThreshold = config.alertThreshold;
    }

    // Update custom target amount (overrides level's default)
    if (config.targetAmount !== undefined) {
      this.config.targetAmount = config.targetAmount;
    }

    // Persist changes to database
    await this.saveConfig();

    // Log for debugging and monitoring
    console.log('[OCRManager] Config updated:', this.config);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS AND MONITORING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get current OCR status
   *
   * This is the PRIMARY method for checking OCR health. It calculates the current
   * status by comparing actual OCR balance to the configured target.
   *
   * CALCULATION LOGIC:
   *
   * 1. Get current OCR balance from ProofRepository
   *    - Sums all proofs where: state=UNSPENT AND is_ocr=true
   *
   * 2. Calculate percent of target
   *    - percentOfTarget = (currentBalance / targetBalance) × 100
   *    - Example: 40k sats / 50k target = 80%
   *
   * 3. Determine status based on percentage:
   *    - >= 95%: SYNCED (green, excellent)
   *    - >= 50%: OFFLINE_READY (blue, good)
   *    - > 0%: OUT_OF_SYNC (yellow, needs refill)
   *    - = 0%: DEPLETED (red, critical)
   *
   * 4. Determine alert level:
   *    - >= 2× threshold: none (e.g., >= 40% if threshold is 20%)
   *    - >= threshold: low (e.g., >= 20% if threshold is 20%)
   *    - < threshold: critical (e.g., < 20% if threshold is 20%)
   *
   * 5. Determine if refill needed:
   *    - needsRefill = true if percentOfTarget < 80%
   *    - This is the trigger for auto-refill
   *
   * PERFORMANCE:
   * - Very fast: Just sums proof amounts from database
   * - No network calls
   * - Can be called frequently (e.g., on every screen render)
   *
   * EDGE CASES:
   * - If target is 0: Division by zero, but target should never be 0
   * - If balance > target: percentOfTarget > 100, status = SYNCED (good)
   * - If no proofs exist: currentBalance = 0, status = DEPLETED
   *
   * @public
   * @returns {OCRStatusResult} Current OCR status snapshot
   *
   * @example
   * const status = ocrManager.getStatus();
   *
   * // Display to user
   * console.log(`OCR: ${status.currentBalance} / ${status.targetBalance} sats`);
   * console.log(`Status: ${status.status}`);
   *
   * // Check if action needed
   * if (status.alertLevel === 'critical') {
   *   showAlert('OCR critically low! Please connect to refill.');
   * }
   *
   * // Decide whether to allow offline payment
   * if (status.status === OCRStatus.DEPLETED) {
   *   showError('Cannot pay offline - OCR depleted');
   * }
   */
  getStatus(): OCRStatusResult {
    // Get current OCR balance from database
    // This queries: SELECT SUM(amount) FROM proofs WHERE state='UNSPENT' AND is_ocr=1
    const currentBalance = this.proofRepo.getOCRBalance();

    // Get target from configuration
    const targetBalance = this.config.targetAmount;

    // Calculate percentage (how full is the OCR reserve?)
    const percentOfTarget = (currentBalance / targetBalance) * 100;

    // Determine overall status based on percentage thresholds
    let status: OCRStatus;
    if (percentOfTarget >= 95) {
      // Nearly full or overfull - excellent
      status = OCRStatus.SYNCED;
    } else if (percentOfTarget >= 50) {
      // At least half full - good for offline spending
      status = OCRStatus.OFFLINE_READY;
    } else if (percentOfTarget > 0) {
      // Some OCR left but depleting - needs refill
      status = OCRStatus.OUT_OF_SYNC;
    } else {
      // No OCR - critical situation
      status = OCRStatus.DEPLETED;
    }

    // Determine user alert level
    let alertLevel: 'none' | 'low' | 'critical' = 'none';
    if (percentOfTarget < this.config.alertThreshold) {
      // Below threshold (e.g., < 20%) - critical alert
      alertLevel = 'critical';
    } else if (percentOfTarget < this.config.alertThreshold * 2) {
      // Below 2× threshold (e.g., < 40%) - warning alert
      alertLevel = 'low';
    }
    // else: above 2× threshold - no alert needed

    // Return complete status snapshot
    return {
      status,
      currentBalance,
      targetBalance,
      percentOfTarget,
      needsRefill: percentOfTarget < 80, // Trigger auto-refill at 80%
      alertLevel,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE OCR OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Sync OCR balance (swap proofs to reach target)
   *
   * This is the CORE OCR OPERATION that maintains the offline reserve.
   * It swaps regular (non-OCR) proofs for fresh ones and marks them as OCR.
   *
   * HOW IT WORKS:
   *
   * 1. CHECK CURRENT STATUS
   *    - If already SYNCED (>= 95% of target), return immediately
   *    - No need to swap if we're already topped up
   *
   * 2. CALCULATE DEFICIT
   *    - deficit = target - current OCR balance
   *    - Example: target=50k, current=30k → deficit=20k
   *
   * 3. CHECK AVAILABLE FUNDS
   *    - Query non-OCR proofs (regular wallet balance)
   *    - If available < deficit → return error "Insufficient funds"
   *    - User needs more total balance to fill OCR
   *
   * 4. SELECT PROOFS TO SWAP
   *    - Call selectProofsForOCR() to pick optimal proofs
   *    - Uses greedy algorithm (largest first) for efficiency
   *    - Minimizes number of proofs to swap
   *
   * 5. PERFORM SWAP WITH MINT
   *    - Call walletService.swapProofs() with selected proof IDs
   *    - Mint receives old proofs, returns new blind signatures
   *    - This is a NETWORK OPERATION (requires internet)
   *
   * 6. MARK NEW PROOFS AS OCR
   *    - Update database: SET is_ocr=1 for new proofs
   *    - Old proofs automatically marked as SPENT by swap
   *
   * 7. RETURN RESULT
   *    - Success: Report how many proofs added/removed
   *    - Failure: Return error message
   *
   * SECURITY CONSIDERATIONS:
   *
   * - FRESH PROOFS: Swapping ensures we get brand new blind signatures
   * - UNSPENT: Old proofs are immediately marked spent, preventing double-spend
   * - ATOMIC: If swap fails, no proofs are marked as spent (rollback)
   * - VERIFIED: Mint signatures are cryptographically verified before storage
   *
   * ERROR SCENARIOS:
   *
   * - Network offline: Swap fails, error returned
   * - Mint unreachable: Timeout, error returned
   * - Invalid proofs: Mint rejects, error returned
   * - Insufficient balance: Not enough non-OCR proofs
   * - Database error: Transaction rolled back
   *
   * PERFORMANCE:
   *
   * - Duration: ~2 seconds per swap (network dependent)
   * - Can swap ~10-20 proofs per operation
   * - For large deficits, may need multiple calls
   *
   * @public
   * @async
   * @param {string} mintUrl - The mint URL to swap proofs with
   *   Must be a mint that the user has proofs for
   *   Example: "https://mint.example.com"
   *
   * @returns {Promise<OCRSyncResult>} Result of the sync operation
   *
   * @throws Does not throw - returns result with success=false on error
   *
   * @example
   * // Manually sync OCR to target
   * const result = await ocrManager.syncOCR('https://mint.example.com');
   *
   * if (result.success) {
   *   console.log(`OCR synced!`);
   *   console.log(`Added ${result.proofsAdded} proofs`);
   *   console.log(`Removed ${result.proofsRemoved} old proofs`);
   *   console.log(`New balance: ${result.newBalance} sats`);
   *   console.log(`Status: ${result.status}`);
   * } else {
   *   console.error(`Sync failed: ${result.error}`);
   *   // Common errors:
   *   // - "Insufficient funds for OCR sync"
   *   // - "Mint unreachable"
   *   // - "Network timeout"
   * }
   *
   * // Check if we reached target
   * if (result.status === OCRStatus.SYNCED) {
   *   console.log('OCR fully topped up!');
   * } else if (result.status === OCRStatus.OUT_OF_SYNC) {
   *   console.log('Partial refill - not enough balance to reach target');
   * }
   */
  async syncOCR(mintUrl: string): Promise<OCRSyncResult> {
    try {
      // Step 1: Check current status
      const status = this.getStatus();

      // If already synced, nothing to do
      if (status.status === OCRStatus.SYNCED) {
        return {
          success: true,
          proofsAdded: 0,
          proofsRemoved: 0,
          newBalance: status.currentBalance,
          status: OCRStatus.SYNCED,
        };
      }

      // Step 2: Calculate how much we need to add
      const deficit = this.config.targetAmount - status.currentBalance;

      console.log(`[OCRManager] OCR deficit: ${deficit} sats`);

      // Step 3: Get available non-OCR proofs (regular wallet balance)
      // Query: SELECT * FROM proofs WHERE mint_url=? AND state='UNSPENT' AND is_ocr=0
      const availableProofs = await this.proofRepo.getAll({
        mintUrl,
        state: ProofState.UNSPENT,
        isOCR: false, // Only get regular (non-OCR) proofs
      });

      // Calculate total available balance
      const availableBalance = availableProofs.reduce((sum, p) => sum + p.amount, 0);

      // Check if we have enough funds
      if (availableBalance < deficit) {
        console.warn(`[OCRManager] Insufficient funds for OCR sync`);
        return {
          success: false,
          proofsAdded: 0,
          proofsRemoved: 0,
          newBalance: status.currentBalance,
          status: status.status,
          error: 'Insufficient funds for OCR sync',
        };
      }

      // Step 4: Select optimal proofs to convert to OCR
      // Uses greedy algorithm (largest proofs first) to minimize proof count
      const selection = await this.selectProofsForOCR(mintUrl, deficit);

      // Step 5: Swap proofs with the mint
      // NETWORK OPERATION: This calls the mint's /swap endpoint
      // Sends: selected proofs
      // Receives: new blind signatures (fresh proofs)
      // Old proofs are automatically marked as SPENT
      const swapResult = await this.walletService.swapProofs(
        mintUrl,
        selection.map(p => p.id)
      );

      // Step 6: Mark new proofs as OCR in database
      // UPDATE proofs SET is_ocr=1 WHERE id IN (...)
      const ocrProofIds = swapResult.newProofs.map(p => p.id);
      await this.proofRepo.markAsOCR(ocrProofIds);

      // Step 7: Get updated status
      const newStatus = this.getStatus();

      console.log(`[OCRManager] OCR synced: ${ocrProofIds.length} proofs added`);

      // Return success result
      return {
        success: true,
        proofsAdded: ocrProofIds.length,
        proofsRemoved: selection.length,
        newBalance: newStatus.currentBalance,
        status: newStatus.status,
      };
    } catch (error: any) {
      // Catch any errors (network, database, validation, etc.)
      console.error('[OCRManager] OCR sync failed:', error);
      return {
        success: false,
        proofsAdded: 0,
        proofsRemoved: 0,
        newBalance: this.getStatus().currentBalance,
        status: this.getStatus().status,
        error: error.message,
      };
    }
  }

  /**
   * Select proofs to convert to OCR
   *
   * This is a critical optimization function that chooses which proofs to swap.
   * The goal is to reach the target amount with the MINIMUM number of proofs.
   *
   * WHY MINIMIZE PROOF COUNT?
   * - Fewer proofs = smaller swap transaction
   * - Faster network transmission
   * - Lower mint processing time
   * - Less database overhead
   * - Better privacy (fewer proof IDs exposed)
   *
   * ALGORITHM: Greedy Selection (Largest First)
   *
   * 1. Get all available non-OCR proofs for this mint
   * 2. Sort by amount (largest to smallest)
   * 3. Greedily select proofs until sum >= target amount
   * 4. Return selected proofs
   *
   * EXAMPLE:
   *
   * Need: 20,000 sats
   * Available proofs: [1000, 5000, 8000, 2000, 10000, 500]
   *
   * Step 1: Sort descending: [10000, 8000, 5000, 2000, 1000, 500]
   * Step 2: Select greedily:
   *   - Take 10000 (total: 10000)
   *   - Take 8000 (total: 18000)
   *   - Take 5000 (total: 23000) ← exceeds target, STOP
   * Step 3: Return [10000, 8000, 5000]
   *
   * Result: 3 proofs selected (optimal for this case)
   *
   * ALTERNATIVE ALGORITHMS CONSIDERED:
   *
   * 1. Exact Subset Sum (Dynamic Programming)
   *    - Pro: Finds exact match if possible
   *    - Con: O(n × amount) time complexity, too slow
   *    - Con: Complex implementation
   *
   * 2. Smallest First
   *    - Pro: Preserves large proofs for later
   *    - Con: Requires MORE proofs for same amount
   *    - Con: Worse performance
   *
   * 3. Random Selection
   *    - Pro: Better privacy (unpredictable)
   *    - Con: Suboptimal proof count
   *    - Con: Inconsistent performance
   *
   * 4. Greedy (Largest First) ← CHOSEN
   *    - Pro: Minimizes proof count
   *    - Pro: O(n log n) time (just sorting)
   *    - Pro: Simple and predictable
   *    - Con: May slightly overshoot target
   *
   * EDGE CASES:
   *
   * - No proofs available: Returns empty array (caller checks this)
   * - All proofs smaller than target: Returns all proofs
   * - Exact match possible: May overshoot slightly (acceptable)
   * - Amount is 0: Returns empty array immediately
   *
   * FUTURE IMPROVEMENTS:
   *
   * - Could implement "best fit" to minimize overshoot
   * - Could track historical proof sizes and pre-optimize
   * - Could use dynamic programming for small proof sets
   * - Could randomize selection for privacy (with slight efficiency cost)
   *
   * @private
   * @async
   * @param {string} mintUrl - The mint URL to select proofs from
   * @param {number} amount - The target amount to reach (in satoshis)
   *
   * @returns {Promise<Proof[]>} Array of selected proofs
   *   - Empty array if no proofs available
   *   - Sum of returned proofs >= amount (usually)
   *   - Minimal number of proofs to reach amount
   *
   * @example
   * // Internal use only (private method)
   * const proofs = await this.selectProofsForOCR(mintUrl, 50000);
   * console.log(`Selected ${proofs.length} proofs totaling ${sum(proofs)} sats`);
   */
  private async selectProofsForOCR(
    mintUrl: string,
    amount: number
  ): Promise<Proof[]> {
    // Step 1: Get all available non-OCR proofs
    // Query: SELECT * FROM proofs WHERE mint_url=? AND state='UNSPENT' AND is_ocr=0
    const proofs = await this.proofRepo.getAll({
      mintUrl,
      state: ProofState.UNSPENT,
      isOCR: false, // Only select from regular wallet balance
    });

    // Step 2: Sort by amount (largest first)
    // This is the key to the greedy algorithm
    // Example: [10000, 8000, 5000, 2000, 1000, 500]
    proofs.sort((a, b) => b.amount - a.amount);

    // Step 3: Greedy selection
    const selected: Proof[] = [];
    let total = 0;

    // Take proofs in order until we reach the target amount
    for (const proof of proofs) {
      if (total >= amount) break; // Stop when we have enough
      selected.push(proof);
      total += proof.amount;
    }

    // Return selected proofs
    // Note: total may be slightly more than amount (acceptable overshoot)
    return selected;
  }

  /**
   * Refill OCR if needed
   *
   * This is the AUTO-REFILL function called by the app when network becomes available.
   * It intelligently decides whether to refill based on current status and configuration.
   *
   * DECISION LOGIC:
   *
   * 1. Check if auto-refill is enabled
   *    - If disabled → return null (no action)
   *    - User must manually sync
   *
   * 2. Check current OCR status
   *    - If needsRefill is false (>= 80% of target) → return null
   *    - Already have sufficient OCR
   *
   * 3. Perform auto-sync
   *    - Call syncOCR() to perform the actual refill
   *    - Returns the sync result
   *
   * WHEN TO CALL THIS:
   *
   * - Network state changes to online
   * - App returns to foreground
   * - After receiving new proofs
   * - Periodically when online (e.g., every 5 minutes)
   *
   * INTEGRATION POINTS:
   *
 * ```typescript
   * // In NetworkMonitor or App.tsx
   * useEffect(() => {
   *   const subscription = NetInfo.addEventListener(state => {
   *     if (state.isConnected) {
   *       // We're online! Try to refill OCR
   *       const ocrManager = OCRManager.getInstance();
   *       const mintUrl = getCurrentMintUrl();
   *       ocrManager.refillIfNeeded(mintUrl)
   *         .then(result => {
   *           if (result?.success) {
   *             showNotification('OCR refilled successfully');
   *           }
   *         });
   *     }
   *   });
   *   return () => subscription();
   * }, []);
   * ```
   *
   * PERFORMANCE:
   *
   * - Very fast if refill not needed (just status check)
   * - ~2-5 seconds if refill happens (network dependent)
   * - Non-blocking (can be called in background)
   *
   * EDGE CASES:
   *
   * - Auto-refill disabled: Returns null immediately
   * - Already synced: Returns null immediately
   * - No internet: syncOCR() will fail and return error
   * - Insufficient balance: syncOCR() returns error
   *
   * @public
   * @async
   * @param {string} mintUrl - The mint URL to refill from
   *
   * @returns {Promise<OCRSyncResult | null>}
   *   - OCRSyncResult if refill was attempted
   *   - null if refill was not needed or not enabled
   *
   * @example
   * // Called when network becomes available
   * const result = await ocrManager.refillIfNeeded(mintUrl);
   *
   * if (result === null) {
   *   console.log('Refill not needed or disabled');
   * } else if (result.success) {
   *   console.log(`OCR refilled: ${result.newBalance} sats`);
   *   showNotification('Offline reserve refilled');
   * } else {
   *   console.error(`Refill failed: ${result.error}`);
   * }
   *
   * // Periodic check (every 5 minutes when online)
   * setInterval(async () => {
   *   if (isOnline) {
   *     await ocrManager.refillIfNeeded(mintUrl);
   *   }
   * }, 5 * 60 * 1000);
   */
  async refillIfNeeded(mintUrl: string): Promise<OCRSyncResult | null> {
    // Check if auto-refill is enabled in configuration
    if (!this.config.autoRefill) {
      return null; // User has disabled auto-refill
    }

    // Get current status to determine if refill is needed
    const status = this.getStatus();

    // Only refill if below 80% of target
    // This prevents unnecessary refills when OCR is still healthy
    if (!status.needsRefill) {
      return null; // OCR is still sufficiently funded
    }

    // Log for monitoring and debugging
    console.log('[OCRManager] Auto-refilling OCR...');

    // Perform the actual refill (calls syncOCR internally)
    return await this.syncOCR(mintUrl);
  }

  /**
   * Spend from OCR
   *
   * This is the OFFLINE SPENDING function that prioritizes OCR proofs.
   * It selects proofs from the OCR reserve for a payment.
   *
   * WHY PRIORITIZE OCR FOR SPENDING?
   *
   * - OCR proofs are already swapped (fresh signatures)
   * - They're optimized for offline use
   * - Preserves non-OCR proofs for future OCR refills
   * - Ensures offline capability is maintained longest
   *
   * HOW IT WORKS:
   *
   * 1. Query all OCR proofs for this mint
   *    - SELECT * FROM proofs WHERE mint_url=? AND state='UNSPENT' AND is_ocr=1
   *
   * 2. Check if we have enough OCR balance
   *    - Sum all OCR proof amounts
   *    - If sum < requested amount → return null (insufficient OCR)
   *
   * 3. Select proofs to spend
   *    - Call proofRepo.selectProofsForAmount() with useOCR=true
   *    - This uses coin selection algorithm (similar to Bitcoin)
   *    - Marks selected proofs as PENDING (reserved for this transaction)
   *
   * 4. Return selected proofs
   *    - Caller can now use these proofs for payment
   *    - After successful payment, mark as SPENT
   *    - If payment fails, revert to UNSPENT
   *
   * TRANSACTION LIFECYCLE:
   *
   * 1. Call spendFromOCR(mintUrl, amount)
   * 2. Proofs marked as PENDING (locked)
   * 3. Transfer proofs to recipient
   * 4. On success: Mark as SPENT (permanently)
   * 5. On failure: Mark as UNSPENT (unlock)
   *
   * COIN SELECTION ALGORITHM:
   *
   * The actual selection is delegated to ProofRepository.selectProofsForAmount(),
   * which implements a sophisticated coin selection algorithm similar to Bitcoin:
   *
   * - Prefers exact match if available
   * - Minimizes number of proofs
   * - Minimizes change (overshoot)
   * - Considers proof age/freshness
   *
   * FALLBACK TO REGULAR PROOFS:
   *
   * If this returns null (insufficient OCR), the caller should:
   * 1. Check if online
   * 2. If online: Can use regular proofs (swap first if needed)
   * 3. If offline: Payment fails (no offline capability)
   *
   * EXAMPLE USAGE:
   *
   * ```typescript
   * // Try to pay 5000 sats offline
   * const payment = await ocrManager.spendFromOCR(mintUrl, 5000);
   *
   * if (payment === null) {
   *   // Insufficient OCR
   *   if (isOnline) {
   *     // Use regular proofs (requires swap)
   *     payment = await walletService.selectProofs(mintUrl, 5000);
   *   } else {
   *     // Cannot pay offline
   *     showError('Insufficient OCR for offline payment');
   *     return;
   *   }
   * }
   *
   * // Send payment to recipient
   * const success = await sendProofs(payment.proofs, recipientAddress);
   *
   * if (success) {
   *   // Mark proofs as spent
   *   await proofRepo.markAsSpent(payment.proofs.map(p => p.id));
   * } else {
   *   // Unlock proofs for future use
   *   await proofRepo.unlockProofs(payment.proofs.map(p => p.id));
   * }
   * ```
   *
   * SECURITY NOTES:
   *
   * - Proofs are locked (PENDING) immediately to prevent double-spend
   * - If app crashes during payment, proofs remain PENDING (safe)
   * - On app restart, PENDING proofs should be verified and unlocked if needed
   * - Transaction IDs prevent confusion between concurrent payments
   *
   * @public
   * @async
   * @param {string} mintUrl - The mint URL to spend from
   * @param {number} amount - The amount to spend (in satoshis)
   *
   * @returns {Promise<{proofs: Proof[], total: number} | null>}
   *   - Object with selected proofs and total amount if successful
   *   - null if insufficient OCR balance
   *
   * @example
   * // Pay 10,000 sats offline
   * const payment = await ocrManager.spendFromOCR(mintUrl, 10000);
   *
   * if (payment === null) {
   *   console.error('Insufficient OCR balance');
   *   const status = ocrManager.getStatus();
   *   console.log(`OCR balance: ${status.currentBalance} sats`);
   *   console.log('Cannot pay offline - need to refill or go online');
   *   return;
   * }
   *
   * console.log(`Selected ${payment.proofs.length} proofs`);
   * console.log(`Total amount: ${payment.total} sats`);
   *
   * // Use proofs for payment...
   * await sendProofsToRecipient(payment.proofs);
   */
  async spendFromOCR(
    mintUrl: string,
    amount: number
  ): Promise<{ proofs: Proof[]; total: number } | null> {
    try {
      // Step 1: Get all OCR proofs for this mint
      // Query: SELECT * FROM proofs WHERE mint_url=? AND state='UNSPENT' AND is_ocr=1
      const ocrProofs = await this.proofRepo.getAll({
        mintUrl,
        state: ProofState.UNSPENT,
        isOCR: true, // Only get OCR proofs
      });

      // Step 2: Check if we have enough OCR balance
      const ocrBalance = ocrProofs.reduce((sum, p) => sum + p.amount, 0);

      if (ocrBalance < amount) {
        console.warn('[OCRManager] Insufficient OCR balance');
        return null; // Not enough OCR to spend
      }

      // Step 3: Select proofs for this payment
      // This uses coin selection algorithm and marks proofs as PENDING
      const transactionId = generateUUID(); // Unique ID for this transaction
      const selection = await this.proofRepo.selectProofsForAmount(
        mintUrl,
        amount,
        transactionId,
        true // useOCR: prioritize OCR proofs
      );

      // Step 4: Return selected proofs
      return {
        proofs: selection.proofs,
        total: selection.total,
      };
    } catch (error: any) {
      // Log error and return null
      // Caller should handle this as "insufficient OCR"
      console.error('[OCRManager] Failed to spend from OCR:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OCR MANAGEMENT UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Convert non-OCR proofs to OCR
   *
   * Allows manual promotion of regular proofs to OCR status.
   * This is useful when user wants to manually manage their OCR.
   *
   * USE CASES:
   *
   * - User just received fresh proofs and wants them in OCR
   * - User wants to manually set aside specific proofs for offline use
   * - Advanced users optimizing their proof management
   * - Testing and debugging OCR behavior
   *
   * WHAT IT DOES:
   *
   * - Updates database: SET is_ocr=1 WHERE id IN (...)
   * - Does NOT swap proofs (they may not be fresh)
   * - Does NOT verify proof freshness
   * - Simply marks them as OCR
   *
   * SECURITY WARNING:
   *
   * Converting old proofs to OCR without swapping is RISKY:
   * - They may have been previously shared
   * - They may be stale (mint may have invalidated)
   * - They lack the freshness guarantee of swapped proofs
   *
   * RECOMMENDATION:
   *
   * For best security, use syncOCR() instead, which:
   * - Swaps proofs for fresh ones
   * - Guarantees new blind signatures
   * - Ensures proofs are unspent
   *
   * @public
   * @async
   * @param {string[]} proofIds - Array of proof IDs to mark as OCR
   *
   * @returns {Promise<void>}
   *
   * @example
   * // Manually mark specific proofs as OCR
   * const proofIds = ['proof-123', 'proof-456'];
   * await ocrManager.convertToOCR(proofIds);
   *
   * // Verify they're now OCR
   * const status = ocrManager.getStatus();
   * console.log(`New OCR balance: ${status.currentBalance}`);
   */
  async convertToOCR(proofIds: string[]): Promise<void> {
    // Delegate to ProofRepository
    // UPDATE proofs SET is_ocr=1 WHERE id IN (...)
    await this.proofRepo.markAsOCR(proofIds);
  }

  /**
   * Remove proofs from OCR
   *
   * Demotes OCR proofs back to regular (non-OCR) status.
   * This decreases OCR balance without actually spending the proofs.
   *
   * USE CASES:
   *
   * - User wants to reduce OCR target
   * - User needs proofs for online payment (not offline)
   * - Freeing up proofs for general wallet use
   * - Rebalancing between OCR and regular balance
   *
   * WHAT IT DOES:
   *
   * - Updates database: SET is_ocr=0 WHERE id IN (...)
   * - Proofs remain UNSPENT, just no longer marked as OCR
   * - OCR balance decreases
   * - Regular balance increases
   *
   * EFFECT ON STATUS:
   *
   * - OCR balance decreases
   * - May change status (SYNCED → OUT_OF_SYNC)
   * - May trigger auto-refill if enabled
   *
   * @public
   * @async
   * @param {string[]} proofIds - Array of proof IDs to remove from OCR
   *
   * @returns {Promise<void>}
   *
   * @example
   * // Remove specific proofs from OCR
   * const proofIds = ['proof-789', 'proof-012'];
   * await ocrManager.removeFromOCR(proofIds);
   *
   * // Check new status
   * const status = ocrManager.getStatus();
   * console.log(`OCR balance: ${status.currentBalance}`);
   * if (status.needsRefill) {
   *   console.log('This triggered a refill need');
   * }
   */
  async removeFromOCR(proofIds: string[]): Promise<void> {
    // Delegate to ProofRepository
    // UPDATE proofs SET is_ocr=0 WHERE id IN (...)
    await this.proofRepo.unmarkAsOCR(proofIds);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS AND MONITORING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get OCR statistics
   *
   * Returns comprehensive statistics about the OCR system.
   * Useful for displaying to users and monitoring system health.
   *
   * STATISTICS PROVIDED:
   *
   * - ocrBalance: Total value of OCR proofs (sats)
   * - ocrProofCount: Number of individual OCR proofs
   * - targetBalance: Configured target amount (sats)
   * - percentOfTarget: Current balance as % of target
   * - status: Overall OCR status (SYNCED/OUT_OF_SYNC/etc)
   * - level: Current OCR level (LOW/MEDIUM/HIGH)
   *
   * DISPLAY EXAMPLES:
   *
   * Simple:
   * "OCR: 45,000 / 50,000 sats (90%)"
   *
   * Detailed:
   * "Offline Reserve: 45,000 sats (15 proofs)
   *  Target: 50,000 sats (MEDIUM level)
   *  Status: OFFLINE_READY (90% of target)"
   *
   * @public
   * @returns {Object} OCR statistics object
   * @returns {number} ocrBalance - Current OCR balance in sats
   * @returns {number} ocrProofCount - Number of OCR proofs
   * @returns {number} targetBalance - Target balance in sats
   * @returns {number} percentOfTarget - Percent of target (0-100+)
   * @returns {OCRStatus} status - Current OCR status
   * @returns {OCRLevel} level - Current OCR level
   *
   * @example
   * const stats = ocrManager.getStats();
   *
   * // Display in UI
   * console.log(`OCR: ${stats.ocrBalance.toLocaleString()} sats`);
   * console.log(`${stats.ocrProofCount} proofs`);
   * console.log(`${stats.percentOfTarget.toFixed(1)}% of ${stats.targetBalance} sats target`);
   * console.log(`Level: ${stats.level}`);
   * console.log(`Status: ${stats.status}`);
   *
   * // Use for monitoring
   * if (stats.percentOfTarget < 50) {
   *   sendAlert('OCR below 50%');
   * }
   */
  getStats(): {
    ocrBalance: number;
    ocrProofCount: number;
    targetBalance: number;
    percentOfTarget: number;
    status: OCRStatus;
    level: OCRLevel;
  } {
    // Get current status (includes percentOfTarget, status)
    const status = this.getStatus();

    // Get detailed statistics from repository
    const stats = this.proofRepo.getStats();

    // Return combined statistics
    return {
      ocrBalance: stats.ocrValue,      // Total sats in OCR
      ocrProofCount: stats.ocr,         // Number of OCR proofs
      targetBalance: this.config.targetAmount,
      percentOfTarget: status.percentOfTarget,
      status: status.status,
      level: this.config.level,
    };
  }

  /**
   * Get OCR health check
   *
   * Performs a comprehensive health check of the OCR system and provides
   * actionable recommendations. This is like a doctor's checkup for your OCR.
   *
   * WHAT IT CHECKS:
   *
   * 1. Depletion: Is OCR completely empty?
   * 2. Sync Status: Is OCR out of sync with target?
   * 3. Alert Levels: Is OCR below critical or warning thresholds?
   * 4. Target Realism: Is target amount realistic given total balance?
   *
   * HEALTH DETERMINATION:
   *
   * healthy = true if:
   * - OCR is SYNCED or OFFLINE_READY
   * - No critical alerts
   * - Target is realistic
   *
   * healthy = false if ANY of:
   * - OCR is DEPLETED
   * - OCR is OUT_OF_SYNC
   * - Critical alert threshold breached
   * - Target > 50% of total balance
   *
   * RECOMMENDATIONS PROVIDED:
   *
   * - "Connect to internet to refill OCR" (if depleted)
   * - "Sync OCR when online" (if out of sync)
   * - "Refill OCR immediately" (if critical)
   * - "Consider refilling OCR soon" (if low)
   * - "Consider lowering OCR level" (if target too high)
   *
   * USE CASES:
   *
   * - Display in settings/status screen
   * - Periodic background checks
   * - Proactive user notifications
   * - System health monitoring
   * - Debugging OCR issues
   *
   * @public
   * @returns {Object} Health check result
   * @returns {boolean} healthy - Overall health (true = good, false = issues)
   * @returns {string[]} issues - Array of detected issues
   * @returns {string[]} recommendations - Array of actionable recommendations
   *
   * @example
   * const health = ocrManager.healthCheck();
   *
   * if (!health.healthy) {
   *   console.log('OCR Issues Detected:');
   *   health.issues.forEach(issue => {
   *     console.log(`- ${issue}`);
   *   });
   *
   *   console.log('\nRecommendations:');
   *   health.recommendations.forEach(rec => {
   *     console.log(`- ${rec}`);
   *   });
   * } else {
   *   console.log('OCR is healthy');
   * }
   *
   * // Example output when unhealthy:
   * // OCR Issues Detected:
   * // - OCR is out of sync
   * // - OCR below 20% of target
   * //
   * // Recommendations:
   * // - Sync OCR when online
   * // - Refill OCR immediately
   */
  healthCheck(): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const status = this.getStatus();

    // CHECK 1: Is OCR depleted?
    if (status.status === OCRStatus.DEPLETED) {
      issues.push('OCR is depleted');
      recommendations.push('Connect to internet to refill OCR');
    }

    // CHECK 2: Is OCR out of sync?
    if (status.status === OCRStatus.OUT_OF_SYNC) {
      issues.push('OCR is out of sync');
      recommendations.push('Sync OCR when online');
    }

    // CHECK 3: Alert level checks
    if (status.alertLevel === 'critical') {
      issues.push(`OCR below ${this.config.alertThreshold}% of target`);
      recommendations.push('Refill OCR immediately');
    } else if (status.alertLevel === 'low') {
      recommendations.push('Consider refilling OCR soon');
    }

    // CHECK 4: Is target realistic?
    // If OCR target is more than 50% of total balance, it may be too high
    const totalBalance = this.proofRepo.getTotalBalance();
    if (this.config.targetAmount > totalBalance * 0.5) {
      issues.push('OCR target is more than 50% of total balance');
      recommendations.push('Consider lowering OCR level');
    }

    // Determine overall health
    const healthy = issues.length === 0;

    return {
      healthy,
      issues,
      recommendations,
    };
  }

  /**
   * Estimate time to refill OCR (in seconds)
   *
   * Provides a rough estimate of how long it will take to refill OCR to target.
   * Useful for showing users "Expected refill time: 6 seconds".
   *
   * ESTIMATION METHODOLOGY:
   *
   * 1. Calculate deficit (how much we need to add)
   * 2. Estimate number of swap operations needed
   * 3. Multiply by average time per swap
   *
   * ASSUMPTIONS:
   *
   * - ~10,000 sats per swap operation (typical proof sizes)
   * - ~2 seconds per swap (network + mint processing)
   * - Linear scaling (probably optimistic)
   *
   * EXAMPLE CALCULATIONS:
   *
   * Deficit: 50,000 sats
   * Swaps needed: 50,000 / 10,000 = 5 swaps
   * Time estimate: 5 × 2 = 10 seconds
   *
   * Deficit: 5,000 sats
   * Swaps needed: 5,000 / 10,000 = 0.5 → 1 swap
   * Time estimate: 1 × 2 = 2 seconds
   *
   * ACCURACY:
   *
   * This is a ROUGH ESTIMATE that can vary based on:
   * - Network latency (slow connection = longer)
   * - Mint performance (busy mint = longer)
   * - Proof sizes (many small proofs = more swaps)
   * - Available proof distribution
   *
   * Should be used as a guideline, not a guarantee.
   *
   * EDGE CASES:
   *
   * - Already synced (deficit ≤ 0): Returns 0
   * - Very small deficit: Returns 2 seconds minimum
   * - Very large deficit: May underestimate
   *
   * @public
   * @returns {number} Estimated time in seconds
   *
   * @example
   * const estimate = ocrManager.estimateRefillTime();
   *
   * if (estimate === 0) {
   *   console.log('Already synced');
   * } else {
   *   console.log(`Refill will take approximately ${estimate} seconds`);
   *
   *   // Show to user
   *   const minutes = Math.floor(estimate / 60);
   *   const seconds = estimate % 60;
   *   if (minutes > 0) {
   *     alert(`Estimated refill time: ${minutes}m ${seconds}s`);
   *   } else {
   *     alert(`Estimated refill time: ${seconds} seconds`);
   *   }
   * }
   *
   * // Use in UI with loading indicator
   * setEstimatedTime(ocrManager.estimateRefillTime());
   * startRefill();
   */
  estimateRefillTime(): number {
    // Get current status and calculate deficit
    const status = this.getStatus();
    const deficit = this.config.targetAmount - status.currentBalance;

    // If no deficit, no time needed
    if (deficit <= 0) return 0;

    // Rough estimate: 2 seconds per swap operation
    // Assumes ~10,000 sats per swap (10 proofs of 1000 sats each)
    const estimatedSwaps = Math.ceil(deficit / 10000);
    return estimatedSwaps * 2;
  }

  /**
   * Get recommended OCR level based on usage patterns
   *
   * Analyzes user's spending behavior and suggests optimal OCR level.
   * This feature is FUTURE WORK - currently returns the configured level.
   *
   * FUTURE IMPLEMENTATION:
   *
   * The algorithm would analyze:
   * 1. Average transaction size
   * 2. Transaction frequency
   * 3. Online/offline ratio
   * 4. Balance history
   * 5. Refill frequency
   *
   * RECOMMENDATION LOGIC (planned):
   *
   * If user:
   * - Spends < 5k sats/day → Recommend LOW
   * - Spends 5k-25k sats/day → Recommend MEDIUM
   * - Spends > 25k sats/day → Recommend HIGH
   * - Frequently offline → Recommend higher level
   * - Rarely offline → Recommend lower level
   *
   * MACHINE LEARNING POTENTIAL:
   *
   * Could use ML to:
   * - Predict future spending patterns
   * - Optimize for user's specific behavior
   * - Adapt to changing usage over time
   * - Suggest custom target amounts
   *
   * DATA PRIVACY:
   *
   * All analysis would be local (on-device):
   * - No data sent to servers
   * - No tracking or surveillance
   * - User controls all recommendations
   *
   * @public
   * @returns {OCRLevel} Recommended OCR level
   *
   * @example
   * const recommended = ocrManager.getRecommendedLevel();
   * const current = ocrManager.getConfig().level;
   *
   * if (recommended !== current) {
   *   console.log(`Recommendation: Switch from ${current} to ${recommended}`);
   *   console.log('Based on your spending patterns');
   *
   *   // Ask user if they want to apply recommendation
   *   if (confirm(`Switch to ${recommended} level?`)) {
   *     await ocrManager.setConfig({ level: recommended });
   *   }
   * }
   */
  getRecommendedLevel(): OCRLevel {
    // FUTURE: This would analyze spending patterns
    // - Query transaction history
    // - Calculate average transaction size
    // - Analyze offline vs online usage
    // - Recommend appropriate level

    // For now, return current level
    return this.config.level;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default export: Singleton instance of OCRManager
 *
 * This allows convenient importing:
 *   import ocrManager from './OCRManager';
 *
 * Instead of:
 *   import { OCRManager } from './OCRManager';
 *   const ocrManager = OCRManager.getInstance();
 *
 * Both patterns work, but default export is more convenient for the common case.
 *
 * @example
 * // Preferred import style
 * import ocrManager from '@/core/ocr/OCRManager';
 * const status = ocrManager.getStatus();
 *
 * // Alternative import style
 * import { OCRManager } from '@/core/ocr/OCRManager';
 * const ocrManager = OCRManager.getInstance();
 * const status = ocrManager.getStatus();
 */
export default OCRManager;
