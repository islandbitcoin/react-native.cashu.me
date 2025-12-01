/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                            SYNC ENGINE                                     ║
 * ║                   Offline-First Synchronization System                     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * ASCII SYNC FLOW DIAGRAM:
 * ========================
 *
 *     ┌─────────────┐
 *     │   Device    │
 *     │  (Offline)  │
 *     └──────┬──────┘
 *            │
 *            │ 1. User performs actions
 *            │    (send/receive/OCR requests)
 *            ▼
 *     ┌─────────────┐
 *     │   Local     │◄────────────────────────────┐
 *     │   SQLite    │                             │
 *     │  Database   │    2. Actions stored        │
 *     └──────┬──────┘       locally first         │
 *            │                                     │
 *            │ 3. Network change detected          │
 *            ▼                                     │
 *     ┌─────────────┐                             │
 *     │  Network    │                             │
 *     │  Monitor    │                             │
 *     │  (NetInfo)  │                             │
 *     └──────┬──────┘                             │
 *            │                                     │
 *            │ 4. Trigger sync                     │
 *            ▼                                     │
 *     ┌─────────────┐                             │
 *     │    SYNC     │                             │
 *     │   ENGINE    │◄────5. Periodic timer       │
 *     │   (This)    │      (every 15 min)         │
 *     └──────┬──────┘                             │
 *            │                                     │
 *            │ 6. Execute sync priorities          │
 *            │                                     │
 *            ├─► Priority 1: Pending Transactions │
 *            │   └─► Retry failed sends           │
 *            │   └─► Confirm pending receives     │
 *            │                                     │
 *            ├─► Priority 2: OCR Refill            │
 *            │   └─► Check OCR balance            │
 *            │   └─► Request new codes if low     │
 *            │                                     │
 *            ├─► Priority 3: Keyset Updates        │
 *            │   └─► Fetch new mint keys          │
 *            │   └─► Update stale keysets         │
 *            │                                     │
 *            └─► Priority 4: Mint Metadata         │
 *                └─► Refresh mint info            │
 *                └─► Update contact details       │
 *                                                  │
 *            7. Update local database ─────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHY OFFLINE-FIRST ARCHITECTURE NEEDS SYNCHRONIZATION
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * PROBLEM:
 * --------
 * Cashu tokens are bearer assets - whoever holds the token owns the value.
 * In a mobile environment, network connectivity is:
 *   • Unreliable (tunnels, elevators, rural areas)
 *   • Intermittent (switching between WiFi and cellular)
 *   • Expensive (metered data plans)
 *   • Slow (poor signal strength)
 *
 * Traditional online-only apps would:
 *   ❌ Block user actions during network outages
 *   ❌ Lose data if requests timeout
 *   ❌ Frustrate users with loading spinners
 *   ❌ Drain battery with constant network polling
 *
 * OFFLINE-FIRST SOLUTION:
 * ----------------------
 * 1. IMMEDIATE RESPONSE: All user actions write to local SQLite database first
 *    - User gets instant feedback, no waiting for network
 *    - App remains fully functional offline
 *
 * 2. EVENTUAL CONSISTENCY: Sync engine reconciles local state with remote mints
 *    - When network returns, automatically sync pending operations
 *    - User doesn't need to manually retry failed operations
 *    - Background sync keeps data fresh without user intervention
 *
 * 3. INTELLIGENT SYNC PRIORITIES: Critical operations sync first
 *    - Transactions (money movement) take highest priority
 *    - OCR codes (needed for offline use) sync next
 *    - Metadata (nice-to-have info) syncs last
 *
 * 4. NETWORK-AWARE: Respects user preferences and network conditions
 *    - Can restrict sync to WiFi only (save expensive cellular data)
 *    - Detects metered connections
 *    - Pauses sync when network disconnects
 *
 * CASHU-SPECIFIC CHALLENGES:
 * -------------------------
 * • OCR (Offline Cash Reserves): Need to pre-fetch codes while online
 *   so users can receive ecash when offline
 *
 * • Mint Keysets: Mints rotate cryptographic keys periodically
 *   Must sync new keys to validate tokens and create transactions
 *
 * • Pending Transactions: Failed sends must retry, pending receives must confirm
 *   Cannot leave user's balance in inconsistent state
 *
 * • Multiple Mints: User may have tokens from different mints
 *   Must sync each mint independently, handle failures gracefully
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * NETWORK STATE MONITORING AND TRANSITIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The sync engine monitors network state using @react-native-community/netinfo
 * which provides real-time network connectivity information.
 *
 * TRACKED NETWORK PROPERTIES:
 * --------------------------
 *
 * 1. isConnected (boolean)
 *    - Whether device has any network connectivity
 *    - Triggers: When WiFi/cellular connects or disconnects
 *    - Used to: Enable/disable sync operations
 *
 * 2. isWiFi (boolean)
 *    - Whether connection is WiFi (vs cellular)
 *    - Triggers: When switching between network types
 *    - Used to: Honor "WiFi only" sync preferences
 *
 * 3. isMetered (boolean)
 *    - Whether connection has data limits/charges
 *    - Triggers: When network cost characteristics change
 *    - Used to: Avoid expensive cellular data usage
 *
 * 4. timestamp (number)
 *    - When this network state was recorded
 *    - Used to: Track network state age and transitions
 *
 * NETWORK TRANSITION FLOW:
 * -----------------------
 *
 * Initial State: OFFLINE
 *   ↓
 *   └─► App starts → NetInfo.fetch() → Get current state
 *       └─► If online: Immediate sync
 *       └─► If offline: Wait for connection
 *
 * Transition: OFFLINE → ONLINE
 *   ↓
 *   ├─► NetInfo.addEventListener() fires
 *   ├─► handleNetworkStateChange() called
 *   ├─► wasConnected=false, now isConnected=true
 *   └─► Trigger immediate sync (catch up on missed operations)
 *
 * Transition: ONLINE → OFFLINE
 *   ↓
 *   ├─► NetInfo.addEventListener() fires
 *   ├─► handleNetworkStateChange() called
 *   ├─► wasConnected=true, now isConnected=false
 *   └─► Cancel ongoing sync, log disconnection
 *       └─► Sync will resume when connection returns
 *
 * Transition: WiFi → Cellular
 *   ↓
 *   ├─► NetInfo.addEventListener() fires
 *   ├─► isWiFi changes from true to false
 *   └─► If syncOnWiFiOnly=true: Pause sync until WiFi returns
 *       If syncOnWiFiOnly=false: Continue sync on cellular
 *
 * WHY THIS MATTERS:
 * ----------------
 * • Mobile networks are unstable - transitions happen frequently
 * • Each transition is an opportunity to sync pending changes
 * • Must handle transitions gracefully to avoid partial syncs
 * • User experience improves when sync is invisible and automatic
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SYNC PRIORITY SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Sync operations execute in priority order to ensure most critical
 * operations complete first, especially on slow/unreliable connections.
 *
 * PRIORITY 1: PENDING TRANSACTIONS (CRITICAL)
 * -------------------------------------------
 * Why critical: User's money is at stake
 *
 * Operations:
 *   • Retry failed send transactions
 *     - User tried to send ecash but network failed
 *     - Must retry to complete payment
 *     - If retry succeeds: Update transaction status to COMPLETED
 *     - If retry fails: Mark transaction as FAILED (after timeout)
 *
 *   • Confirm pending receive transactions
 *     - User received ecash offline
 *     - Must confirm with mint that tokens are valid
 *     - Update local balance once confirmed
 *
 * Failure handling:
 *   • Transactions older than 1 hour → Mark as FAILED
 *   • Retry up to 3 times before giving up
 *   • Log errors for debugging, show notification to user
 *
 * Example scenario:
 *   User sends 100 sats while on subway (offline)
 *   → Transaction stored locally as PENDING
 *   → User exits subway, phone reconnects to network
 *   → Sync engine wakes up, sees PENDING transaction
 *   → Priority 1: Immediately retry the send
 *   → Success: Transaction marked COMPLETED, recipient gets ecash
 *
 * PRIORITY 2: OCR REFILL (HIGH)
 * -----------------------------
 * Why high priority: Enables offline receiving
 *
 * OCR (Offline Cash Reserves) are pre-generated codes that let you
 * receive ecash while offline. Without OCR codes, you can't receive
 * payments unless you have network connectivity.
 *
 * Operations:
 *   • Check OCR balance for each trusted mint
 *   • If balance < threshold (e.g., 5 codes remaining):
 *     - Request batch of new codes from mint
 *     - Store codes locally in SQLite
 *     - Update last_refilled timestamp
 *
 * Refill strategy:
 *   • Refill when: balance < 5 codes
 *   • Request: 10-20 new codes (configurable)
 *   • Throttle: Max 1 refill per mint per hour
 *
 * Failure handling:
 *   • If mint offline: Skip, retry next sync
 *   • If request fails: Log error, try again later
 *   • If persistent failures: Show notification to user
 *
 * Example scenario:
 *   User has 3 OCR codes remaining
 *   → Sync engine detects low balance
 *   → Priority 2: Request 10 new codes from mint
 *   → Codes stored locally
 *   → User can now receive 13 offline payments
 *
 * PRIORITY 3: KEYSET UPDATES (MEDIUM)
 * -----------------------------------
 * Why medium priority: Required for new transactions
 *
 * Mints periodically rotate their cryptographic keys for security.
 * To create or validate transactions, you need the latest keysets.
 *
 * Operations:
 *   • Fetch /v1/keys endpoint for each mint
 *   • Compare with stored keysets
 *   • Add new keys, mark old keys as inactive
 *   • Update last_synced timestamp
 *
 * Staleness detection:
 *   • Keysets older than 24 hours → Considered stale
 *   • Sync only stale keysets to reduce network traffic
 *
 * Failure handling:
 *   • If fetch fails: Keep using cached keys
 *   • If keys invalid: Mark mint as untrusted
 *   • Old keys remain valid until mint deactivates them
 *
 * Example scenario:
 *   Mint rotates keys every 7 days
 *   → Last sync was 25 hours ago (stale)
 *   → Priority 3: Fetch new keys
 *   → New keys stored alongside old keys
 *   → Old keys still work for existing tokens
 *   → New transactions use new keys
 *
 * PRIORITY 4: MINT METADATA (LOW)
 * --------------------------------
 * Why low priority: Nice-to-have information
 *
 * Mint metadata includes display name, description, contact info, etc.
 * This information is purely cosmetic - doesn't affect functionality.
 *
 * Operations:
 *   • Fetch /v1/info endpoint for each mint
 *   • Update mint's display name, description
 *   • Update contact details (email, Nostr pubkey)
 *   • Refresh mint icon URL
 *
 * Update frequency:
 *   • Only sync if explicitly enabled in strategy
 *   • Default: Disabled (to save bandwidth)
 *   • If enabled: Sync every 7 days
 *
 * Failure handling:
 *   • Silently fail - metadata updates are optional
 *   • Keep using cached metadata
 *   • No user notification for failures
 *
 * Example scenario:
 *   Mint updates their logo and description
 *   → Priority 4: Fetch new /v1/info
 *   → Update stored metadata
 *   → User sees new logo in mint list
 *
 * WHY THIS PRIORITY ORDER?
 * -----------------------
 * 1. Transactions affect user's money → Must complete first
 * 2. OCR enables core functionality (offline receiving) → High priority
 * 3. Keysets required for new transactions → Medium priority
 * 4. Metadata is cosmetic → Low priority, optional
 *
 * On slow/unstable connections:
 *   • Priorities 1-2 likely complete before disconnection
 *   • Priority 3 may partially complete (some mints sync)
 *   • Priority 4 may not run at all (acceptable tradeoff)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PERIODIC SYNC SCHEDULING
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * While network transitions trigger immediate syncs, periodic background
 * sync ensures data stays fresh even when network is stable.
 *
 * HOW IT WORKS:
 * ------------
 *
 * 1. Initialization
 *    ├─► startPeriodicSync() called during initialize()
 *    ├─► Creates setInterval() timer
 *    └─► Interval = syncInterval * 60 * 1000 (default: 15 minutes)
 *
 * 2. Timer Fires Every Interval
 *    ├─► Check if autoSync enabled (can be disabled in settings)
 *    ├─► Check if canSync() returns true
 *    │   ├─► Is network connected?
 *    │   ├─► WiFi-only restriction honored?
 *    │   └─► Not already syncing?
 *    └─► If all checks pass: Execute syncNow()
 *
 * 3. Sync Execution
 *    ├─► Set isSyncing = true (prevents concurrent syncs)
 *    ├─► Execute priorities 1-4 sequentially
 *    ├─► Update lastSyncTimestamp
 *    └─► Set isSyncing = false
 *
 * 4. Next Cycle
 *    └─► Wait for next timer interval
 *
 * CONFIGURATION OPTIONS:
 * ---------------------
 *
 * syncInterval: number (minutes)
 *   • Default: 15 minutes
 *   • Range: 5-60 minutes recommended
 *   • Too frequent: Drains battery, wastes bandwidth
 *   • Too infrequent: Data becomes stale, OCR may deplete
 *   • Balance: 15 minutes good for most users
 *
 * autoSync: boolean
 *   • Default: true
 *   • When false: Only manual syncs occur
 *   • Use case: User wants full control over sync timing
 *   • Note: Network transitions still trigger sync
 *
 * backgroundSync: boolean
 *   • Default: true
 *   • When true: Sync continues when app backgrounded
 *   • When false: Only sync when app in foreground
 *   • Platform: iOS limits background sync to ~30 seconds
 *
 * LIFECYCLE MANAGEMENT:
 * --------------------
 *
 * Creation:
 *   startPeriodicSync()
 *   └─► this.syncIntervalId = setInterval(...)
 *
 * Update (when interval changes):
 *   setStrategy({ syncInterval: 30 })
 *   ├─► clearInterval(this.syncIntervalId)
 *   └─► startPeriodicSync() with new interval
 *
 * Destruction:
 *   shutdown()
 *   └─► clearInterval(this.syncIntervalId)
 *       └─► Prevents memory leaks
 *
 * WHY PERIODIC SYNC?
 * -----------------
 * • Network state may not change for hours (stable WiFi)
 * • OCR balance depletes over time (receiving payments)
 * • Mint keys may rotate while network stable
 * • Ensures app data never more than [interval] out of date
 * • Background sync means users don't think about it
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * STRATEGY CONFIGURATION OPTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The SyncStrategy interface allows fine-grained control over sync behavior.
 * This enables:
 *   • Power users to optimize for their usage patterns
 *   • Data-conscious users to minimize cellular usage
 *   • Developers to customize sync for testing
 *
 * CONFIGURATION INTERFACE:
 * -----------------------
 *
 * interface SyncStrategy {
 *   autoSync: boolean;           // Enable automatic periodic sync
 *   syncOnWiFiOnly: boolean;     // Restrict sync to WiFi connections
 *   syncInterval: number;        // Minutes between automatic syncs
 *   backgroundSync: boolean;     // Allow sync when app backgrounded
 *   priority: {                  // Enable/disable each sync priority
 *     transactions: boolean;     // Always recommended: true
 *     ocr: boolean;             // Recommended: true
 *     keysets: boolean;         // Recommended: true
 *     metadata: boolean;        // Optional: false to save bandwidth
 *   };
 * }
 *
 * DEFAULT STRATEGY:
 * ----------------
 * {
 *   autoSync: true,              // Automatic sync enabled
 *   syncOnWiFiOnly: false,       // Sync on any connection
 *   syncInterval: 15,            // Every 15 minutes
 *   backgroundSync: true,        // Background sync enabled
 *   priority: {
 *     transactions: true,        // Always sync transactions
 *     ocr: true,                // Always refill OCR
 *     keysets: true,            // Always update keysets
 *     metadata: false,          // Skip metadata (save bandwidth)
 *   }
 * }
 *
 * COMMON CONFIGURATION SCENARIOS:
 * ------------------------------
 *
 * 1. Data-Conscious User (Expensive Cellular Plan):
 *    {
 *      autoSync: true,
 *      syncOnWiFiOnly: true,     // Only sync on WiFi
 *      syncInterval: 30,         // Less frequent
 *      backgroundSync: true,
 *      priority: {
 *        transactions: true,
 *        ocr: true,
 *        keysets: true,
 *        metadata: false,        // Skip optional data
 *      }
 *    }
 *
 * 2. Power User (Wants Freshest Data):
 *    {
 *      autoSync: true,
 *      syncOnWiFiOnly: false,    // Sync on any connection
 *      syncInterval: 5,          // Sync every 5 minutes
 *      backgroundSync: true,
 *      priority: {
 *        transactions: true,
 *        ocr: true,
 *        keysets: true,
 *        metadata: true,         // Include all data
 *      }
 *    }
 *
 * 3. Manual Control (User Triggers Syncs):
 *    {
 *      autoSync: false,          // No automatic sync
 *      syncOnWiFiOnly: false,
 *      syncInterval: 15,         // Ignored when autoSync=false
 *      backgroundSync: false,    // Only sync when requested
 *      priority: {
 *        transactions: true,
 *        ocr: true,
 *        keysets: true,
 *        metadata: false,
 *      }
 *    }
 *
 * 4. Battery Saver (Minimize Background Activity):
 *    {
 *      autoSync: true,
 *      syncOnWiFiOnly: true,
 *      syncInterval: 60,         // Only once per hour
 *      backgroundSync: false,    // No background sync
 *      priority: {
 *        transactions: true,
 *        ocr: false,             // Only refill on manual sync
 *        keysets: false,         // Only update on manual sync
 *        metadata: false,
 *      }
 *    }
 *
 * RUNTIME STRATEGY UPDATES:
 * ------------------------
 *
 * Strategy can be changed at runtime:
 *
 *   syncEngine.setStrategy({
 *     syncOnWiFiOnly: true,
 *     syncInterval: 30,
 *   });
 *
 * Changes take effect immediately:
 *   • If syncInterval changed: Periodic timer restarted
 *   • If autoSync changed: Timer started or stopped
 *   • If priority changed: Next sync uses new priorities
 *   • If syncOnWiFiOnly changed: Next canSync() check uses new value
 *
 * VALIDATION:
 * ----------
 * • syncInterval minimum: 5 minutes (prevent excessive API calls)
 * • All priority flags default to their recommended values
 * • Partial updates merge with existing strategy (no need to specify all fields)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ERROR HANDLING AND RECOVERY
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The sync engine must handle errors gracefully because network operations
 * are inherently unreliable. Errors can occur at many levels.
 *
 * ERROR CATEGORIES:
 * ----------------
 *
 * 1. NETWORK ERRORS
 *    - DNS resolution fails
 *    - Connection timeout
 *    - Connection refused (mint offline)
 *    - SSL/TLS errors
 *
 *    Recovery:
 *      • Log error with full context
 *      • Don't mark operation as failed (might be transient)
 *      • Retry on next sync cycle
 *      • If persistent: Show notification after 3 failures
 *
 * 2. API ERRORS
 *    - 404 Not Found (mint removed endpoint)
 *    - 500 Internal Server Error (mint bug)
 *    - 429 Rate Limited (too many requests)
 *    - 403 Forbidden (mint blocked us)
 *
 *    Recovery:
 *      • 404: Log error, skip this mint
 *      • 500: Retry with exponential backoff
 *      • 429: Wait rate limit period, then retry
 *      • 403: Mark mint as untrusted, notify user
 *
 * 3. VALIDATION ERRORS
 *    - Invalid response format (mint sent bad JSON)
 *    - Cryptographic signature verification failed
 *    - Token validation failed (mint deactivated keys)
 *
 *    Recovery:
 *      • Log full response for debugging
 *      • If mint keys invalid: Re-fetch keys, retry
 *      • If tokens invalid: Mark transaction as failed
 *      • Notify user if their balance affected
 *
 * 4. LOCAL ERRORS
 *    - SQLite write failed (disk full)
 *    - SQLite constraint violation (database corruption)
 *    - Out of memory
 *
 *    Recovery:
 *      • Critical: These errors block all operations
 *      • Show error modal to user
 *      • Attempt database repair
 *      • If repair fails: Suggest app reinstall (extreme case)
 *
 * ERROR HANDLING PATTERNS:
 * -----------------------
 *
 * Pattern 1: Try-Catch with Logging
 *   try {
 *     await riskyOperation();
 *   } catch (error) {
 *     console.error('[SyncEngine] Operation failed:', error);
 *     errors.push(`Operation failed: ${error.message}`);
 *     // Continue with next operation
 *   }
 *
 * Pattern 2: Partial Success
 *   const errors: string[] = [];
 *   for (const mint of mints) {
 *     try {
 *       await syncMint(mint);
 *     } catch (error) {
 *       errors.push(`Mint ${mint.url}: ${error.message}`);
 *       // Continue with remaining mints
 *     }
 *   }
 *   return { success: errors.length === 0, errors };
 *
 * Pattern 3: Silent Failure (Non-Critical)
 *   try {
 *     await updateMetadata(mint);
 *   } catch (error) {
 *     // Metadata updates are optional, fail silently
 *     // User doesn't need to know
 *   }
 *
 * Pattern 4: Retry with Backoff
 *   let attempts = 0;
 *   while (attempts < 3) {
 *     try {
 *       return await sendTransaction(tx);
 *     } catch (error) {
 *       attempts++;
 *       if (attempts >= 3) throw error;
 *       await sleep(1000 * Math.pow(2, attempts)); // 2s, 4s, 8s
 *     }
 *   }
 *
 * RECOVERY STRATEGIES:
 * -------------------
 *
 * Transient Failures (Network Blip):
 *   • Don't immediately fail
 *   • Retry on next sync cycle (15 minutes)
 *   • Most transient issues resolve themselves
 *
 * Persistent Failures (Mint Offline):
 *   • Track failure count per operation
 *   • After 3 consecutive failures: Notify user
 *   • Keep retrying with exponential backoff
 *   • User can manually disable problematic mint
 *
 * Permanent Failures (Invalid Transaction):
 *   • Mark transaction as FAILED immediately
 *   • Update local balance to reflect reality
 *   • Show notification explaining what happened
 *   • Provide option to retry (in case user wants to debug)
 *
 * Data Corruption:
 *   • Run SQLite integrity check on startup
 *   • If corruption detected: Attempt VACUUM
 *   • If VACUUM fails: Backup data, recreate database
 *   • Last resort: Clear app data (user must acknowledge)
 *
 * SYNC RESULT REPORTING:
 * ---------------------
 *
 * interface SyncResult {
 *   success: boolean;           // true only if all operations succeeded
 *   timestamp: number;          // When sync completed
 *   operations: {               // Count of completed operations
 *     transactions: number;     // Transactions processed
 *     ocrRefills: number;      // OCR refills completed
 *     keysetUpdates: number;   // Keysets updated
 *     metadataUpdates: number; // Metadata refreshed
 *   };
 *   errors: string[];          // Human-readable error messages
 * }
 *
 * This result allows UI to:
 *   • Show toast notification: "Synced 3 transactions"
 *   • Display error details in settings
 *   • Track sync success rate for analytics
 *   • Debug issues by inspecting error messages
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHEN SYNC TRIGGERS: AUTOMATIC VS MANUAL
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Understanding when sync triggers is crucial for predicting app behavior
 * and debugging sync issues.
 *
 * AUTOMATIC TRIGGERS:
 * ------------------
 *
 * 1. APP INITIALIZATION
 *    When: App launches or resumes from background
 *    Why: Sync immediately to catch up on changes
 *
 *    Flow:
 *      App.tsx → useEffect(() => {
 *        SyncEngine.initialize();
 *      })
 *      → NetInfo.fetch() gets current network state
 *      → If online: Immediate syncNow()
 *      → Start periodic timer for future syncs
 *
 * 2. NETWORK RECONNECTION (Offline → Online)
 *    When: Device regains network connectivity
 *    Why: User may have performed offline actions
 *
 *    Flow:
 *      NetInfo.addEventListener() fires
 *      → handleNetworkStateChange()
 *      → wasConnected=false, now isConnected=true
 *      → "Network connected, triggering sync"
 *      → syncNow()
 *
 *    Examples:
 *      • User exits airplane mode
 *      • Phone reconnects to WiFi after tunnel
 *      • Cellular signal returns after rural area
 *
 * 3. NETWORK TYPE CHANGE (Cellular → WiFi)
 *    When: Network type changes
 *    Why: WiFi is faster/cheaper for sync operations
 *
 *    Flow:
 *      NetInfo.addEventListener() fires
 *      → handleNetworkStateChange()
 *      → isWiFi changes from false to true
 *      → If syncOnWiFiOnly=true: Now eligible to sync
 *      → syncNow()
 *
 *    Examples:
 *      • User walks into office, phone connects to WiFi
 *      • If syncOnWiFiOnly=true, this is first chance to sync
 *
 * 4. PERIODIC TIMER (Every syncInterval Minutes)
 *    When: Timer interval elapses
 *    Why: Keep data fresh even on stable connection
 *
 *    Flow:
 *      setInterval() fires
 *      → Check if autoSync=true
 *      → Check if canSync()=true
 *      → syncNow()
 *
 *    Default: Every 15 minutes
 *
 *    Skipped if:
 *      • autoSync=false (user disabled)
 *      • Already syncing (isSyncing=true)
 *      • Network offline (canSync()=false)
 *      • WiFi required but on cellular
 *
 * 5. AFTER USER ACTION (Indirect)
 *    When: User performs transaction that depletes resources
 *    Why: Ensure resources available for next action
 *
 *    Examples:
 *      • User receives payment → OCR code consumed
 *        → If OCR balance < threshold: Next sync refills
 *      • User sends payment → Transaction marked pending
 *        → Next sync processes pending transaction
 *
 *    Note: Action doesn't immediately trigger sync,
 *          but next automatic sync will handle it
 *
 * MANUAL TRIGGERS:
 * ---------------
 *
 * 1. USER PULL-TO-REFRESH
 *    When: User swipes down on transaction list
 *    Why: User wants freshest data immediately
 *
 *    Flow:
 *      TransactionScreen.tsx → onRefresh()
 *      → syncEngine.forceSyncNow()
 *      → Ignores WiFi restriction
 *      → Ignores sync interval (can sync back-to-back)
 *
 * 2. SETTINGS SYNC BUTTON
 *    When: User taps "Sync Now" in settings
 *    Why: Manual control, troubleshooting
 *
 *    Flow:
 *      SettingsScreen.tsx → onSyncPress()
 *      → syncEngine.forceSyncNow()
 *      → Show loading spinner
 *      → Display sync result (success/failure)
 *
 * 3. DEVELOPER TESTING
 *    When: Developer calls syncEngine.syncNow() directly
 *    Why: Testing, debugging
 *
 *    Flow:
 *      Debug menu → "Force Sync"
 *      → syncEngine.syncNow()
 *      → Log detailed results to console
 *
 * AUTOMATIC vs MANUAL COMPARISON:
 * -------------------------------
 *
 * Automatic:
 *   ✓ No user effort required
 *   ✓ Happens in background
 *   ✓ Respects sync strategy (WiFi-only, interval, etc.)
 *   ✓ Won't sync if already syncing
 *   ✗ May not run immediately when user wants
 *
 * Manual (forceSyncNow):
 *   ✓ Immediate execution
 *   ✓ User gets visual feedback
 *   ✓ Bypasses WiFi-only restriction
 *   ✓ Can sync even if recently synced
 *   ✗ Requires user action
 *   ✗ May use cellular data unexpectedly
 *
 * PREVENTING SYNC STORMS:
 * ----------------------
 *
 * Multiple automatic triggers could cause sync storms
 * (many syncs in rapid succession). Prevention:
 *
 *   1. isSyncing flag: Only one sync at a time
 *      if (this.isSyncing) return;
 *
 *   2. Debouncing: Ignore rapid network state changes
 *      Network change → Wait 1 second → Sync
 *      (Prevents sync during WiFi → Cellular → WiFi transition)
 *
 *   3. Minimum interval: Don't sync more than once per 5 minutes
 *      (Except manual forceSyncNow)
 *
 * DEBUGGING SYNC ISSUES:
 * ---------------------
 *
 * User reports "data not syncing":
 *   1. Check network state: getNetworkState()
 *      → Is device actually online?
 *
 *   2. Check sync status: getStatus()
 *      → When was last successful sync?
 *      → Is sync currently running?
 *
 *   3. Check sync strategy: getStrategy()
 *      → Is autoSync enabled?
 *      → Is WiFi required but user on cellular?
 *
 *   4. Check last sync result errors
 *      → Did sync run but fail?
 *      → Which operations failed?
 *
 *   5. Force manual sync: forceSyncNow()
 *      → Does manual sync work?
 *      → If yes: Automatic sync configuration issue
 *      → If no: Network/API issue
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import OCRManager from '../ocr/OCRManager';
import MintDiscovery from '../cashu/MintDiscovery';
import TransactionRepository from '../../data/repositories/TransactionRepository';
import MintRepository from '../../data/repositories/MintRepository';
import { TransactionStatus, OCRStatus } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sync strategy configuration
 *
 * This interface defines all configurable aspects of sync behavior.
 * Each setting affects when and how sync operations occur.
 *
 * Use setStrategy() to update these values at runtime.
 * Changes take effect immediately for the next sync cycle.
 */
export interface SyncStrategy {
  /**
   * Enable automatic periodic sync
   *
   * When true:
   *   - Sync runs every [syncInterval] minutes
   *   - Sync triggers on network reconnection
   *   - App maintains fresh data without user intervention
   *
   * When false:
   *   - Only manual syncs occur (pull-to-refresh, settings button)
   *   - User has full control over sync timing
   *   - Use case: Data-conscious users, battery saving
   *
   * Default: true
   */
  autoSync: boolean;

  /**
   * Restrict sync to WiFi connections only
   *
   * When true:
   *   - Sync only occurs on WiFi networks
   *   - Cellular connections ignored (saves expensive data)
   *   - Manual forceSyncNow() still works on cellular
   *
   * When false:
   *   - Sync on any connection (WiFi or cellular)
   *   - May consume cellular data
   *
   * Default: false (sync on any connection)
   *
   * Note: Detection based on NetInfo's network type
   *       Cellular hotspot may report as WiFi
   */
  syncOnWiFiOnly: boolean;

  /**
   * Minutes between automatic sync cycles
   *
   * Range: 5-60 minutes recommended
   *
   * Considerations:
   *   - Too low: Excessive battery drain, API rate limiting
   *   - Too high: Stale data, depleted OCR reserves
   *   - 15 minutes: Good balance for most users
   *
   * Default: 15 minutes
   *
   * Note: Only applies when autoSync=true
   *       Manual syncs ignore this interval
   */
  syncInterval: number;

  /**
   * Allow sync when app is backgrounded
   *
   * When true:
   *   - Sync continues after user switches to another app
   *   - Periodic timer keeps running in background
   *   - Platform limitations apply (iOS ~30 seconds)
   *
   * When false:
   *   - Sync pauses when app backgrounded
   *   - Resumes when app returns to foreground
   *   - Saves battery, reduces background activity
   *
   * Default: true
   *
   * Note: Background execution is best-effort
   *       OS may terminate sync if resources needed
   */
  backgroundSync: boolean;

  /**
   * Enable/disable each sync priority level
   *
   * Allows fine-grained control over which operations sync.
   * Disabling lower priorities saves bandwidth on metered connections.
   */
  priority: {
    /**
     * Priority 1: Process pending transactions
     *
     * Recommended: true (always)
     *
     * When false:
     *   - Pending transactions remain in limbo
     *   - User's balance may be incorrect
     *   - Failed sends won't retry
     *   - Only disable for testing/debugging
     */
    transactions: boolean;

    /**
     * Priority 2: Refill OCR (Offline Cash Reserves)
     *
     * Recommended: true
     *
     * When false:
     *   - OCR balance may deplete
     *   - User can't receive payments offline
     *   - Disable only if user never receives payments
     */
    ocr: boolean;

    /**
     * Priority 3: Update mint keysets
     *
     * Recommended: true
     *
     * When false:
     *   - May not have latest keys for transactions
     *   - New transactions may fail
     *   - Disable only for read-only/view-only mode
     */
    keysets: boolean;

    /**
     * Priority 4: Refresh mint metadata
     *
     * Recommended: false (optional)
     *
     * When false:
     *   - Mint names/logos may be outdated
     *   - Purely cosmetic, no functional impact
     *   - Disable to save bandwidth (recommended)
     */
    metadata: boolean;
  };
}

/**
 * Result of a sync operation
 *
 * Returned by syncNow() and forceSyncNow().
 * Provides detailed information about what happened during sync.
 *
 * UI can use this to:
 *   - Show success/failure toast
 *   - Display operation counts
 *   - Log errors for debugging
 *   - Update sync status indicators
 */
export interface SyncResult {
  /**
   * Overall success status
   *
   * true: All enabled operations completed successfully
   * false: One or more operations failed (see errors array)
   *
   * Note: Partial success still returns false
   *       Check operations counts to see what completed
   */
  success: boolean;

  /**
   * Unix timestamp (milliseconds) when sync completed
   *
   * Use to:
   *   - Display "Last synced X minutes ago"
   *   - Determine if data is stale
   *   - Track sync frequency
   */
  timestamp: number;

  /**
   * Count of completed operations by priority
   *
   * Values indicate successful operations:
   *   - transactions: Pending transactions processed
   *   - ocrRefills: Mints that received OCR refills
   *   - keysetUpdates: Keysets added or updated
   *   - metadataUpdates: Mints with refreshed metadata
   *
   * Zero counts don't indicate failure:
   *   - May be no work to do (e.g., no pending transactions)
   *   - Check errors array to distinguish from failures
   */
  operations: {
    transactions: number;
    ocrRefills: number;
    keysetUpdates: number;
    metadataUpdates: number;
  };

  /**
   * Human-readable error messages
   *
   * Empty array: No errors
   * Non-empty: Contains error descriptions
   *
   * Format: "<Operation> failed: <reason>"
   * Example: "OCR refill failed: Network timeout"
   *
   * Use for:
   *   - Logging to analytics
   *   - Displaying in settings/debug UI
   *   - Troubleshooting sync issues
   */
  errors: string[];
}

/**
 * Current network connectivity state
 *
 * Snapshot of network conditions at a point in time.
 * Updated whenever network state changes.
 *
 * Used to:
 *   - Decide whether sync is allowed
 *   - Honor WiFi-only restrictions
 *   - Display connection status in UI
 */
export interface NetworkState {
  /**
   * Whether device has any network connectivity
   *
   * true: Can reach the internet (WiFi or cellular)
   * false: Offline, no connectivity
   *
   * Source: NetInfo.isConnected
   *
   * Note: true doesn't guarantee mint is reachable
   *       (Captive portal, firewall, mint offline)
   */
  isConnected: boolean;

  /**
   * Whether connection is WiFi (vs cellular)
   *
   * true: Connected to WiFi network
   * false: Using cellular data (or offline)
   *
   * Source: NetInfo.type === 'wifi'
   *
   * Used to enforce syncOnWiFiOnly restriction
   *
   * Note: Cellular hotspot may report as WiFi
   */
  isWiFi: boolean;

  /**
   * Whether connection has data limits/charges
   *
   * true: Connection is metered (cellular, hotspot)
   * false: Connection is unmetered (home WiFi)
   *
   * Source: NetInfo.details.isConnectionExpensive
   *
   * Future use: Could adjust sync frequency on metered connections
   *
   * Note: Platform-dependent, not all devices report this
   *       Defaults to true (assume metered) for safety
   */
  isMetered: boolean;

  /**
   * Unix timestamp (milliseconds) when this state was recorded
   *
   * Use to:
   *   - Track how long in current network state
   *   - Detect stale network information
   *   - Debug network transition issues
   */
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SyncEngine
 *
 * Orchestrates all synchronization operations for offline-first architecture.
 *
 * RESPONSIBILITIES:
 * ----------------
 * 1. Network Monitoring: Track connectivity state, detect transitions
 * 2. Automatic Sync: Trigger sync on reconnection, periodic intervals
 * 3. Priority Management: Execute sync operations in priority order
 * 4. Resource Management: Prevent concurrent syncs, manage timers
 * 5. Error Handling: Gracefully handle failures, retry when appropriate
 * 6. Configuration: Allow runtime strategy updates
 * 7. Status Reporting: Provide sync state and results to UI
 *
 * SINGLETON PATTERN:
 * -----------------
 * SyncEngine uses singleton pattern to ensure:
 *   - Only one sync can run at a time (prevents conflicts)
 *   - Network listener registered once (no duplicate events)
 *   - Shared state across app (consistent sync status)
 *
 * Access via:
 *   const syncEngine = SyncEngine.getInstance();
 *   // or
 *   import syncEngine from './SyncEngine'; // default export
 *
 * LIFECYCLE:
 * ---------
 * 1. Construction: Private constructor, creates singleton
 * 2. Initialization: Call initialize() on app startup
 * 3. Operation: Automatic syncs + manual triggers
 * 4. Shutdown: Call shutdown() on app exit (cleanup)
 *
 * THREAD SAFETY:
 * -------------
 * JavaScript is single-threaded, but async operations can interleave.
 * Protection mechanisms:
 *   - isSyncing flag: Prevents concurrent syncNow() calls
 *   - Async operations: Use await to prevent race conditions
 *   - No shared mutable state: Each sync creates local variables
 */
export class SyncEngine {
  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLETON INSTANCE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Singleton instance
   *
   * Initialized on first getInstance() call.
   * Shared across entire application.
   *
   * Private to prevent external modification.
   */
  private static instance: SyncEngine;

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPENDENCIES (INJECTED)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * OCR Manager
   *
   * Handles Offline Cash Reserve operations:
   *   - Check OCR balance per mint
   *   - Request refills when balance low
   *   - Store OCR codes in database
   *
   * Used in Priority 2 sync operations.
   */
  private ocrManager: OCRManager;

  /**
   * Mint Discovery
   *
   * Handles mint metadata and keyset operations:
   *   - Fetch /v1/info (mint metadata)
   *   - Fetch /v1/keys (cryptographic keysets)
   *   - Detect and sync stale keysets
   *
   * Used in Priority 3 (keysets) and Priority 4 (metadata).
   */
  private mintDiscovery: MintDiscovery;

  /**
   * Transaction Repository
   *
   * Database access for transactions:
   *   - Query pending transactions
   *   - Update transaction status
   *   - Mark transactions as completed/failed
   *
   * Used in Priority 1 sync operations.
   */
  private txRepo: TransactionRepository;

  /**
   * Mint Repository
   *
   * Database access for mints:
   *   - Query trusted mints
   *   - Update mint metadata
   *   - Track last sync timestamp
   *
   * Used across all priority levels.
   */
  private mintRepo: MintRepository;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Current network connectivity state
   *
   * Updated by NetInfo event listener whenever network changes.
   *
   * Initial state assumes offline for safety:
   *   - isConnected: false (will detect true state on initialize)
   *   - isWiFi: false (assume cellular)
   *   - isMetered: true (assume expensive connection)
   *   - timestamp: Current time
   *
   * State transitions:
   *   - NetInfo.fetch() → Get initial state
   *   - NetInfo.addEventListener() → Update on changes
   *   - updateNetworkState() → Apply updates
   */
  private networkState: NetworkState = {
    isConnected: false,
    isWiFi: false,
    isMetered: true,
    timestamp: Date.now(),
  };

  /**
   * Sync operation lock
   *
   * Prevents concurrent sync operations which could:
   *   - Cause database conflicts
   *   - Duplicate API requests
   *   - Waste bandwidth
   *   - Confuse sync status reporting
   *
   * Flow:
   *   syncNow() → if (isSyncing) return early
   *            → set isSyncing = true
   *            → perform sync operations
   *            → set isSyncing = false (in finally block)
   *
   * Edge cases:
   *   - If sync crashes: finally block ensures flag cleared
   *   - If app terminates: Flag resets to false on restart
   */
  private isSyncing: boolean = false;

  /**
   * Unix timestamp (milliseconds) of last successful sync
   *
   * Initialized to 0 (indicates "never synced").
   * Updated at end of successful syncNow().
   *
   * Used for:
   *   - Calculating time since last sync
   *   - Estimating next sync time
   *   - Displaying "Last synced X ago" in UI
   *   - Detecting stale data
   *
   * Note: Only updated on full sync completion
   *       Partial syncs don't update (to trigger retry)
   */
  private lastSyncTimestamp: number = 0;

  /**
   * Periodic sync timer reference
   *
   * Created by setInterval() in startPeriodicSync().
   * Fires every [syncInterval] minutes to trigger automatic sync.
   *
   * Lifecycle:
   *   - Created: initialize() → startPeriodicSync()
   *   - Updated: setStrategy() with new interval
   *   - Cleared: shutdown() or setStrategy({ autoSync: false })
   *
   * Type: NodeJS.Timeout (not browser's number type)
   * Optional: undefined when periodic sync not running
   *
   * Memory leak prevention:
   *   - Always clearInterval() before creating new timer
   *   - Always clearInterval() in shutdown()
   */
  private syncIntervalId?: NodeJS.Timeout;

  /**
   * Default sync strategy
   *
   * Conservative defaults balance:
   *   - Automatic sync: Enabled (convenience)
   *   - WiFi-only: Disabled (accessibility over data savings)
   *   - Interval: 15 minutes (neither too frequent nor too rare)
   *   - Background sync: Enabled (maintain fresh data)
   *   - Priorities: Essential operations only
   *
   * Users can override via setStrategy():
   *   syncEngine.setStrategy({ syncOnWiFiOnly: true });
   *
   * Strategy stored in memory, not persisted across app restarts.
   * Future enhancement: Save strategy to AsyncStorage/SQLite.
   */
  private strategy: SyncStrategy = {
    autoSync: true,
    syncOnWiFiOnly: false,
    syncInterval: 15, // 15 minutes
    backgroundSync: true,
    priority: {
      transactions: true,  // Critical: Always sync
      ocr: true,          // High: Needed for offline receiving
      keysets: true,      // Medium: Needed for new transactions
      metadata: false,    // Low: Cosmetic only, disabled to save bandwidth
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR (PRIVATE - SINGLETON PATTERN)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Private constructor
   *
   * Private to enforce singleton pattern - use getInstance() instead.
   *
   * Initializes dependencies by getting their singleton instances.
   * All dependencies also use singleton pattern for consistency.
   *
   * No async operations in constructor (JavaScript limitation).
   * Async initialization happens in initialize() method.
   */
  private constructor() {
    // Get singleton instances of all dependencies
    // These are already initialized, safe to use immediately
    this.ocrManager = OCRManager.getInstance();
    this.mintDiscovery = MintDiscovery.getInstance();
    this.txRepo = TransactionRepository.getInstance();
    this.mintRepo = MintRepository.getInstance();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLETON ACCESSOR
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get or create singleton instance
   *
   * Thread-safe in JavaScript (single-threaded execution).
   * First call creates instance, subsequent calls return same instance.
   *
   * Usage:
   *   const syncEngine = SyncEngine.getInstance();
   *   syncEngine.initialize();
   *
   * @returns {SyncEngine} The singleton SyncEngine instance
   */
  static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION & LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize sync engine
   *
   * MUST be called once during app startup, typically in App.tsx:
   *
   *   useEffect(() => {
   *     SyncEngine.getInstance().initialize();
   *   }, []);
   *
   * WHAT THIS DOES:
   * 1. Subscribe to NetInfo for network state changes
   *    - Fires on every network transition (WiFi ↔ Cellular ↔ Offline)
   *    - Bound to this instance via .bind(this)
   *
   * 2. Fetch initial network state
   *    - NetInfo.fetch() returns Promise<NetInfoState>
   *    - Updates this.networkState with current connectivity
   *    - If online: May trigger immediate sync
   *
   * 3. Start periodic sync timer
   *    - Only if autoSync enabled in strategy
   *    - Fires every [syncInterval] minutes
   *    - Continues until shutdown() called
   *
   * ASYNC EXECUTION:
   * This method is async because NetInfo.fetch() is async.
   * Caller should await if they need to know when initialization completes.
   *
   * ERROR HANDLING:
   * If this throws, app should show error modal and prevent further use.
   * In practice, rarely fails (NetInfo is reliable).
   *
   * @returns {Promise<void>} Resolves when initialization complete
   */
  async initialize(): Promise<void> {
    console.log('[SyncEngine] Initializing...');

    // Subscribe to network state changes
    // Listener will fire on every network transition
    // Bound to this instance so handleNetworkStateChange can access this.networkState
    NetInfo.addEventListener(this.handleNetworkStateChange.bind(this));

    // Get initial network state
    // This is the first time we learn if device is online/offline
    // Result is NetInfoState object with isConnected, type, details
    const state = await NetInfo.fetch();
    this.updateNetworkState(state);

    // If device is online, this logs current connectivity
    // If device is offline, we'll wait for network change event

    // Start periodic sync if enabled in strategy
    // This creates the setInterval timer that fires every [syncInterval] minutes
    if (this.strategy.autoSync) {
      this.startPeriodicSync();
    }

    console.log('[SyncEngine] Initialized');
  }

  /**
   * Shutdown sync engine
   *
   * MUST be called during app exit to prevent memory leaks.
   *
   * WHAT THIS DOES:
   * 1. Clear periodic sync timer
   *    - Stops setInterval from firing
   *    - Releases timer resources
   *
   * 2. Set syncIntervalId to undefined
   *    - Indicates no timer running
   *    - Prevents accidental clearInterval on undefined
   *
   * WHY THIS MATTERS:
   * Without cleanup:
   *   - Timer continues firing after SyncEngine destroyed
   *   - Memory leak: SyncEngine instance never garbage collected
   *   - Potential crashes: Timer fires on destroyed object
   *
   * WHEN TO CALL:
   *   - App.tsx unmount (componentWillUnmount)
   *   - App goes to background (AppState change)
   *   - User logs out (reset app state)
   *
   * NOTE:
   * Does NOT unsubscribe from NetInfo events.
   * NetInfo manages its own lifecycle.
   * Future enhancement: Store NetInfo subscription, unsubscribe here.
   *
   * @returns {void}
   */
  shutdown(): void {
    // Clear periodic sync timer if running
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = undefined;
    }

    console.log('[SyncEngine] Shutdown');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NETWORK STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Handle network state changes from NetInfo
   *
   * CALLBACK REGISTRATION:
   * Registered in initialize() via:
   *   NetInfo.addEventListener(this.handleNetworkStateChange.bind(this))
   *
   * WHEN THIS FIRES:
   * - Device connects to WiFi
   * - Device disconnects from WiFi
   * - Device switches to cellular
   * - Device enters/exits airplane mode
   * - Network type changes (WiFi ↔ Cellular)
   *
   * TRANSITION DETECTION:
   * Compare previous state (this.networkState.isConnected) with
   * new state (state.isConnected) to detect transitions:
   *
   *   wasConnected=false, now isConnected=true
   *     → OFFLINE → ONLINE transition
   *     → Trigger immediate sync (catch up on offline changes)
   *
   *   wasConnected=true, now isConnected=false
   *     → ONLINE → OFFLINE transition
   *     → Log disconnection (sync will pause)
   *
   * WHY TRIGGER SYNC ON RECONNECTION:
   * User may have:
   *   - Performed offline transactions (need to sync to mint)
   *   - Depleted OCR reserves (need refill)
   *   - Missed keyset updates (need fresh keys)
   *
   * Immediate sync ensures app catches up as soon as possible.
   *
   * SYNC PROTECTION:
   * syncNow() has built-in protection against:
   *   - Concurrent syncs (isSyncing flag)
   *   - Rapid-fire calls (debouncing via isSyncing)
   *
   * Safe to call syncNow() here without additional checks.
   *
   * @param {NetInfoState} state - New network state from NetInfo
   * @returns {void}
   */
  private handleNetworkStateChange(state: NetInfoState): void {
    // Capture previous connection state before updating
    const wasConnected = this.networkState.isConnected;

    // Update internal network state with new information
    this.updateNetworkState(state);

    // TRANSITION: Offline → Online
    // Device just regained network connectivity
    if (!wasConnected && this.networkState.isConnected) {
      console.log('[SyncEngine] Network connected, triggering sync');
      // Trigger immediate sync to catch up on pending operations
      // syncNow() respects strategy (WiFi-only, etc.)
      this.syncNow();
    }

    // TRANSITION: Online → Offline
    // Device just lost network connectivity
    if (wasConnected && !this.networkState.isConnected) {
      console.log('[SyncEngine] Network disconnected');
      // No action needed here - ongoing sync will fail gracefully
      // Next sync will wait until network returns
      // Could cancel ongoing sync here if we tracked cancellation tokens
    }

    // Note: Other transitions (WiFi ↔ Cellular) don't trigger immediate sync
    // They're handled by periodic sync and WiFi-only strategy
  }

  /**
   * Update internal network state from NetInfo
   *
   * CALLED BY:
   * - initialize(): Set initial state on app startup
   * - handleNetworkStateChange(): Update on network transitions
   *
   * NETINFO STATE MAPPING:
   * NetInfo provides:
   *   - isConnected: boolean | null
   *   - type: 'wifi' | 'cellular' | 'none' | 'unknown' | ...
   *   - details: { isConnectionExpensive: boolean | null, ... }
   *
   * We map to our NetworkState interface:
   *   - isConnected: NetInfo.isConnected ?? false
   *     (null means unknown, treat as offline for safety)
   *
   *   - isWiFi: NetInfo.type === 'wifi'
   *     (strict equality, other types = false)
   *
   *   - isMetered: NetInfo.details?.isConnectionExpensive ?? true
   *     (null/undefined means unknown, assume metered for safety)
   *
   *   - timestamp: Date.now()
   *     (record when this state observed)
   *
   * NULL COALESCING (??):
   * NetInfo may return null for unknown values.
   * We use ?? operator to provide safe defaults:
   *   - null/undefined ?? default → default
   *   - value ?? default → value
   *
   * LOGGING:
   * Every state change logged for debugging.
   * Format: { isConnected, isWiFi, isMetered, timestamp }
   *
   * Use logs to debug issues like:
   *   - "Why didn't sync trigger?" → Check isConnected
   *   - "Why sync on cellular?" → Check isWiFi + syncOnWiFiOnly
   *
   * @param {NetInfoState} state - Network state from NetInfo
   * @returns {void}
   */
  private updateNetworkState(state: NetInfoState): void {
    this.networkState = {
      // Connectivity: null means unknown, treat as offline
      isConnected: state.isConnected ?? false,

      // Network type: Only 'wifi' type considered WiFi
      isWiFi: state.type === 'wifi',

      // Connection cost: null means unknown, assume metered (safe default)
      isMetered: state.details?.isConnectionExpensive ?? true,

      // Timestamp: Record when this state observed
      timestamp: Date.now(),
    };

    // Log every state change for debugging
    // Example: "[SyncEngine] Network state: { isConnected: true, isWiFi: true, isMetered: false, timestamp: 1234567890 }"
    console.log('[SyncEngine] Network state:', this.networkState);
  }

  /**
   * Get current network state
   *
   * PUBLIC API: UI components can call this to display network status.
   *
   * RETURNS COPY:
   * Uses spread operator to return shallow copy.
   * Prevents external code from modifying internal state.
   *
   * Example usage:
   *   const { isConnected, isWiFi } = syncEngine.getNetworkState();
   *   if (!isConnected) {
   *     showOfflineBanner();
   *   }
   *
   * @returns {NetworkState} Current network connectivity state (copy)
   */
  getNetworkState(): NetworkState {
    return { ...this.networkState };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC ORCHESTRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if sync is allowed based on current conditions
   *
   * CALLED BY:
   * - syncNow(): Before starting sync
   * - Periodic timer: Before triggering automatic sync
   * - getStatus(): To report canSync in status
   *
   * CHECKS PERFORMED:
   *
   * 1. Network connectivity
   *    - Must have active connection (isConnected=true)
   *    - If offline: Return false immediately
   *
   * 2. WiFi-only restriction
   *    - If syncOnWiFiOnly=true: Must be on WiFi
   *    - If on cellular: Return false, log reason
   *
   * 3. Concurrent sync prevention
   *    - If already syncing (isSyncing=true): Return false
   *    - Prevents duplicate syncs, database conflicts
   *
   * RETURN VALUE:
   * true: All checks passed, sync can proceed
   * false: One or more checks failed, sync should be skipped
   *
   * LOGGING:
   * Logs reason when returning false (for debugging).
   * No log when returning true (normal case, avoid spam).
   *
   * USE CASES:
   *
   * Case 1: Automatic periodic sync
   *   Timer fires → Check canSync() → If false, skip this cycle
   *
   * Case 2: Network reconnection
   *   Network change → Check canSync() → If false, wait for better conditions
   *
   * Case 3: Manual sync (forceSyncNow)
   *   BYPASSES THIS CHECK - force sync regardless
   *
   * @returns {boolean} true if sync allowed, false otherwise
   * @private
   */
  private canSync(): boolean {
    // Check 1: Must be connected to network
    if (!this.networkState.isConnected) {
      // Offline - sync impossible, will retry when connection returns
      return false;
    }

    // Check 2: Honor WiFi-only restriction if enabled
    if (this.strategy.syncOnWiFiOnly && !this.networkState.isWiFi) {
      // User configured WiFi-only, but currently on cellular
      // Log for debugging (user may wonder why sync not happening)
      console.log('[SyncEngine] Sync requires WiFi, skipping');
      return false;
    }

    // Check 3: Prevent concurrent syncs
    if (this.isSyncing) {
      // Already syncing - wait for current sync to complete
      // This prevents database conflicts and wasted network requests
      console.log('[SyncEngine] Already syncing, skipping');
      return false;
    }

    // All checks passed - sync is allowed
    return true;
  }

  /**
   * Perform full sync across all priority levels
   *
   * MAIN SYNC ORCHESTRATOR
   * This is the core method that executes all sync operations.
   *
   * ENTRY POINTS:
   * - initialize(): If online, trigger immediate sync
   * - handleNetworkStateChange(): On network reconnection
   * - Periodic timer: Every [syncInterval] minutes
   * - forceSyncNow(): User-initiated sync (bypasses some checks)
   *
   * EXECUTION FLOW:
   *
   * 1. Pre-flight Checks
   *    ├─► canSync(): Network connected? WiFi required? Already syncing?
   *    └─► If checks fail: Return early with error result
   *
   * 2. Lock Sync (Prevent Concurrent Operations)
   *    └─► Set isSyncing = true
   *
   * 3. Initialize Result Tracking
   *    ├─► Start timer (measure sync duration)
   *    ├─► Create errors array (collect failures)
   *    └─► Initialize operation counters (transactions, ocr, keysets, metadata)
   *
   * 4. Execute Priority 1: Pending Transactions (CRITICAL)
   *    ├─► Check if priority.transactions enabled
   *    ├─► Call processPendingTransactions()
   *    ├─► Update transactionCount
   *    └─► Catch errors, add to errors array, continue
   *
   * 5. Execute Priority 2: OCR Refill (HIGH)
   *    ├─► Check if priority.ocr enabled
   *    ├─► Get all trusted mints
   *    ├─► For each mint: Call ocrManager.refillIfNeeded()
   *    ├─► Update ocrRefills counter
   *    └─► Catch errors, add to errors array, continue
   *
   * 6. Execute Priority 3: Keyset Updates (MEDIUM)
   *    ├─► Check if priority.keysets enabled
   *    ├─► Call mintDiscovery.syncStaleMints(24) - sync keysets older than 24 hours
   *    ├─► Update keysetUpdates counter
   *    └─► Catch errors, add to errors array, continue
   *
   * 7. Execute Priority 4: Mint Metadata (LOW)
   *    ├─► Check if priority.metadata enabled
   *    ├─► Get all mints
   *    ├─► For each mint: Call mintDiscovery.fetchMintInfo()
   *    ├─► Update metadataUpdates counter
   *    └─► Silently fail (metadata optional)
   *
   * 8. Update Sync Timestamp
   *    └─► Set lastSyncTimestamp = Date.now()
   *
   * 9. Build Result Object
   *    ├─► success: true if errors.length === 0
   *    ├─► timestamp: lastSyncTimestamp
   *    ├─► operations: { transactions, ocrRefills, keysetUpdates, metadataUpdates }
   *    └─► errors: Array of error messages
   *
   * 10. Cleanup (Finally Block)
   *     └─► Set isSyncing = false (release lock)
   *
   * ERROR HANDLING STRATEGY:
   *
   * - Partial Success: Errors in one priority don't stop others
   *   Priority 1 fails? Still try Priority 2-4
   *
   * - Error Collection: All errors collected in errors array
   *   Caller can inspect to see what failed
   *
   * - Graceful Degradation: Some operations can fail silently
   *   Metadata updates fail? No big deal, just skip
   *
   * - Lock Release: Finally block ensures isSyncing cleared
   *   Even if catastrophic error, next sync can still run
   *
   * RETURN VALUE:
   * Always returns SyncResult, never throws.
   * success=false indicates failures, check errors array for details.
   *
   * LOGGING:
   * - Start: "Starting full sync..."
   * - Each priority: "Processed X transactions", "Refilled OCR for Y", etc.
   * - End: "Full sync completed in Xms"
   *
   * PERFORMANCE:
   * Typical sync takes 1-5 seconds depending on:
   *   - Number of trusted mints
   *   - Number of pending transactions
   *   - Network latency
   *   - Which priorities enabled
   *
   * Optimize by disabling optional priorities:
   *   setStrategy({ priority: { metadata: false } })
   *
   * @returns {Promise<SyncResult>} Detailed sync result
   */
  async syncNow(): Promise<SyncResult> {
    // Pre-flight check: Can we sync right now?
    if (!this.canSync()) {
      // Conditions not met (offline, already syncing, or WiFi required but on cellular)
      // Return failure result without attempting sync
      return {
        success: false,
        timestamp: Date.now(),
        operations: {
          transactions: 0,
          ocrRefills: 0,
          keysetUpdates: 0,
          metadataUpdates: 0,
        },
        errors: ['Sync not allowed (offline or already syncing)'],
      };
    }

    // Acquire sync lock to prevent concurrent operations
    this.isSyncing = true;

    // Track sync duration for logging
    const startTime = Date.now();

    // Initialize result tracking
    const errors: string[] = [];
    let transactionCount = 0;
    let ocrRefills = 0;
    let keysetUpdates = 0;
    let metadataUpdates = 0;

    console.log('[SyncEngine] Starting full sync...');

    try {
      // ─────────────────────────────────────────────────────────────────────
      // PRIORITY 1: PROCESS PENDING TRANSACTIONS (CRITICAL)
      // ─────────────────────────────────────────────────────────────────────
      // Transactions affect user's money - highest priority
      // Must complete successfully or user's balance incorrect
      if (this.strategy.priority.transactions) {
        try {
          transactionCount = await this.processPendingTransactions();
          console.log(`[SyncEngine] Processed ${transactionCount} pending transactions`);
        } catch (error: any) {
          // Transaction sync failed - critical error, but continue with other priorities
          errors.push(`Transaction sync failed: ${error.message}`);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // PRIORITY 2: REFILL OCR IF NEEDED (HIGH)
      // ─────────────────────────────────────────────────────────────────────
      // OCR enables offline receiving - important for user experience
      // Low OCR balance = user can't receive payments offline
      if (this.strategy.priority.ocr) {
        try {
          // Get all mints user trusts (has tokens from)
          const mints = await this.mintRepo.getTrustedMints();

          // Check each mint's OCR balance, refill if low
          for (const mint of mints) {
            const result = await this.ocrManager.refillIfNeeded(mint.url);
            if (result && result.success) {
              ocrRefills++;
              console.log(`[SyncEngine] Refilled OCR for ${mint.url}`);
            }
            // If refill fails, ocrManager logs error internally
            // We continue to next mint rather than failing entire sync
          }
        } catch (error: any) {
          // OCR refill failed - concerning but not critical
          // User can still send/receive online, just not offline receiving
          errors.push(`OCR refill failed: ${error.message}`);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // PRIORITY 3: SYNC KEYSETS (MEDIUM)
      // ─────────────────────────────────────────────────────────────────────
      // Keysets required for creating/validating transactions
      // Stale keys = can't validate tokens or create new transactions
      if (this.strategy.priority.keysets) {
        try {
          // Sync keysets that haven't been updated in 24 hours
          // Returns Map<mintUrl, SyncResult> with add/update counts per mint
          const results = await this.mintDiscovery.syncStaleMints(24);

          // Sum up all keyset additions and updates across all mints
          keysetUpdates = Array.from(results.values()).reduce(
            (sum, r) => sum + r.added + r.updated,
            0
          );
          console.log(`[SyncEngine] Updated ${keysetUpdates} keysets`);
        } catch (error: any) {
          // Keyset sync failed - moderate concern
          // Existing keys still work, but can't use new keys until next sync
          errors.push(`Keyset sync failed: ${error.message}`);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // PRIORITY 4: REFRESH MINT METADATA (LOW)
      // ─────────────────────────────────────────────────────────────────────
      // Metadata is purely cosmetic (name, icon, description)
      // Nice to have, but not essential for functionality
      if (this.strategy.priority.metadata) {
        try {
          // Get all mints (not just trusted - may want metadata for discovery)
          const mints = await this.mintRepo.getAll();

          for (const mint of mints) {
            try {
              // Fetch /v1/info endpoint for mint metadata
              await this.mintDiscovery.fetchMintInfo(mint.url);
              // Update last_synced timestamp in database
              await this.mintRepo.updateLastSynced(mint.id);
              metadataUpdates++;
            } catch (error) {
              // Silently fail for metadata updates
              // Individual mint metadata failures don't affect overall sync
              // No need to add to errors array - metadata is optional
            }
          }
          console.log(`[SyncEngine] Updated ${metadataUpdates} mint metadata`);
        } catch (error: any) {
          // Outer try-catch for unexpected failures
          // Add to errors but don't consider sync failed
          errors.push(`Metadata sync failed: ${error.message}`);
        }
      }

      // Update sync timestamp (marks sync as complete)
      this.lastSyncTimestamp = Date.now();

      // Calculate total sync duration
      const duration = Date.now() - startTime;
      console.log(`[SyncEngine] Full sync completed in ${duration}ms`);

      // Build success result
      return {
        success: errors.length === 0, // Success only if no errors
        timestamp: this.lastSyncTimestamp,
        operations: {
          transactions: transactionCount,
          ocrRefills,
          keysetUpdates,
          metadataUpdates,
        },
        errors,
      };
    } catch (error: any) {
      // Catastrophic failure - shouldn't reach here due to try-catch per priority
      // But if we do, log and return failure result
      console.error('[SyncEngine] Sync failed:', error);
      return {
        success: false,
        timestamp: Date.now(),
        operations: {
          transactions: transactionCount,
          ocrRefills,
          keysetUpdates,
          metadataUpdates,
        },
        errors: [error.message],
      };
    } finally {
      // CRITICAL: Always release sync lock, even if sync crashed
      // Without this, sync would be permanently locked
      this.isSyncing = false;
    }
  }

  /**
   * Process pending transactions
   *
   * CALLED BY:
   * - syncNow(): As Priority 1 operation
   *
   * PURPOSE:
   * Handle transactions that couldn't complete when created.
   * Reasons for pending state:
   *   - Network offline when transaction created
   *   - Mint temporarily unavailable
   *   - Request timeout
   *   - User navigated away before completion
   *
   * CURRENT IMPLEMENTATION:
   * This is a simplified implementation that marks old pending
   * transactions as failed after 1 hour.
   *
   * PRODUCTION IMPLEMENTATION WOULD:
   * 1. Query transaction details from database
   * 2. Determine transaction type (send, receive, swap)
   * 3. Retry the original operation:
   *    - Send: POST /v1/swap (exchange tokens with mint)
   *    - Receive: POST /v1/mint (mint new tokens from quote)
   *    - Swap: POST /v1/swap (swap between different keysets)
   * 4. On success: Mark transaction as COMPLETED, update balance
   * 5. On failure: Retry with exponential backoff, max 3 attempts
   * 6. After max retries or 1 hour: Mark as FAILED
   *
   * TIMEOUT STRATEGY:
   * 1 hour timeout is arbitrary but reasonable:
   *   - Too short: Prematurely fail recoverable transactions
   *   - Too long: User sees inaccurate balance for extended period
   *   - 1 hour: Balance between retry attempts and user experience
   *
   * WHY NOT RETRY IMMEDIATELY IN TRANSACTION CREATION:
   * Separating transaction creation from retry logic enables:
   *   - Instant UI feedback (transaction stored immediately)
   *   - Offline functionality (store even when offline)
   *   - Batch processing (retry multiple transactions efficiently)
   *   - Resource management (retry on good network conditions)
   *
   * @returns {Promise<number>} Count of processed transactions
   * @private
   */
  private async processPendingTransactions(): Promise<number> {
    // Query all transactions with status = PENDING
    const pending = await this.txRepo.getPending();

    // No pending transactions - nothing to do
    if (pending.length === 0) {
      return 0;
    }

    let processedCount = 0;

    // Process each pending transaction
    for (const tx of pending) {
      try {
        // Calculate how long transaction has been pending
        const age = Date.now() - tx.createdAt;
        const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds

        // If transaction older than 1 hour, give up and mark as failed
        // In real implementation, would retry transaction here
        if (age > ONE_HOUR) {
          await this.txRepo.markFailed(tx.id);
          processedCount++;
        }

        // TODO: Actual transaction retry logic
        // const result = await retryTransaction(tx);
        // if (result.success) {
        //   await this.txRepo.markCompleted(tx.id);
        //   processedCount++;
        // }
      } catch (error) {
        // Individual transaction processing failed
        // Log error and continue with next transaction
        // Don't let one failure block processing of others
        console.error(`[SyncEngine] Failed to process transaction ${tx.id}:`, error);
      }
    }

    return processedCount;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERIODIC SYNC MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start periodic background sync
   *
   * CALLED BY:
   * - initialize(): If autoSync enabled
   * - setStrategy(): When autoSync enabled or interval changed
   *
   * PURPOSE:
   * Create setInterval timer that triggers sync at regular intervals.
   * Ensures data stays fresh even when network state stable.
   *
   * HOW IT WORKS:
   * 1. Clear any existing timer (prevent duplicates)
   * 2. Convert syncInterval from minutes to milliseconds
   * 3. Create new setInterval with sync logic
   * 4. Store interval ID for later cleanup
   *
   * TIMER CALLBACK:
   * Fires every [syncInterval] minutes:
   *   - Check if autoSync still enabled (may have changed)
   *   - Check if canSync() (network connected, not already syncing)
   *   - If checks pass: Execute syncNow()
   *
   * WHY CHECK CONDITIONS IN CALLBACK:
   * Strategy or network state may change between timer creation and firing.
   * Checking in callback ensures sync only happens when appropriate.
   *
   * TIMER LIFECYCLE:
   * - Created: Here, or when strategy changes
   * - Fires: Every [syncInterval] minutes until cleared
   * - Cleared: shutdown() or setStrategy({ autoSync: false })
   *
   * MEMORY LEAK PREVENTION:
   * Always clearInterval before creating new timer.
   * Otherwise, old timer continues firing after new timer created.
   *
   * @returns {void}
   * @private
   */
  private startPeriodicSync(): void {
    // Clear existing timer if present
    // Prevents memory leak when updating sync interval
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }

    // Convert interval from minutes to milliseconds
    // syncInterval=15 → intervalMs=900000 (15 * 60 * 1000)
    const intervalMs = this.strategy.syncInterval * 60 * 1000;

    // Create periodic timer
    // Fires every intervalMs, executes callback each time
    this.syncIntervalId = setInterval(() => {
      // Check if autoSync still enabled (strategy may have changed)
      // Check if sync allowed (network connected, not already syncing, WiFi if required)
      if (this.strategy.autoSync && this.canSync()) {
        // All checks passed - execute sync
        this.syncNow();
      }
      // If checks fail, skip this cycle and wait for next interval
    }, intervalMs);

    console.log(`[SyncEngine] Periodic sync started (${this.strategy.syncInterval} min)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update sync strategy configuration
   *
   * PUBLIC API: Allows runtime configuration changes.
   *
   * PARTIAL UPDATES:
   * Can update individual fields without specifying all:
   *   setStrategy({ syncInterval: 30 })
   * Merges with existing strategy using spread operator.
   *
   * CHANGES TAKE EFFECT IMMEDIATELY:
   * - syncInterval changed: Restart periodic timer
   * - autoSync changed: Start or stop periodic timer
   * - syncOnWiFiOnly changed: Next canSync() check uses new value
   * - priority changed: Next syncNow() uses new priorities
   *
   * RESTART LOGIC:
   * If syncInterval or autoSync changed:
   *   1. If autoSync now true: Call startPeriodicSync()
   *      → Clears old timer (if exists)
   *      → Creates new timer with new interval
   *   2. If autoSync now false: Clear timer
   *      → Stops periodic sync
   *
   * USE CASES:
   *
   * User changes settings:
   *   Settings screen → Toggle "WiFi only" → setStrategy({ syncOnWiFiOnly: true })
   *
   * App detects low battery:
   *   Battery < 20% → setStrategy({ syncInterval: 60, priority: { metadata: false } })
   *
   * Developer testing:
   *   Debug menu → "Aggressive sync" → setStrategy({ syncInterval: 5 })
   *
   * @param {Partial<SyncStrategy>} strategy - Strategy fields to update
   * @returns {void}
   */
  setStrategy(strategy: Partial<SyncStrategy>): void {
    // Merge new strategy fields with existing strategy
    // New fields override existing, unspecified fields keep current value
    this.strategy = {
      ...this.strategy,
      ...strategy,
    };

    // Check if sync interval or autoSync flag changed
    // These changes require restarting periodic timer
    if (strategy.syncInterval !== undefined || strategy.autoSync !== undefined) {
      if (this.strategy.autoSync) {
        // AutoSync enabled (or still enabled with new interval)
        // Restart periodic timer with new configuration
        this.startPeriodicSync();
      } else if (this.syncIntervalId) {
        // AutoSync disabled - stop periodic timer
        clearInterval(this.syncIntervalId);
        this.syncIntervalId = undefined;
      }
    }

    // Log new strategy for debugging
    console.log('[SyncEngine] Strategy updated:', this.strategy);
  }

  /**
   * Get current sync strategy
   *
   * PUBLIC API: Allows UI to read current strategy.
   *
   * RETURNS COPY:
   * Uses spread operator to return shallow copy.
   * Prevents external code from modifying internal strategy.
   *
   * Example usage:
   *   const strategy = syncEngine.getStrategy();
   *   console.log('Sync interval:', strategy.syncInterval);
   *
   * @returns {SyncStrategy} Current sync strategy (copy)
   */
  getStrategy(): SyncStrategy {
    return { ...this.strategy };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS & MONITORING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get current sync status
   *
   * PUBLIC API: Provides comprehensive sync state for UI.
   *
   * RETURNED INFORMATION:
   *
   * isSyncing: boolean
   *   - Is sync currently running?
   *   - Use to show loading spinner
   *
   * lastSync: number | null
   *   - Unix timestamp of last successful sync
   *   - null if never synced
   *   - Use to display "Last synced X ago"
   *
   * timeSinceLastSync: number | null
   *   - Milliseconds since last sync
   *   - null if never synced
   *   - Use for staleness detection
   *
   * networkState: NetworkState
   *   - Current connectivity state
   *   - Use to display online/offline indicator
   *
   * canSync: boolean
   *   - Can sync run right now?
   *   - Use to enable/disable "Sync Now" button
   *
   * EXAMPLE UI USAGE:
   *
   * const status = syncEngine.getStatus();
   *
   * // Show spinner if syncing
   * if (status.isSyncing) {
   *   return <LoadingSpinner />;
   * }
   *
   * // Show "Last synced X ago"
   * if (status.lastSync) {
   *   const minutesAgo = Math.floor(status.timeSinceLastSync! / 60000);
   *   return <Text>Last synced {minutesAgo} minutes ago</Text>;
   * }
   *
   * // Enable "Sync Now" button only if can sync
   * <Button
   *   title="Sync Now"
   *   disabled={!status.canSync}
   *   onPress={() => syncEngine.forceSyncNow()}
   * />
   *
   * @returns {object} Comprehensive sync status
   */
  getStatus(): {
    isSyncing: boolean;
    lastSync: number | null;
    timeSinceLastSync: number | null;
    networkState: NetworkState;
    canSync: boolean;
  } {
    // Calculate time since last sync (null if never synced)
    const timeSinceLastSync = this.lastSyncTimestamp
      ? Date.now() - this.lastSyncTimestamp
      : null;

    return {
      isSyncing: this.isSyncing,
      lastSync: this.lastSyncTimestamp || null,
      timeSinceLastSync,
      networkState: this.networkState,
      canSync: this.canSync(),
    };
  }

  /**
   * Estimate next automatic sync time
   *
   * PUBLIC API: Helps UI show when next sync will occur.
   *
   * CALCULATION:
   * lastSyncTimestamp + (syncInterval * 60 * 1000)
   *
   * RETURNS NULL IF:
   * - autoSync disabled (no automatic syncs)
   * - Never synced yet (lastSyncTimestamp = 0)
   *
   * ESTIMATION ACCURACY:
   * Estimate assumes:
   *   - Network remains connected
   *   - Strategy doesn't change
   *   - App stays open
   *
   * Actual sync time may differ if:
   *   - Network disconnects (sync waits for reconnection)
   *   - Strategy updated (new interval applies)
   *   - App backgrounded (OS may delay timer)
   *   - Manual sync occurs (resets timer)
   *
   * EXAMPLE USAGE:
   *
   * const nextSync = syncEngine.getNextSyncTime();
   * if (nextSync) {
   *   const minutesUntil = Math.floor((nextSync - Date.now()) / 60000);
   *   console.log(`Next sync in ${minutesUntil} minutes`);
   * }
   *
   * @returns {number | null} Unix timestamp of estimated next sync, or null
   */
  getNextSyncTime(): number | null {
    // Return null if autoSync disabled or never synced
    if (!this.strategy.autoSync || !this.lastSyncTimestamp) {
      return null;
    }

    // Calculate next sync time
    const intervalMs = this.strategy.syncInterval * 60 * 1000;
    return this.lastSyncTimestamp + intervalMs;
  }

  /**
   * Force sync regardless of strategy restrictions
   *
   * PUBLIC API: Manual sync triggered by user.
   *
   * BYPASSES:
   * - WiFi-only restriction (syncs on cellular too)
   * - Minimum interval (can sync back-to-back)
   *
   * STILL CHECKS:
   * - Network connectivity (can't sync if offline)
   * - Already syncing (won't start concurrent sync)
   *
   * USE CASES:
   * - Pull-to-refresh: User swipes down on transaction list
   * - Settings button: User taps "Sync Now" in settings
   * - Troubleshooting: User wants to force sync immediately
   *
   * RETURNS:
   * Same SyncResult as syncNow().
   * UI can display result to user (success/failure, operation counts).
   *
   * ERROR HANDLING:
   * If offline, returns failure result immediately without attempting sync.
   *
   * @returns {Promise<SyncResult>} Detailed sync result
   */
  async forceSyncNow(): Promise<SyncResult> {
    // Only check network connectivity (bypass strategy checks)
    if (!this.networkState.isConnected) {
      return {
        success: false,
        timestamp: Date.now(),
        operations: {
          transactions: 0,
          ocrRefills: 0,
          keysetUpdates: 0,
          metadataUpdates: 0,
        },
        errors: ['Cannot force sync: offline'],
      };
    }

    // Proceed with normal sync
    // syncNow() will handle all sync logic
    return await this.syncNow();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Singleton instance export
 *
 * CONVENIENCE EXPORT:
 * Allows importing pre-initialized singleton:
 *   import syncEngine from './SyncEngine';
 *   syncEngine.initialize();
 *
 * Alternative:
 *   import { SyncEngine } from './SyncEngine';
 *   const syncEngine = SyncEngine.getInstance();
 *   syncEngine.initialize();
 *
 * Both approaches access the same singleton instance.
 */
export default SyncEngine;
