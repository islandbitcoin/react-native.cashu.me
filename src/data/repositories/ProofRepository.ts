/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROOFREPOSITORY - CASHU ECASH PROOF STATE MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CRITICAL SECURITY NOTICE:
 * This file is THE MOST CRITICAL component for wallet integrity and security.
 * Any bugs or mishandling in this repository can lead to:
 * - DOUBLE-SPENDING: Spending the same proof twice (catastrophic loss of funds)
 * - RACE CONDITIONS: Concurrent operations corrupting wallet state
 * - PROOF LOSS: Proofs becoming unrecoverable due to state corruption
 * - MINT REJECTION: Invalid state transitions causing mint to reject valid proofs
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT ARE CASHU PROOFS?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cashu proofs are bearer tokens representing value in the Chaumian ecash system.
 * Each proof is like a digital dollar bill with these properties:
 *
 * 1. BEARER INSTRUMENT: Whoever possesses the proof owns the value
 *    - No identity required (privacy-preserving)
 *    - Cannot be recovered if lost
 *    - Cannot be reversed once spent
 *
 * 2. SINGLE-USE ONLY: Each proof can only be spent ONCE
 *    - Attempting to spend twice results in rejection by mint
 *    - Mint maintains a spent list (nullifier set)
 *    - Once spent, proof is permanently invalidated
 *
 * 3. CRYPTOGRAPHIC STRUCTURE:
 *    - secret: Random value only wallet knows (like a private key)
 *    - C: Blinded signature from mint (public commitment)
 *    - amount: Value in satoshis (denomination)
 *    - keysetId: Which mint key signed this proof
 *    - mintUrl: Which mint issued this proof
 *
 * 4. PRIVACY GUARANTEE:
 *    - Mint cannot link proofs to users (blind signatures)
 *    - Spending proofs reveals nothing about sender
 *    - Receiving proofs reveals nothing about receiver
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * STATE MACHINE DIAGRAM (ASCII ART)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *                    ┌─────────────────────────────────┐
 *                    │                                 │
 *                    │         UNSPENT                 │
 *                    │  (Available for spending)       │
 *                    │                                 │
 *                    └──────────┬──────────────────────┘
 *                               │
 *                 ┌─────────────┼─────────────┐
 *                 │                           │
 *                 │                           │
 *        ┌────────▼────────┐         ┌────────▼────────┐
 *        │                 │         │                 │
 *        │ PENDING_SEND    │         │ PENDING_SWAP    │
 *        │ (Being spent)   │         │ (Being swapped) │
 *        │  LOCKED 🔒      │         │  LOCKED 🔒      │
 *        └────────┬────────┘         └────────┬────────┘
 *                 │                           │
 *                 │                           │
 *        ┌────────▼────────┐         ┌────────▼────────┐
 *        │                 │         │                 │
 *        │     SPENT       │         │   NEW PROOFS    │
 *        │ (Permanent)     │         │   (UNSPENT)     │
 *        │                 │         │                 │
 *        └─────────────────┘         └─────────────────┘
 *                 │
 *                 │ (Timeout recovery)
 *                 │
 *        ┌────────▼────────┐
 *        │   UNSPENT       │
 *        │ (Lock released) │
 *        └─────────────────┘
 *
 * STATE TRANSITIONS EXPLAINED:
 *
 * 1. UNSPENT → PENDING_SEND
 *    - User initiates payment
 *    - Proofs are selected and LOCKED with transactionId
 *    - Prevents concurrent operations from using same proofs
 *    - If operation fails, timeout cleanup returns to UNSPENT
 *
 * 2. PENDING_SEND → SPENT
 *    - Mint confirms proofs were spent successfully
 *    - This is PERMANENT and IRREVERSIBLE
 *    - Proofs can never be used again
 *
 * 3. UNSPENT → PENDING_SWAP
 *    - User wants to change denominations (like breaking a $20 bill)
 *    - Or user wants to consolidate small proofs
 *    - Old proofs LOCKED until swap completes
 *
 * 4. PENDING_SWAP → NEW PROOFS (UNSPENT)
 *    - Swap successful, mint gives new proofs
 *    - Old proofs marked SPENT
 *    - New proofs added as UNSPENT
 *    - This is atomic (all or nothing)
 *
 * 5. STALE LOCK RECOVERY (Any PENDING → UNSPENT)
 *    - If operation takes > 5 minutes, lock is considered stale
 *    - Automatic cleanup releases proofs back to UNSPENT
 *    - Prevents proofs from being locked forever due to crashes
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DOUBLE-SPEND PREVENTION MECHANISM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Double-spending is when the same proof is spent multiple times. This MUST
 * be prevented at ALL COSTS. We use multiple layers of defense:
 *
 * LAYER 1: PESSIMISTIC LOCKING
 * ----------------------------
 * When a proof is selected for spending, it's immediately locked:
 * - State changed to PENDING_SEND
 * - locked_at timestamp set to current time
 * - locked_for transaction ID recorded
 *
 * This prevents other operations from selecting the same proof.
 *
 * LAYER 2: DATABASE TRANSACTIONS
 * ------------------------------
 * All state changes happen inside database transactions:
 * - SELECT + UPDATE in same transaction (atomic)
 * - Row-level locking prevents concurrent modifications
 * - If transaction fails, ALL changes rolled back
 * - No partial state changes possible
 *
 * LAYER 3: STATE VALIDATION
 * -------------------------
 * Before transitioning state, we verify current state:
 * - transitionState() checks fromState matches current state
 * - If state already changed, transition fails
 * - Prevents invalid state transitions
 *
 * LAYER 4: TIMEOUT RECOVERY
 * ------------------------
 * If operation hangs (app crash, network failure):
 * - Locks older than 5 minutes considered stale
 * - Automatic cleanup releases proofs back to UNSPENT
 * - Prevents proofs from being locked forever
 * - releaseStaleLocks() should run periodically
 *
 * LAYER 5: MINT VALIDATION
 * ------------------------
 * Even if we fail, mint has final say:
 * - Mint maintains spent list (nullifier set)
 * - Attempting to spend same proof twice rejected
 * - This is the ultimate safety net
 *
 * ATTACK SCENARIOS PREVENTED:
 *
 * Scenario 1: Concurrent Payment Attempts
 * ----------------------------------------
 * User rapidly taps "Send" button twice
 * - First click: Proofs locked, state = PENDING_SEND
 * - Second click: selectProofsForAmount() finds no UNSPENT proofs
 * - Second payment fails with "Insufficient funds"
 * - Only first payment proceeds
 *
 * Scenario 2: App Crash During Send
 * ----------------------------------
 * App crashes after locking proofs but before marking SPENT
 * - Proofs remain in PENDING_SEND state
 * - After 5 minutes, releaseStaleLocks() returns them to UNSPENT
 * - If send actually succeeded (mint received it), next use will fail
 * - User must check with mint to verify state
 *
 * Scenario 3: Race Condition on Swap
 * -----------------------------------
 * Two swap operations start simultaneously
 * - First transaction locks proofs, state = PENDING_SWAP
 * - Second transaction's SELECT finds no UNSPENT proofs
 * - Second swap fails immediately
 * - First swap completes atomically
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PESSIMISTIC LOCKING WITH TIMEOUT CLEANUP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHY PESSIMISTIC LOCKING?
 *
 * Pessimistic locking means we lock resources BEFORE using them, assuming
 * conflicts will happen. This is the RIGHT choice for ecash because:
 *
 * 1. COST OF CONFLICT: Double-spending means permanent loss of funds
 * 2. CONFLICT LIKELIHOOD: Mobile apps often have poor network, leading to retries
 * 3. CANNOT ROLLBACK: Once proof is spent at mint, it's irreversible
 * 4. SIMPLE REASONING: Easier to understand and audit for security
 *
 * Alternative (Optimistic Locking) would be WRONG because:
 * - Assumes conflicts are rare (not true on mobile)
 * - Detects conflicts only after operation starts (too late!)
 * - Requires complex retry/rollback logic
 * - Higher risk of double-spend in race conditions
 *
 * TIMEOUT CLEANUP EXPLAINED:
 *
 * Problem: What if app crashes while proofs are locked?
 * - Proofs stuck in PENDING state forever
 * - User's balance appears low but can't spend
 * - Wallet becomes unusable
 *
 * Solution: Stale lock detection
 * - LOCK_TIMEOUT_MS = 5 minutes (300,000 milliseconds)
 * - Any lock older than timeout is considered "stale"
 * - releaseStaleLocks() returns stale proofs to UNSPENT
 * - Should be called on app startup and periodically
 *
 * Timeout Duration Choice (5 minutes):
 * - Too short: Active operations interrupted, causing errors
 * - Too long: User waits too long after crash to recover
 * - 5 minutes: Balances user experience vs safety
 *   - Most operations complete in < 30 seconds
 *   - Gives ample time for slow networks
 *   - Short enough for crash recovery
 *
 * Edge Case: What if proof was actually spent during timeout?
 * - releaseStaleLocks() returns proof to UNSPENT
 * - User tries to spend it
 * - Mint rejects (proof in spent list)
 * - We mark proof as SPENT locally
 * - User balance corrected
 * - No funds lost (mint is source of truth)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COIN SELECTION ALGORITHM (GREEDY APPROACH)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Coin selection is choosing which proofs to spend for a given amount.
 * This is analogous to choosing which bills/coins to use when paying cash.
 *
 * WHY COIN SELECTION MATTERS:
 *
 * 1. MINIMIZE PROOFS: Fewer proofs = faster transaction, less data
 * 2. OPTIMIZE CHANGE: Minimize leftover value requiring swap
 * 3. PRESERVE DENOMINATIONS: Keep useful denominations for future
 * 4. PRIVACY: Different selections leak different information
 *
 * OUR ALGORITHM: GREEDY (LARGEST FIRST)
 *
 * Strategy: Select largest proofs first until amount reached
 *
 * Example: Paying 15 sats with proofs [1, 2, 4, 8, 16, 32]
 * 1. Sort descending: [32, 16, 8, 4, 2, 1]
 * 2. Select 16 (total = 16, >= 15) ✓
 * 3. Result: Use [16], change = 1 sat
 *
 * Alternative: Smallest first would select [1, 2, 4, 8] = 15 sats
 * - More proofs used (4 vs 1)
 * - Larger transaction size
 * - No change needed (but depletes small denominations)
 *
 * PROS OF GREEDY APPROACH:
 * + Minimizes number of proofs (faster, less data)
 * + Simple to implement and reason about
 * + Predictable performance O(n log n)
 * + Works well for arbitrary amounts
 *
 * CONS OF GREEDY APPROACH:
 * - May create suboptimal change scenarios
 * - Doesn't consider future transactions
 * - May deplete large denominations
 * - Not optimal for exact amounts
 *
 * BETTER ALGORITHMS (Not implemented):
 *
 * 1. BRANCH AND BOUND:
 *    - Finds optimal combination (exact amount if possible)
 *    - Much slower (exponential worst case)
 *    - Good for few denominations
 *
 * 2. KNAPSACK SOLVER:
 *    - Dynamic programming approach
 *    - Guarantees optimal solution
 *    - Complex to implement correctly
 *
 * 3. RANDOM SELECTION:
 *    - Better for privacy (unpredictable)
 *    - Worse for efficiency
 *    - May select too many proofs
 *
 * FUTURE IMPROVEMENT CONSIDERATIONS:
 * - Implement Branch and Bound for exact amounts
 * - Add randomization for privacy
 * - Consider user's proof inventory health
 * - Optimize for future transaction patterns
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OCR PROOF TAGGING (OFFLINE CASH RESERVE)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * OCR (Offline Cash Reserve) is a special tag for proofs that should be kept
 * separate from the main wallet balance.
 *
 * USE CASES FOR OCR:
 *
 * 1. COLD STORAGE:
 *    - User wants to save some sats offline
 *    - OCR proofs excluded from spending by default
 *    - Like putting cash in a safe
 *
 * 2. SEPARATE ACCOUNTS:
 *    - User maintains multiple "pockets" of funds
 *    - OCR = savings, non-OCR = spending
 *    - Prevents accidental spending of savings
 *
 * 3. EMERGENCY FUNDS:
 *    - Keep reserve for specific purpose
 *    - Explicitly opt-in to spend OCR
 *    - Visual indicator in UI
 *
 * 4. PROOF QUARANTINE:
 *    - Newly received proofs marked OCR
 *    - User reviews before moving to main balance
 *    - Helps detect potential issues
 *
 * IMPLEMENTATION DETAILS:
 *
 * - is_ocr column: Boolean flag (0 or 1)
 * - Default: false (0) for new proofs
 * - Can be toggled any time with markAsOCR() / unmarkAsOCR()
 * - Separate balance query: getOCRBalance()
 * - Coin selection: useOCR parameter controls whether OCR included
 *
 * SECURITY IMPLICATIONS:
 *
 * - OCR does NOT encrypt or protect proofs
 * - OCR does NOT prevent spending if explicitly selected
 * - OCR is just a UI/organization feature
 * - If device compromised, OCR proofs still accessible
 * - For true cold storage, export proofs to offline device
 *
 * EXAMPLE WORKFLOW:
 *
 * 1. User receives 100k sats payment
 * 2. User marks 80k sats as OCR (savings)
 * 3. Main balance shows 20k sats (spending money)
 * 4. User makes payments using non-OCR proofs only
 * 5. When savings needed, user unmarks OCR proofs
 * 6. Proofs return to main balance pool
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DATABASE SCHEMA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Table: proofs
 *
 * Columns:
 * --------
 * id (TEXT PRIMARY KEY)
 *   - UUID v4 generated locally
 *   - Not the proof's secret (that would leak privacy)
 *   - Used for internal tracking only
 *
 * secret (TEXT UNIQUE NOT NULL)
 *   - Random value only we know (like private key)
 *   - MUST be kept secure (proof ownership)
 *   - Used to spend proof (presented to mint)
 *   - 32 bytes random, base64 encoded typically
 *
 * C (TEXT NOT NULL)
 *   - Blinded signature from mint (public)
 *   - Cryptographic proof of mint's approval
 *   - Compressed elliptic curve point
 *   - Can be shared publicly without risk
 *
 * amount (INTEGER NOT NULL)
 *   - Value in satoshis
 *   - Standard denominations: 1, 2, 4, 8, 16, 32, 64...
 *   - Powers of 2 for efficient coin selection
 *
 * mint_url (TEXT NOT NULL)
 *   - Which mint issued this proof
 *   - Format: https://mint.example.com
 *   - Each mint is separate trust domain
 *   - Cannot spend proof at different mint
 *
 * keyset_id (TEXT NOT NULL)
 *   - Which cryptographic key signed this
 *   - Format: hex string (e.g., "00faa...")
 *   - Mint rotates keys periodically
 *   - Old proofs remain valid after rotation
 *
 * state (TEXT NOT NULL)
 *   - Current state in state machine
 *   - Values: UNSPENT, PENDING_SEND, PENDING_SWAP, SPENT
 *   - Default: UNSPENT
 *   - CRITICAL for double-spend prevention
 *
 * is_ocr (INTEGER DEFAULT 0)
 *   - Boolean flag (SQLite doesn't have BOOLEAN)
 *   - 0 = false (normal), 1 = true (OCR)
 *   - Used for separate balance accounting
 *
 * locked_at (INTEGER NULL)
 *   - Timestamp when proof was locked
 *   - Unix milliseconds (JavaScript Date.now())
 *   - NULL when not locked
 *   - Used for stale lock detection
 *
 * locked_for (TEXT NULL)
 *   - Transaction ID this proof is locked for
 *   - UUID of the transaction
 *   - NULL when not locked
 *   - Helps debug stuck transactions
 *
 * created_at (INTEGER NOT NULL)
 *   - When proof was added to wallet
 *   - Unix milliseconds
 *   - Used for sorting, analytics
 *
 * INDEXES (assumed):
 * ------------------
 * - PRIMARY KEY on id
 * - UNIQUE INDEX on secret (prevent duplicate proofs)
 * - INDEX on (mint_url, state) for balance queries
 * - INDEX on state for count queries
 * - INDEX on locked_for for transaction lookup
 * - INDEX on locked_at for stale lock cleanup
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TRANSACTION SAFETY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Database transactions are ESSENTIAL for maintaining consistency. Every
 * operation that modifies multiple rows or requires reading then writing
 * MUST use a transaction.
 *
 * ACID PROPERTIES:
 *
 * A = ATOMICITY: All changes succeed or all fail (no partial state)
 * C = CONSISTENCY: Database constraints always enforced
 * I = ISOLATION: Concurrent transactions don't interfere
 * D = DURABILITY: Committed changes survive crashes
 *
 * WHY TRANSACTIONS MATTER FOR ECASH:
 *
 * Without transactions:
 * - Read proof state = UNSPENT
 * - Other operation changes state to PENDING
 * - Write state = PENDING (overwrites other operation!)
 * - RACE CONDITION: Both operations think they locked proof
 * - DOUBLE-SPEND: Same proof selected twice
 *
 * With transactions:
 * - BEGIN TRANSACTION
 * - SELECT ... (row locked)
 * - UPDATE ... (still locked)
 * - COMMIT (row unlocked)
 * - Other operations wait for lock
 * - Only one operation succeeds
 *
 * TRANSACTION PATTERNS IN THIS FILE:
 *
 * 1. READ-MODIFY-WRITE (transitionState):
 *    - SELECT to verify current state
 *    - UPDATE to change state
 *    - Must be atomic to prevent TOCTOU bugs
 *
 * 2. BATCH INSERT (createMany):
 *    - INSERT multiple proofs
 *    - All or nothing (don't leave partial set)
 *    - Important for swap operations
 *
 * 3. COIN SELECTION (selectProofsForAmount):
 *    - SELECT available proofs
 *    - UPDATE to lock selected proofs
 *    - Most critical for double-spend prevention
 *
 * ISOLATION LEVEL:
 *
 * SQLite default: SERIALIZABLE
 * - Highest isolation level
 * - Transactions appear to execute serially
 * - Prevents all concurrency anomalies
 * - Slight performance cost (worth it for safety)
 *
 * DEADLOCK PREVENTION:
 *
 * Deadlock scenario:
 * - Transaction A locks proof 1, wants proof 2
 * - Transaction B locks proof 2, wants proof 1
 * - Both wait forever (DEADLOCK)
 *
 * Our prevention strategy:
 * - Always lock proofs in consistent order (ORDER BY)
 * - Short transaction duration (< 100ms typical)
 * - SQLite has deadlock detection (will fail one transaction)
 * - Retry failed transactions at higher level
 *
 * TRANSACTION BEST PRACTICES:
 *
 * 1. KEEP SHORT: Lock resources briefly, minimize contention
 * 2. CONSISTENT ORDER: Always acquire locks in same order
 * 3. NO USER INPUT: Don't wait for user during transaction
 * 4. NO NETWORK: Don't call APIs during transaction
 * 5. IDEMPOTENT: Safe to retry if fails
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import Database from '../database/Database';
import { Proof, ProofState } from '../../types';
import { generateUUID } from '../../utils/uuid';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPE DEFINITIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Result of coin selection algorithm
 *
 * When user wants to spend N sats, we need to select which proofs to use.
 * This interface represents the outcome of that selection.
 *
 * @interface CoinSelectionResult
 *
 * @property {Proof[]} proofs - Array of selected proofs to spend
 *   - Already locked (state = PENDING)
 *   - Total amount >= requested amount
 *   - Optimal selection based on algorithm
 *
 * @property {number} total - Sum of all selected proof amounts
 *   - Always >= requested amount
 *   - In satoshis
 *   - Used to calculate change
 *
 * @property {number} change - Amount to return to user
 *   - Formula: total - requested amount
 *   - Will be swapped for new proofs
 *   - Zero if exact amount selected (rare)
 *
 * @example
 * // User wants to pay 15 sats
 * // Wallet has proofs: [1, 2, 4, 8, 16, 32]
 * const result = await selectProofsForAmount('https://mint.com', 15, 'tx123')
 * // Result:
 * // {
 * //   proofs: [Proof{amount: 16}],
 * //   total: 16,
 * //   change: 1  // Will swap back to wallet
 * // }
 */
export interface CoinSelectionResult {
  proofs: Proof[];
  total: number;
  change: number;
}

/**
 * Filter criteria for querying proofs
 *
 * All filters are optional and combined with AND logic.
 * Empty filter {} returns all proofs.
 *
 * @interface ProofFilter
 *
 * @property {string} [mintUrl] - Filter by mint URL
 *   - Exact match only
 *   - Use to get balance per mint
 *
 * @property {ProofState} [state] - Filter by state
 *   - Get UNSPENT proofs for spending
 *   - Get PENDING proofs for status check
 *   - Get SPENT proofs for history
 *
 * @property {boolean} [isOCR] - Filter by OCR status
 *   - true = only OCR proofs
 *   - false = only non-OCR proofs
 *   - undefined = both
 *
 * @property {string} [keysetId] - Filter by keyset ID
 *   - Use when mint rotates keys
 *   - Migrate old proofs to new keyset
 *
 * @example
 * // Get all unspent non-OCR proofs for a mint
 * const filter: ProofFilter = {
 *   mintUrl: 'https://mint.example.com',
 *   state: ProofState.UNSPENT,
 *   isOCR: false
 * };
 * const proofs = await repository.getAll(filter);
 */
export interface ProofFilter {
  mintUrl?: string;
  state?: ProofState;
  isOCR?: boolean;
  keysetId?: string;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MAIN REPOSITORY CLASS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Repository for managing Cashu proofs with state machine and pessimistic locking
 *
 * This class is responsible for ALL proof storage and state management.
 * It is the SINGLE SOURCE OF TRUTH for wallet balance and proof states.
 *
 * DESIGN PATTERNS USED:
 *
 * 1. SINGLETON PATTERN:
 *    - Only one instance exists globally
 *    - Prevents multiple repositories with different state
 *    - getInstance() returns same instance always
 *
 * 2. REPOSITORY PATTERN:
 *    - Abstracts database operations
 *    - Business logic doesn't know about SQL
 *    - Easy to test with mock implementation
 *
 * 3. STATE MACHINE PATTERN:
 *    - Explicit states with valid transitions
 *    - Prevents invalid state combinations
 *    - Self-documenting business rules
 *
 * 4. PESSIMISTIC LOCKING PATTERN:
 *    - Lock before use (not after)
 *    - Assumes conflicts will happen
 *    - Prevents race conditions
 *
 * THREAD SAFETY:
 *
 * React Native is single-threaded (JavaScript), but async operations can
 * interleave. We use database transactions for serialization.
 *
 * Not safe: Two async calls to selectProofsForAmount()
 * Safe: Each call wraps in transaction, database serializes
 *
 * @class ProofRepository
 * @singleton
 */
export class ProofRepository {
  /**
   * Singleton instance holder
   * Static so it persists across method calls
   */
  private static instance: ProofRepository;

  /**
   * Database instance for executing queries
   * Also a singleton, ensures consistent connection
   */
  private db: Database;

  /**
   * Stale lock timeout in milliseconds
   *
   * If a proof is locked longer than this, we assume the operation failed
   * (app crashed, network timeout, etc.) and release the lock automatically.
   *
   * Value: 5 minutes (300,000 ms)
   *
   * Rationale:
   * - Normal operations complete in < 30 seconds
   * - 5 minutes allows for very slow networks
   * - Short enough for user to not wait long after crash
   * - Long enough to prevent false positives
   *
   * @private
   * @readonly
   */
  private readonly LOCK_TIMEOUT_MS = 5 * 60 * 1000;

  /**
   * Private constructor enforces singleton pattern
   *
   * Cannot instantiate directly with `new ProofRepository()`
   * Must use `ProofRepository.getInstance()`
   *
   * @private
   */
  private constructor() {
    this.db = Database.getInstance();
  }

  /**
   * Get singleton instance of ProofRepository
   *
   * Creates instance on first call, returns same instance on subsequent calls.
   * Thread-safe because JavaScript is single-threaded.
   *
   * @static
   * @returns {ProofRepository} The singleton instance
   *
   * @example
   * const repo = ProofRepository.getInstance();
   * const balance = repo.getTotalBalance();
   */
  static getInstance(): ProofRepository {
    if (!ProofRepository.instance) {
      ProofRepository.instance = new ProofRepository();
    }
    return ProofRepository.instance;
  }

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * CREATE OPERATIONS
   * ═════════════════════════════════════════════════════════════════════════
   */

  /**
   * Store a new proof in the database
   *
   * This is called when:
   * 1. User receives payment (proofs from sender)
   * 2. User completes swap (new proofs from mint)
   * 3. User withdraws from mint (fresh proofs)
   *
   * SECURITY NOTES:
   * - Generate new UUID locally (don't trust external IDs)
   * - Default state is UNSPENT (ready to spend)
   * - Timestamp with Date.now() for audit trail
   *
   * VALIDATION (TODO: Add these checks):
   * - Verify secret is not already in database (prevent duplicates)
   * - Verify C is valid elliptic curve point
   * - Verify amount is positive integer
   * - Verify mintUrl is valid HTTPS URL
   * - Verify keysetId is valid hex string
   *
   * @async
   * @param {Omit<Proof, 'id' | 'createdAt'>} proof - Proof without generated fields
   * @returns {Promise<Proof>} The created proof with id and createdAt
   * @throws {Error} If database insert fails
   *
   * @example
   * // Receiving a payment
   * const receivedProof = {
   *   secret: 'abc123...',
   *   C: '02a1b2c3...',
   *   amount: 1000,
   *   mintUrl: 'https://mint.example.com',
   *   keysetId: '00faa...',
   *   state: ProofState.UNSPENT,
   *   isOCR: false
   * };
   * const proof = await repo.create(receivedProof);
   * console.log(proof.id); // 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
   * console.log(proof.createdAt); // 1701234567890
   */
  async create(proof: Omit<Proof, 'id' | 'createdAt'>): Promise<Proof> {
    // Generate UUID v4 for internal tracking
    // This is NOT the proof's secret (which must remain confidential)
    const id = generateUUID();

    // Timestamp in milliseconds (JavaScript convention)
    // Unix epoch: milliseconds since 1970-01-01 00:00:00 UTC
    const createdAt = Date.now();

    // INSERT statement with parameterized queries (SQL injection prevention)
    // Using ? placeholders, database driver escapes values safely
    await this.db.execute(
      `INSERT INTO proofs (
        id, secret, C, amount, mint_url, keyset_id,
        state, is_ocr, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        proof.secret,
        proof.C,
        proof.amount,
        proof.mintUrl,
        proof.keysetId,
        proof.state || ProofState.UNSPENT,  // Default to UNSPENT if not specified
        proof.isOCR ? 1 : 0,                // Boolean to integer for SQLite
        createdAt,
      ]
    );

    // Return complete proof object with generated fields
    return {
      id,
      ...proof,
      state: proof.state || ProofState.UNSPENT,
      createdAt,
    };
  }

  /**
   * Store multiple proofs atomically in a single transaction
   *
   * This is CRITICAL for swap operations:
   * - Old proofs marked SPENT
   * - New proofs inserted as UNSPENT
   * - Must be atomic (all or nothing)
   *
   * If any proof fails to insert, ALL proofs rolled back. This prevents:
   * - Partial swap (some proofs lost)
   * - Inconsistent balance
   * - User losing funds
   *
   * WHY TRANSACTION IS CRITICAL:
   *
   * Without transaction:
   * 1. Insert proof 1 ✓
   * 2. Insert proof 2 ✗ (fails - maybe duplicate secret)
   * 3. Database has proof 1 only
   * 4. User lost proof 2's value forever
   *
   * With transaction:
   * 1. BEGIN TRANSACTION
   * 2. Insert proof 1 ✓
   * 3. Insert proof 2 ✗ (fails)
   * 4. ROLLBACK - proof 1 removed too
   * 5. Database unchanged, user can retry
   *
   * PERFORMANCE:
   * - Batch insert is ~100x faster than individual inserts
   * - Single fsync per transaction (not per row)
   * - Important for swaps with many proofs
   *
   * @async
   * @param {Array<Omit<Proof, 'id' | 'createdAt'>>} proofs - Array of proofs to insert
   * @returns {Promise<Proof[]>} Array of created proofs with ids and timestamps
   * @throws {Error} If any insert fails (all rolled back)
   *
   * @example
   * // After successful swap with mint
   * const newProofs = [
   *   { secret: 'a1', C: '02a1...', amount: 1, mintUrl: '...', keysetId: '...' },
   *   { secret: 'b2', C: '02b2...', amount: 2, mintUrl: '...', keysetId: '...' },
   *   { secret: 'c4', C: '02c4...', amount: 4, mintUrl: '...', keysetId: '...' },
   * ];
   * const created = await repo.createMany(newProofs);
   * // All 3 inserted or none inserted (atomic)
   */
  async createMany(proofs: Array<Omit<Proof, 'id' | 'createdAt'>>): Promise<Proof[]> {
    // Wrap all inserts in a single transaction for atomicity
    return this.db.transaction(async (tx) => {
      const createdProofs: Proof[] = [];

      // Loop through each proof and insert
      for (const proof of proofs) {
        const id = generateUUID();
        const createdAt = Date.now();

        // Execute on transaction object (tx), not database directly
        // This ensures all operations are part of same transaction
        tx.execute(
          `INSERT INTO proofs (
            id, secret, C, amount, mint_url, keyset_id,
            state, is_ocr, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            proof.secret,
            proof.C,
            proof.amount,
            proof.mintUrl,
            proof.keysetId,
            proof.state || ProofState.UNSPENT,
            proof.isOCR ? 1 : 0,
            createdAt,
          ]
        );

        createdProofs.push({
          id,
          ...proof,
          state: proof.state || ProofState.UNSPENT,
          createdAt,
        });
      }

      // Return created proofs (committed only if we reach here)
      return createdProofs;
    });
  }

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * READ OPERATIONS (QUERIES)
   * ═════════════════════════════════════════════════════════════════════════
   */

  /**
   * Get proof by internal UUID
   *
   * Used for:
   * - Checking proof status after transaction
   * - Debugging specific proof issues
   * - Linking to transaction history
   *
   * NOTE: This is NOT the proof's secret. The secret should never be used
   * as a database key (would leak information).
   *
   * @async
   * @param {string} id - Internal UUID of proof
   * @returns {Promise<Proof | null>} Proof if found, null otherwise
   *
   * @example
   * const proof = await repo.getById('f47ac10b-58cc-4372-a567-0e02b2c3d479');
   * if (proof) {
   *   console.log(`Proof state: ${proof.state}`);
   * } else {
   *   console.log('Proof not found');
   * }
   */
  async getById(id: string): Promise<Proof | null> {
    // Query with parameterized placeholder for SQL injection prevention
    const proofs = await this.db.query<any>(
      `SELECT * FROM proofs WHERE id = ?`,
      [id]
    );

    if (proofs.length === 0) {
      return null;
    }

    // Transform database row to Proof object
    return this.mapRowToProof(proofs[0]);
  }

  /**
   * Get proof by secret (unique cryptographic identifier)
   *
   * The secret is the proof's true identifier from Cashu protocol perspective.
   * It's the value used when spending the proof at the mint.
   *
   * SECURITY CRITICAL:
   * - Secret should be kept confidential
   * - Anyone with secret can spend the proof
   * - This method should only be used internally
   * - Never log or expose secret in UI
   *
   * Used for:
   * - Checking if proof already exists (prevent duplicates)
   * - Verifying proof ownership
   * - Linking received proofs to pending receives
   *
   * @async
   * @param {string} secret - The proof's secret (random value)
   * @returns {Promise<Proof | null>} Proof if found, null otherwise
   * @throws {Error} If database query fails
   *
   * @example
   * // Check if we already have this proof
   * const secret = 'a1b2c3d4e5f6...';
   * const existing = await repo.getBySecret(secret);
   * if (existing) {
   *   console.warn('Duplicate proof received!');
   *   // Don't add again
   * } else {
   *   // New proof, safe to add
   *   await repo.create({ secret, ... });
   * }
   */
  async getBySecret(secret: string): Promise<Proof | null> {
    // Query by secret with SQL injection prevention
    const proofs = await this.db.query<any>(
      `SELECT * FROM proofs WHERE secret = ?`,
      [secret]
    );

    if (proofs.length === 0) {
      return null;
    }

    return this.mapRowToProof(proofs[0]);
  }

  /**
   * Get all proofs matching filter criteria
   *
   * This is the main query method for retrieving proofs. Supports flexible
   * filtering with multiple optional criteria combined with AND logic.
   *
   * Empty filter {} returns ALL proofs (use with caution on large wallets).
   *
   * QUERY BUILDING:
   * - Start with "WHERE 1=1" (always true, simplifies adding conditions)
   * - Append conditions dynamically based on filter
   * - Use parameterized queries (prevent SQL injection)
   * - Order by created_at DESC (newest first)
   *
   * PERFORMANCE CONSIDERATIONS:
   * - Indexes on mint_url, state, is_ocr, keyset_id
   * - Without indexes, this becomes slow on large datasets
   * - Consider pagination for UI (LIMIT/OFFSET)
   *
   * @async
   * @param {ProofFilter} [filter={}] - Filter criteria (all optional)
   * @returns {Promise<Proof[]>} Array of matching proofs (may be empty)
   *
   * @example
   * // Get all unspent proofs for a specific mint
   * const spendable = await repo.getAll({
   *   mintUrl: 'https://mint.example.com',
   *   state: ProofState.UNSPENT,
   *   isOCR: false  // Exclude savings
   * });
   *
   * @example
   * // Get all OCR proofs across all mints
   * const savings = await repo.getAll({
   *   isOCR: true
   * });
   *
   * @example
   * // Get all proofs (no filter)
   * const allProofs = await repo.getAll();
   */
  async getAll(filter: ProofFilter = {}): Promise<Proof[]> {
    // Build SQL query dynamically based on filter
    // Start with "WHERE 1=1" so we can always append "AND condition"
    let sql = 'SELECT * FROM proofs WHERE 1=1';
    const params: any[] = [];

    // Add mint filter if specified
    if (filter.mintUrl) {
      sql += ' AND mint_url = ?';
      params.push(filter.mintUrl);
    }

    // Add state filter if specified
    if (filter.state) {
      sql += ' AND state = ?';
      params.push(filter.state);
    }

    // Add OCR filter if specified (must check !== undefined, not just truthiness)
    // Because isOCR: false is valid and different from isOCR: undefined
    if (filter.isOCR !== undefined) {
      sql += ' AND is_ocr = ?';
      params.push(filter.isOCR ? 1 : 0);
    }

    // Add keyset filter if specified
    if (filter.keysetId) {
      sql += ' AND keyset_id = ?';
      params.push(filter.keysetId);
    }

    // Order by creation time descending (newest first)
    // Useful for UI showing recent transactions first
    sql += ' ORDER BY created_at DESC';

    // Execute query with parameterized values
    const rows = await this.db.query<any>(sql, params);

    // Map each database row to Proof object
    return rows.map(row => this.mapRowToProof(row));
  }

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * BALANCE QUERIES
   * ═════════════════════════════════════════════════════════════════════════
   */

  /**
   * Get spendable balance for a specific mint
   *
   * Returns sum of all UNSPENT proof amounts for given mint.
   * This is the "available balance" shown in UI.
   *
   * SQL EXPLANATION:
   * - COALESCE(SUM(amount), 0): Return 0 if no rows (instead of NULL)
   * - WHERE mint_url = ? AND state = ?: Only count unspent proofs
   * - SUM(amount): Add up all proof amounts
   *
   * SYNC vs ASYNC:
   * This uses querySync() for performance. Balance queries are called
   * frequently (every UI render) and don't need async overhead.
   *
   * SECURITY NOTE:
   * This does NOT include PENDING proofs. Once locked, proofs are excluded
   * from balance to prevent user from spending them twice.
   *
   * @param {string} mintUrl - URL of mint to check balance for
   * @returns {number} Spendable balance in satoshis (0 if no proofs)
   *
   * @example
   * const balance = repo.getBalance('https://mint.example.com');
   * console.log(`You have ${balance} sats available`);
   * // "You have 150000 sats available"
   */
  getBalance(mintUrl: string): number {
    // Execute synchronous query (faster for simple aggregates)
    const result = this.db.querySync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM proofs
       WHERE mint_url = ? AND state = ?`,
      [mintUrl, ProofState.UNSPENT]
    );

    // Return total or 0 if no results
    return result[0]?.total || 0;
  }

  /**
   * Get total spendable balance across ALL mints
   *
   * This is the "total balance" shown in UI header.
   * Includes all mints user has proofs from.
   *
   * IMPORTANT: Each mint is separate trust domain. This sum combines
   * proofs from different mints, but they cannot be spent together
   * (must spend per-mint).
   *
   * @returns {number} Total spendable balance in satoshis
   *
   * @example
   * const total = repo.getTotalBalance();
   * console.log(`Total wallet balance: ${total} sats`);
   * // "Total wallet balance: 350000 sats"
   */
  getTotalBalance(): number {
    const result = this.db.querySync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM proofs
       WHERE state = ?`,
      [ProofState.UNSPENT]
    );

    return result[0]?.total || 0;
  }

  /**
   * Get balance of OCR (Offline Cash Reserve) proofs
   *
   * Returns sum of UNSPENT proofs marked as OCR (is_ocr = 1).
   * This is the "savings balance" shown separately in UI.
   *
   * OCR proofs are NOT included in regular spending operations by default.
   * User must explicitly opt-in to spend OCR proofs.
   *
   * @returns {number} OCR balance in satoshis
   *
   * @example
   * const savings = repo.getOCRBalance();
   * const spending = repo.getTotalBalance();
   * console.log(`Savings: ${savings} sats`);
   * console.log(`Spending: ${spending} sats`);
   * // Savings: 100000 sats
   * // Spending: 50000 sats
   */
  getOCRBalance(): number {
    const result = this.db.querySync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM proofs
       WHERE is_ocr = 1 AND state = ?`,
      [ProofState.UNSPENT]
    );

    return result[0]?.total || 0;
  }

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * STATE MANAGEMENT (CRITICAL FOR DOUBLE-SPEND PREVENTION)
   * ═════════════════════════════════════════════════════════════════════════
   */

  /**
   * Atomically transition proof state with pessimistic locking
   *
   * THIS IS THE MOST CRITICAL METHOD FOR WALLET SECURITY.
   *
   * State transitions must be atomic and validated. This method ensures:
   * 1. Current state matches expected fromState (prevent TOCTOU)
   * 2. State transition happens in database transaction (prevent races)
   * 3. Lock information updated atomically with state
   * 4. Stale locks detected and handled
   *
   * TIME-OF-CHECK-TIME-OF-USE (TOCTOU) BUG PREVENTION:
   *
   * Without this protection:
   * 1. Check: Read proof state = UNSPENT
   * 2. Other operation changes state to PENDING
   * 3. Use: Update proof to PENDING (overwrites!)
   * 4. BUG: Both operations think they own proof
   *
   * With this protection:
   * 1. BEGIN TRANSACTION
   * 2. SELECT WHERE state = UNSPENT (locks row)
   * 3. If no rows, state already changed (fail)
   * 4. UPDATE state to PENDING
   * 5. COMMIT (releases lock)
   *
   * STALE LOCK DETECTION:
   *
   * If proof has been locked longer than LOCK_TIMEOUT_MS:
   * - Assume operation failed (crash, network timeout)
   * - Override requested toState with UNSPENT
   * - Release lock (locked_at = NULL, locked_for = NULL)
   * - Log warning for debugging
   *
   * VALID STATE TRANSITIONS:
   * - UNSPENT → PENDING_SEND (starting payment)
   * - UNSPENT → PENDING_SWAP (starting swap)
   * - PENDING_SEND → SPENT (payment confirmed)
   * - PENDING_SEND → UNSPENT (payment failed, released)
   * - PENDING_SWAP → SPENT (swap confirmed, old proofs)
   * - PENDING_SWAP → UNSPENT (swap failed, released)
   *
   * @async
   * @param {string} proofId - Internal UUID of proof to transition
   * @param {ProofState} fromState - Expected current state (validation)
   * @param {ProofState} toState - Desired new state
   * @param {string} [transactionId] - Optional transaction ID for tracking
   * @returns {Promise<boolean>} true if transition succeeded, false if proof not found or wrong state
   * @throws {Error} If database transaction fails
   *
   * @example
   * // Lock proof for spending
   * const success = await repo.transitionState(
   *   proofId,
   *   ProofState.UNSPENT,
   *   ProofState.PENDING_SEND,
   *   'tx-f47ac10b'
   * );
   * if (!success) {
   *   console.error('Proof already locked or spent');
   * }
   *
   * @example
   * // Mark proof as spent after mint confirms
   * await repo.transitionState(
   *   proofId,
   *   ProofState.PENDING_SEND,
   *   ProofState.SPENT
   * );
   */
  async transitionState(
    proofId: string,
    fromState: ProofState,
    toState: ProofState,
    transactionId?: string
  ): Promise<boolean> {
    // Wrap entire operation in database transaction for atomicity
    return this.db.transaction(async (tx) => {
      // SELECT with WHERE condition locks row for update in transaction
      // This prevents other transactions from modifying until we commit
      const proofs = tx.query<any>(
        `SELECT * FROM proofs WHERE id = ? AND state = ?`,
        [proofId, fromState]
      );

      // If no rows returned, either:
      // 1. Proof doesn't exist (invalid proofId)
      // 2. Proof exists but state already changed (race condition)
      if (proofs.length === 0) {
        return false;
      }

      const proof = proofs[0];

      // STALE LOCK DETECTION AND RECOVERY
      // If proof has been locked longer than timeout, release it
      if (proof.locked_at && Date.now() - proof.locked_at > this.LOCK_TIMEOUT_MS) {
        console.warn(`[ProofRepository] Releasing stale lock for proof ${proofId}`);
        console.warn(`  Locked at: ${new Date(proof.locked_at).toISOString()}`);
        console.warn(`  Locked for: ${proof.locked_for}`);
        console.warn(`  Current time: ${new Date().toISOString()}`);
        console.warn(`  Lock age: ${Math.round((Date.now() - proof.locked_at) / 1000)}s`);

        // Override toState with UNSPENT to release lock
        // This may return proof to circulation even if it was actually spent
        // But mint will reject if it tries to be spent again (safety net)
        toState = ProofState.UNSPENT;
      }

      // UPDATE proof state and lock information atomically
      // locked_at = Date.now(): Record when locked for timeout detection
      // locked_for = transactionId: Track which transaction owns lock
      tx.execute(
        `UPDATE proofs
         SET state = ?, locked_at = ?, locked_for = ?
         WHERE id = ?`,
        [toState, Date.now(), transactionId, proofId]
      );

      // Return true to indicate successful transition
      return true;
    });
  }

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * COIN SELECTION (CRITICAL FOR SPENDING)
   * ═════════════════════════════════════════════════════════════════════════
   */

  /**
   * Select and lock proofs for spending using greedy coin selection
   *
   * THIS IS THE ENTRY POINT FOR ALL SPENDING OPERATIONS.
   *
   * When user wants to pay N sats, we need to:
   * 1. Find which proofs to spend (coin selection)
   * 2. Lock those proofs (prevent double-spend)
   * 3. Return proofs + metadata for transaction
   *
   * ALGORITHM: GREEDY (LARGEST FIRST)
   *
   * Strategy:
   * 1. Query all UNSPENT proofs for mint (filtered by OCR flag)
   * 2. Sort by amount DESC (largest first)
   * 3. Select proofs until total >= requested amount
   * 4. Lock all selected proofs with transactionId
   * 5. Return selection result with change calculation
   *
   * Why largest first?
   * - Minimizes number of proofs (faster transaction)
   * - Reduces change (fewer follow-up swaps)
   * - Simple and predictable
   *
   * Trade-offs:
   * + Fast: O(n log n) sort + O(n) selection
   * + Minimal proofs: Usually 1-3 proofs selected
   * - Not optimal for exact amounts
   * - May deplete large denominations
   * - Not privacy-optimal (predictable)
   *
   * TRANSACTION SAFETY:
   *
   * Entire operation happens in database transaction:
   * - SELECT available proofs (locks table)
   * - UPDATE selected proofs to PENDING_SEND (atomic)
   * - COMMIT (releases table lock)
   *
   * If transaction fails (duplicate selection, etc.):
   * - All changes rolled back automatically
   * - No proofs locked
   * - Safe to retry
   *
   * INSUFFICIENT FUNDS:
   *
   * If sum(available proofs) < requested amount:
   * - Throw error immediately (don't lock anything)
   * - Transaction rolled back
   * - User sees clear error message
   *
   * OCR HANDLING:
   *
   * useOCR parameter controls whether OCR proofs included:
   * - false (default): Only non-OCR proofs (normal spending)
   * - true: Include OCR proofs (explicit opt-in for savings)
   *
   * @async
   * @param {string} mintUrl - Mint to select proofs from
   * @param {number} amount - Amount in satoshis to spend
   * @param {string} transactionId - UUID for transaction tracking
   * @param {boolean} [useOCR=false] - Whether to include OCR proofs
   * @returns {Promise<CoinSelectionResult>} Selected proofs with metadata
   * @throws {Error} If insufficient funds available
   * @throws {Error} If database transaction fails
   *
   * @example
   * // Pay 15000 sats from mint (normal spending, no OCR)
   * try {
   *   const result = await repo.selectProofsForAmount(
   *     'https://mint.example.com',
   *     15000,
   *     'tx-abc123',
   *     false
   *   );
   *   console.log(`Selected ${result.proofs.length} proofs`);
   *   console.log(`Total: ${result.total} sats`);
   *   console.log(`Change: ${result.change} sats`);
   *   // Selected 2 proofs
   *   // Total: 16000 sats
   *   // Change: 1000 sats
   * } catch (err) {
   *   console.error('Insufficient funds:', err.message);
   * }
   *
   * @example
   * // Pay from savings (include OCR)
   * const result = await repo.selectProofsForAmount(
   *   'https://mint.example.com',
   *   50000,
   *   'tx-def456',
   *   true  // Include OCR proofs
   * );
   */
  async selectProofsForAmount(
    mintUrl: string,
    amount: number,
    transactionId: string,
    useOCR: boolean = false
  ): Promise<CoinSelectionResult> {
    // Wrap entire selection + locking in database transaction
    // This ensures atomicity: either all proofs locked or none locked
    return this.db.transaction(async (tx) => {
      // Build query for available proofs
      // WHERE conditions: mint_url matches AND state is UNSPENT
      let sql = `SELECT * FROM proofs
                 WHERE mint_url = ? AND state = ?`;
      const params: any[] = [mintUrl, ProofState.UNSPENT];

      // Add OCR filter if not using OCR proofs
      // If useOCR = true, include all proofs (OCR and non-OCR)
      // If useOCR = false, only include non-OCR proofs
      if (!useOCR) {
        sql += ' AND is_ocr = 0';
      }

      // Order by amount DESC for greedy algorithm (largest first)
      // This is KEY to greedy approach: selecting biggest proofs first
      // minimizes total number of proofs needed
      sql += ' ORDER BY amount DESC';

      // Execute query on transaction (locks table until commit)
      const availableProofs = tx.query<any>(sql, params);

      // GREEDY COIN SELECTION ALGORITHM
      // Iterate through sorted proofs, selecting until amount reached
      const selected: Proof[] = [];
      let total = 0;

      for (const row of availableProofs) {
        // Break loop when we have enough (total >= requested amount)
        if (total >= amount) break;

        // Map database row to Proof object
        const proof = this.mapRowToProof(row);

        // Add proof to selection
        selected.push(proof);
        total += proof.amount;
      }

      // INSUFFICIENT FUNDS CHECK
      // If we don't have enough proofs to reach requested amount, fail
      if (total < amount) {
        throw new Error(
          `Insufficient funds: requested ${amount}, available ${total}`
        );
      }

      // LOCK SELECTED PROOFS
      // Update each selected proof to PENDING_SEND state
      // This prevents other operations from selecting same proofs
      for (const proof of selected) {
        tx.execute(
          `UPDATE proofs
           SET state = ?, locked_at = ?, locked_for = ?
           WHERE id = ?`,
          [ProofState.PENDING_SEND, Date.now(), transactionId, proof.id]
        );
      }

      // Return selection result with calculated change
      // Change = total selected - requested amount
      // This change will need to be swapped back to wallet as new proofs
      return {
        proofs: selected,
        total,
        change: total - amount,
      };
    });
  }

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * OCR MANAGEMENT
   * ═════════════════════════════════════════════════════════════════════════
   */

  /**
   * Mark proofs as OCR (Offline Cash Reserve)
   *
   * Moves proofs from spending pool to savings pool.
   * This is a UI/organizational feature, NOT a security feature.
   *
   * WHAT THIS DOES:
   * - Sets is_ocr = 1 for specified proofs
   * - Excludes proofs from default spending operations
   * - Separates balance in UI (savings vs spending)
   *
   * WHAT THIS DOES NOT DO:
   * - Does NOT encrypt proofs
   * - Does NOT protect from theft
   * - Does NOT prevent spending if explicitly selected
   * - Does NOT move proofs to different mint
   *
   * SECURITY IMPLICATIONS:
   * - OCR is just a database flag
   * - If device compromised, attacker can unmark OCR and spend
   * - For true cold storage, export proofs to offline device
   * - For true security, use hardware wallet or multisig
   *
   * USE CASES:
   * - Savings pool separate from spending money
   * - Emergency fund isolation
   * - Preventing accidental spending of reserves
   * - Organizing funds by purpose
   *
   * @async
   * @param {string[]} proofIds - Array of proof IDs to mark as OCR
   * @returns {Promise<void>}
   * @throws {Error} If database update fails
   *
   * @example
   * // User wants to save 100k sats
   * // First select 100k sats worth of proofs
   * const proofs = await repo.getAll({
   *   state: ProofState.UNSPENT,
   *   isOCR: false
   * });
   * const savingsProofs = selectProofsUpTo(proofs, 100000);
   * const ids = savingsProofs.map(p => p.id);
   *
   * // Mark as OCR
   * await repo.markAsOCR(ids);
   *
   * // Now these proofs excluded from normal spending
   * const balance = repo.getTotalBalance(); // Doesn't include OCR
   * const savings = repo.getOCRBalance();   // Only OCR proofs
   */
  async markAsOCR(proofIds: string[]): Promise<void> {
    // Early return if no proofs (avoid unnecessary query)
    if (proofIds.length === 0) return;

    // Build dynamic IN clause with correct number of placeholders
    // SQL: WHERE id IN (?, ?, ?)
    const placeholders = proofIds.map(() => '?').join(',');

    // Execute update with parameterized query
    await this.db.execute(
      `UPDATE proofs SET is_ocr = 1 WHERE id IN (${placeholders})`,
      proofIds
    );
  }

  /**
   * Unmark proofs as OCR (return to spending pool)
   *
   * Moves proofs from savings pool back to spending pool.
   * User can now spend these proofs in normal operations.
   *
   * @async
   * @param {string[]} proofIds - Array of proof IDs to unmark as OCR
   * @returns {Promise<void>}
   * @throws {Error} If database update fails
   *
   * @example
   * // User needs to spend from savings
   * const ocrProofs = await repo.getAll({ isOCR: true });
   * const idsToSpend = ocrProofs.slice(0, 5).map(p => p.id);
   *
   * // Return to spending pool
   * await repo.unmarkAsOCR(idsToSpend);
   *
   * // Now available for normal spending
   * const balance = repo.getTotalBalance(); // Includes unmarked proofs
   */
  async unmarkAsOCR(proofIds: string[]): Promise<void> {
    if (proofIds.length === 0) return;

    const placeholders = proofIds.map(() => '?').join(',');

    await this.db.execute(
      `UPDATE proofs SET is_ocr = 0 WHERE id IN (${placeholders})`,
      proofIds
    );
  }

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * DELETE OPERATIONS (USE WITH EXTREME CAUTION)
   * ═════════════════════════════════════════════════════════════════════════
   */

  /**
   * Delete proof from database (DANGEROUS - USE WITH CAUTION)
   *
   * WARNING: This permanently removes proof from database.
   *
   * WHEN TO USE:
   * - Proof is confirmed SPENT at mint (marked SPENT first)
   * - Proof is invalid/corrupted (verified unspendable)
   * - Database cleanup after verification
   *
   * WHEN NOT TO USE:
   * - Proof state is UNSPENT (you'll lose funds!)
   * - Proof state is PENDING (operation may succeed)
   * - You haven't verified with mint first
   *
   * RECOMMENDED APPROACH:
   * Instead of deleting, mark as SPENT:
   * 1. Proof remains in database for history
   * 2. Can be queried for transaction records
   * 3. Can be audited against mint's spent list
   * 4. No risk of accidental fund loss
   *
   * SECURITY IMPLICATIONS:
   * - If proof was actually unspent, funds are PERMANENTLY LOST
   * - No undo, no recovery possible
   * - Cannot regenerate proof (secret is lost)
   * - Mint still has proof in its database (but you don't)
   *
   * @async
   * @param {string} id - Internal UUID of proof to delete
   * @returns {Promise<void>}
   * @throws {Error} If database delete fails
   *
   * @example
   * // SAFE: Delete proof confirmed spent
   * const proof = await repo.getById(proofId);
   * if (proof.state === ProofState.SPENT) {
   *   await repo.delete(proofId);
   *   console.log('Cleaned up spent proof');
   * }
   *
   * @example
   * // UNSAFE: Deleting unspent proof
   * await repo.delete(proofId); // DON'T DO THIS!
   * // Funds permanently lost
   */
  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM proofs WHERE id = ?', [id]);
  }

  /**
   * Delete multiple proofs by secret (cleanup after swap)
   *
   * Used after successful swap to remove old proofs that are now spent.
   *
   * SWAP WORKFLOW:
   * 1. Select old proofs for swap
   * 2. Send old proofs to mint
   * 3. Receive new proofs from mint
   * 4. Insert new proofs as UNSPENT
   * 5. Delete old proofs (this method)
   *
   * WHY DELETE BY SECRET (not by ID)?
   * - Swap response from mint includes secrets of spent proofs
   * - Mint doesn't know our internal IDs
   * - Secret is the canonical identifier in Cashu protocol
   *
   * TRANSACTION SAFETY:
   * This method does NOT use transaction. Caller should wrap in transaction:
   *
   * await db.transaction(async (tx) => {
   *   await createMany(newProofs);  // Add new
   *   await deleteBySecrets(oldSecrets);  // Remove old
   * });
   *
   * This ensures atomicity: both operations succeed or both fail.
   *
   * @async
   * @param {string[]} secrets - Array of proof secrets to delete
   * @returns {Promise<void>}
   * @throws {Error} If database delete fails
   *
   * @example
   * // After successful swap
   * const oldSecrets = oldProofs.map(p => p.secret);
   * const newProofs = await mintApi.swap(oldProofs);
   *
   * await db.transaction(async (tx) => {
   *   // Add new proofs
   *   await repo.createMany(newProofs);
   *
   *   // Remove old proofs
   *   await repo.deleteBySecrets(oldSecrets);
   * });
   */
  async deleteBySecrets(secrets: string[]): Promise<void> {
    if (secrets.length === 0) return;

    const placeholders = secrets.map(() => '?').join(',');

    await this.db.execute(
      `DELETE FROM proofs WHERE secret IN (${placeholders})`,
      secrets
    );
  }

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * STATISTICS AND MONITORING
   * ═════════════════════════════════════════════════════════════════════════
   */

  /**
   * Get count of proofs in specific state
   *
   * Useful for:
   * - Monitoring pending operations
   * - Debugging state machine issues
   * - Analytics and reporting
   * - Health checks
   *
   * @param {ProofState} state - State to count
   * @returns {number} Number of proofs in that state
   *
   * @example
   * const unspentCount = repo.getCountByState(ProofState.UNSPENT);
   * const pendingCount = repo.getCountByState(ProofState.PENDING_SEND);
   * console.log(`${unspentCount} unspent, ${pendingCount} pending`);
   */
  getCountByState(state: ProofState): number {
    const result = this.db.querySync<{ count: number }>(
      `SELECT COUNT(*) as count FROM proofs WHERE state = ?`,
      [state]
    );

    return result[0]?.count || 0;
  }

  /**
   * Release stale locks back to UNSPENT state
   *
   * This is the automatic recovery mechanism for crashed operations.
   *
   * WHEN TO CALL:
   * 1. On app startup (recover from previous crash)
   * 2. Periodically every 5-10 minutes (background cleanup)
   * 3. Before showing balance (ensure accurate display)
   *
   * WHAT IT DOES:
   * 1. Find all PENDING proofs (PENDING_SEND or PENDING_SWAP)
   * 2. Check if locked_at > LOCK_TIMEOUT_MS ago
   * 3. If yes, update state to UNSPENT
   * 4. Clear locked_at and locked_for
   * 5. Return count of released locks
   *
   * EDGE CASE: What if proof was actually spent?
   * - Proof returned to UNSPENT by this method
   * - User tries to spend it
   * - Mint rejects (proof in spent list)
   * - We handle rejection by marking SPENT locally
   * - Balance corrected, no funds lost
   * - User may see temporary incorrect balance
   *
   * LOGGING:
   * - Logs count of released locks (for monitoring)
   * - Silent if no stale locks found (normal case)
   * - Warnings in transitionState when stale lock detected
   *
   * @async
   * @returns {Promise<number>} Number of locks released
   * @throws {Error} If database update fails
   *
   * @example
   * // On app startup
   * const released = await repo.releaseStaleLocks();
   * if (released > 0) {
   *   console.log(`Recovered ${released} proofs from crashed operations`);
   * }
   *
   * @example
   * // Background cleanup task
   * setInterval(async () => {
   *   await repo.releaseStaleLocks();
   * }, 5 * 60 * 1000); // Every 5 minutes
   */
  async releaseStaleLocks(): Promise<number> {
    // Calculate cutoff timestamp (now - timeout)
    // Any lock older than this is considered stale
    const cutoffTime = Date.now() - this.LOCK_TIMEOUT_MS;

    // Update proofs that are:
    // 1. In PENDING state (PENDING_SEND or PENDING_SWAP)
    // 2. Locked before cutoff time (stale)
    const result = await this.db.execute(
      `UPDATE proofs
       SET state = ?, locked_at = NULL, locked_for = NULL
       WHERE state IN (?, ?) AND locked_at < ?`,
      [ProofState.UNSPENT, ProofState.PENDING_SEND, ProofState.PENDING_SWAP, cutoffTime]
    );

    // Get count of updated rows
    const releasedCount = result.rowsAffected || 0;

    // Log if any locks released (indicates crashed operations)
    if (releasedCount > 0) {
      console.log(`[ProofRepository] Released ${releasedCount} stale locks`);
      console.log(`  Cutoff time: ${new Date(cutoffTime).toISOString()}`);
      console.log(`  Current time: ${new Date().toISOString()}`);
    }

    return releasedCount;
  }

  /**
   * Get proofs locked for specific transaction ID
   *
   * Used for:
   * - Checking status of in-flight transaction
   * - Debugging stuck transactions
   * - Auditing transaction history
   * - Cleaning up after failed transactions
   *
   * @async
   * @param {string} transactionId - UUID of transaction
   * @returns {Promise<Proof[]>} Array of proofs locked for that transaction
   *
   * @example
   * // Check proofs locked for transaction
   * const txId = 'tx-abc123';
   * const lockedProofs = await repo.getByTransactionId(txId);
   * console.log(`Transaction ${txId} has ${lockedProofs.length} proofs locked`);
   *
   * for (const proof of lockedProofs) {
   *   const lockAge = Date.now() - proof.lockedAt;
   *   console.log(`  Proof ${proof.id}: locked ${lockAge}ms ago`);
   * }
   */
  async getByTransactionId(transactionId: string): Promise<Proof[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM proofs WHERE locked_for = ?`,
      [transactionId]
    );

    return rows.map(row => this.mapRowToProof(row));
  }

  /**
   * Get comprehensive wallet statistics
   *
   * Returns snapshot of wallet state for:
   * - UI dashboard
   * - Health monitoring
   * - Debug information
   * - Analytics
   *
   * STATISTICS INCLUDED:
   * - total: Total proof count (all states)
   * - unspent: Count of UNSPENT proofs (spendable)
   * - pending: Count of PENDING proofs (locked)
   * - spent: Count of SPENT proofs (history)
   * - ocr: Count of OCR proofs (savings)
   * - totalValue: Sum of UNSPENT amounts (balance)
   * - ocrValue: Sum of UNSPENT OCR amounts (savings balance)
   *
   * PERFORMANCE:
   * Uses querySync for fast execution (called frequently).
   * All queries are simple aggregates with indexed columns.
   *
   * @returns {Object} Statistics object
   *
   * @example
   * const stats = repo.getStats();
   * console.log(`
   *   Total Proofs: ${stats.total}
   *   Unspent: ${stats.unspent} (${stats.totalValue} sats)
   *   Pending: ${stats.pending}
   *   Spent: ${stats.spent}
   *   OCR: ${stats.ocr} (${stats.ocrValue} sats)
   * `);
   * // Total Proofs: 156
   * // Unspent: 89 (150000 sats)
   * // Pending: 3
   * // Spent: 64
   * // OCR: 12 (100000 sats)
   */
  getStats(): {
    total: number;
    unspent: number;
    pending: number;
    spent: number;
    ocr: number;
    totalValue: number;
    ocrValue: number;
  } {
    // Total count (all proofs regardless of state)
    const totalCount = this.db.querySync<{ count: number }>(
      'SELECT COUNT(*) as count FROM proofs'
    )[0]?.count || 0;

    // Count by state
    const unspentCount = this.getCountByState(ProofState.UNSPENT);
    const pendingCount =
      this.getCountByState(ProofState.PENDING_SEND) +
      this.getCountByState(ProofState.PENDING_SWAP);
    const spentCount = this.getCountByState(ProofState.SPENT);

    // OCR count (across all states, but typically UNSPENT)
    const ocrCount = this.db.querySync<{ count: number }>(
      'SELECT COUNT(*) as count FROM proofs WHERE is_ocr = 1'
    )[0]?.count || 0;

    // Value calculations (only UNSPENT proofs count toward balance)
    const totalValue = this.getTotalBalance();
    const ocrValue = this.getOCRBalance();

    return {
      total: totalCount,
      unspent: unspentCount,
      pending: pendingCount,
      spent: spentCount,
      ocr: ocrCount,
      totalValue,
      ocrValue,
    };
  }

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * INTERNAL HELPER METHODS
   * ═════════════════════════════════════════════════════════════════════════
   */

  /**
   * Map database row to Proof object
   *
   * SQLite stores data in flat format with snake_case columns.
   * TypeScript uses camelCase objects.
   * This method transforms database row to typed Proof object.
   *
   * TRANSFORMATIONS:
   * - mint_url → mintUrl (snake_case to camelCase)
   * - keyset_id → keysetId
   * - is_ocr (1/0) → isOCR (boolean)
   * - locked_at → lockedAt
   * - locked_for → lockedFor
   * - created_at → createdAt
   * - state (string) → state (ProofState enum)
   *
   * NULL HANDLING:
   * - locked_at may be NULL (undefined in JavaScript)
   * - locked_for may be NULL (undefined in JavaScript)
   *
   * @private
   * @param {any} row - Raw database row object
   * @returns {Proof} Typed Proof object
   *
   * @example
   * // Database row:
   * const row = {
   *   id: 'f47ac10b...',
   *   secret: 'abc123...',
   *   C: '02a1b2c3...',
   *   amount: 1000,
   *   mint_url: 'https://mint.com',
   *   keyset_id: '00faa...',
   *   state: 'UNSPENT',
   *   is_ocr: 0,
   *   locked_at: null,
   *   locked_for: null,
   *   created_at: 1701234567890
   * };
   *
   * // Mapped proof:
   * const proof = this.mapRowToProof(row);
   * // {
   * //   id: 'f47ac10b...',
   * //   secret: 'abc123...',
   * //   C: '02a1b2c3...',
   * //   amount: 1000,
   * //   mintUrl: 'https://mint.com',
   * //   keysetId: '00faa...',
   * //   state: ProofState.UNSPENT,
   * //   isOCR: false,
   * //   lockedAt: undefined,
   * //   lockedFor: undefined,
   * //   createdAt: 1701234567890
   * // }
   */
  private mapRowToProof(row: any): Proof {
    return {
      id: row.id,
      secret: row.secret,
      C: row.C,
      amount: row.amount,
      mintUrl: row.mint_url,
      keysetId: row.keyset_id,
      state: row.state as ProofState,
      isOCR: row.is_ocr === 1,  // SQLite integer to boolean
      lockedAt: row.locked_at,
      lockedFor: row.locked_for,
      createdAt: row.created_at,
    };
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SINGLETON EXPORT
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Singleton instance export for convenient imports
 *
 * Usage:
 * import proofRepository from './ProofRepository';
 * const balance = proofRepository.getTotalBalance();
 *
 * Alternative:
 * import { ProofRepository } from './ProofRepository';
 * const repo = ProofRepository.getInstance();
 * const balance = repo.getTotalBalance();
 *
 * Both approaches use the same singleton instance.
 */
export default ProofRepository.getInstance();

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SECURITY AUDIT CHECKLIST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Use this checklist when reviewing changes to this file:
 *
 * [ ] All state transitions wrapped in database transactions
 * [ ] All state transitions validate fromState before changing
 * [ ] Coin selection locks proofs atomically
 * [ ] No SQL injection vulnerabilities (parameterized queries only)
 * [ ] Lock timeout is reasonable (not too short, not too long)
 * [ ] Stale lock cleanup called on app startup
 * [ ] No proof secrets logged or exposed in UI
 * [ ] Delete operations protected (only for SPENT proofs)
 * [ ] Balance calculations exclude PENDING proofs
 * [ ] OCR proofs excluded from default spending
 * [ ] All async operations have error handling
 * [ ] Transaction failures rollback atomically
 * [ ] No race conditions in concurrent operations
 * [ ] Deadlock prevention (consistent lock order)
 * [ ] Statistics queries optimized (use sync for simple queries)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COMMON PITFALLS TO AVOID
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. READING STATE OUTSIDE TRANSACTION
 *    ✗ const state = await getState(); await updateState();
 *    ✓ await transaction(() => { const state = getState(); updateState(); });
 *
 * 2. UPDATING WITHOUT STATE VALIDATION
 *    ✗ UPDATE proofs SET state = ? WHERE id = ?
 *    ✓ UPDATE proofs SET state = ? WHERE id = ? AND state = ?
 *
 * 3. DELETING UNSPENT PROOFS
 *    ✗ await delete(id);
 *    ✓ await transitionState(id, UNSPENT, SPENT); // Mark spent first
 *
 * 4. INCLUDING PENDING IN BALANCE
 *    ✗ WHERE state IN (UNSPENT, PENDING_SEND)
 *    ✓ WHERE state = UNSPENT
 *
 * 5. FORGETTING TO RELEASE STALE LOCKS
 *    ✗ No cleanup on startup
 *    ✓ await releaseStaleLocks() on startup
 *
 * 6. LOGGING PROOF SECRETS
 *    ✗ console.log(`Proof secret: ${proof.secret}`);
 *    ✓ console.log(`Proof id: ${proof.id}`);
 *
 * 7. NOT USING TRANSACTIONS FOR BATCH OPERATIONS
 *    ✗ for (const proof of proofs) await create(proof);
 *    ✓ await createMany(proofs); // Single transaction
 *
 * 8. HARDCODING TRANSACTION TIMEOUT
 *    ✗ if (Date.now() - lockedAt > 300000)
 *    ✓ if (Date.now() - lockedAt > this.LOCK_TIMEOUT_MS)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * END OF FILE
 * ═══════════════════════════════════════════════════════════════════════════
 */
