/**
 * =============================================================================
 * CashuWalletService.ts
 * =============================================================================
 *
 * OVERVIEW
 * --------
 * This is the main entry point for all Cashu ecash operations in the wallet.
 * It acts as a bridge between the @cashu/cashu-ts library and our offline-first
 * data layer, ensuring all operations are persisted and recoverable.
 *
 * WHAT IS CASHU?
 * --------------
 * Cashu is a Chaumian ecash protocol for Bitcoin. Key concepts:
 *
 * 1. ECASH TOKENS (Proofs)
 *    - Digital bearer tokens that represent Bitcoin value
 *    - Created using blind signatures from a mint
 *    - Can be transferred without the mint knowing who holds them
 *    - "Proof" = the cryptographic proof that you own satoshis at a mint
 *
 * 2. MINTS
 *    - Trusted servers that issue and redeem ecash
 *    - Hold the actual Bitcoin/Lightning funds
 *    - Create blind signatures on user tokens
 *    - Cannot link payments together (privacy!)
 *
 * 3. BLIND SIGNATURES
 *    - Mint signs a "blinded" message, doesn't see the actual token
 *    - User "unblinds" to get the real signature
 *    - Prevents mint from tracking token transfers
 *
 * ARCHITECTURE
 * ------------
 * ```
 *                    ┌─────────────────────┐
 *                    │  CashuWalletService │  <-- You are here
 *                    └─────────┬───────────┘
 *                              │
 *          ┌───────────────────┼───────────────────┐
 *          │                   │                   │
 *          ▼                   ▼                   ▼
 *   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
 *   │ @cashu/     │    │ Proof       │    │ Transaction │
 *   │ cashu-ts    │    │ Repository  │    │ Repository  │
 *   │ (protocol)  │    │ (storage)   │    │ (history)   │
 *   └─────────────┘    └─────────────┘    └─────────────┘
 *          │
 *          ▼
 *   ┌─────────────┐
 *   │ Cashu Mint  │ (external server)
 *   │ (Lightning) │
 *   └─────────────┘
 * ```
 *
 * PROOF LIFECYCLE
 * ---------------
 * Proofs go through several states during their lifetime:
 *
 *   UNSPENT ─────────────────────────────────────────────────────┐
 *      │                                                         │
 *      │ selectProofsForAmount()                                 │
 *      ▼                                                         │
 *   PENDING_SEND ─── send confirmed ──▶ SPENT                   │
 *      │                                                         │
 *      │ send cancelled                                          │
 *      └─────────────────────────────────────────────────────────┘
 *
 *   UNSPENT ─── swap ──▶ PENDING_SWAP ─── swap confirmed ──▶ SPENT
 *                              │
 *                              │ swap failed (rollback)
 *                              ▼
 *                           UNSPENT
 *
 * WHY OFFLINE-FIRST?
 * ------------------
 * 1. Users can send payments without internet using OCR (Offline Cash Reserve)
 * 2. All operations are queued and retried when connectivity returns
 * 3. Proofs are stored locally with cryptographic integrity checks
 * 4. State machine prevents double-spending even when offline
 *
 * USAGE EXAMPLES
 * --------------
 * ```typescript
 * // Get the singleton instance
 * const cashu = CashuWalletService.getInstance();
 *
 * // Mint new tokens (receive from Lightning)
 * const quote = await cashu.requestMintQuote('https://mint.example.com', 1000);
 * // User pays the Lightning invoice in quote.request
 * const result = await cashu.mintTokens('https://mint.example.com', 1000, quote.quote);
 *
 * // Send tokens to someone
 * const { proofs, transactionId } = await cashu.send('https://mint.example.com', 500);
 * const token = cashu.encodeToken(proofs);  // Share this token string
 * await cashu.confirmSend(proofs.map(p => p.id), transactionId);
 *
 * // Receive tokens from someone
 * const received = await cashu.receive(tokenString);
 * console.log(`Received ${received.total} sats`);
 * ```
 *
 * @module core/cashu/CashuWalletService
 * @see {@link https://github.com/cashubtc/cashu-ts} - Cashu TypeScript library
 * @see {@link https://github.com/cashubtc/nuts} - Cashu protocol specification
 */

import { CashuWallet, CashuMint, Proof as CashuProof, MintKeys } from '@cashu/cashu-ts';
import ProofRepository from '../../data/repositories/ProofRepository';
import MintRepository from '../../data/repositories/MintRepository';
import TransactionRepository from '../../data/repositories/TransactionRepository';
import {
  Proof,
  ProofState,
  TransactionType,
  TransactionStatus,
  TransactionDirection,
  TrustLevel,
} from '../../types';
import { generateUUID } from '../../utils/uuid';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Result returned after minting (receiving) new tokens.
 *
 * Minting is the process of converting Lightning sats into ecash proofs.
 * The user first gets a quote (Lightning invoice), pays it, then calls
 * mintTokens to receive the ecash proofs.
 *
 * @property proofs - Array of newly created ecash proofs (your tokens!)
 * @property total - Total amount in satoshis that was minted
 * @property transactionId - Unique ID for tracking this operation
 */
export interface MintResult {
  proofs: Proof[];
  total: number;
  transactionId: string;
}

/**
 * Result returned after swapping proofs.
 *
 * Swapping is the process of exchanging proofs for new ones at the same mint.
 * This is useful for:
 * - Privacy: Getting new proofs breaks linkability
 * - Denomination changes: Split 100 sat proof into 50+50
 * - Proof refreshing: Replace old keysets with new ones
 *
 * @property newProofs - The fresh proofs you received from the swap
 * @property oldProofs - The original proofs that were consumed (now invalid)
 * @property total - Total amount in satoshis (should be same as input)
 * @property transactionId - Unique ID for tracking this operation
 */
export interface SwapResult {
  newProofs: Proof[];
  oldProofs: Proof[];
  total: number;
  transactionId: string;
}

/**
 * Result returned after melting tokens (paying a Lightning invoice).
 *
 * Melting is the reverse of minting - converting ecash back to Lightning.
 * You provide proofs and a Lightning invoice, the mint pays the invoice
 * and destroys your proofs.
 *
 * @property isPaid - Whether the Lightning invoice was successfully paid
 * @property preimage - The Lightning payment preimage (proof of payment)
 * @property change - Any leftover proofs if input was more than invoice + fee
 * @property fee - The fee charged by the mint for the Lightning payment
 * @property transactionId - Unique ID for tracking this operation
 */
export interface MeltResult {
  isPaid: boolean;
  preimage?: string;
  change?: Proof[];
  fee: number;
  transactionId: string;
}

/**
 * Result returned after splitting proofs into different denominations.
 *
 * @property newProofs - The proofs with new denominations
 * @property oldProofs - The original proofs that were consumed
 * @property transactionId - Unique ID for tracking this operation
 */
export interface SplitResult {
  newProofs: Proof[];
  oldProofs: Proof[];
  transactionId: string;
}

// =============================================================================
// MAIN SERVICE CLASS
// =============================================================================

/**
 * CashuWalletService - The heart of Cashu operations in this wallet.
 *
 * This class follows the Singleton pattern because:
 * 1. We need consistent state across the app
 * 2. Wallet instances are cached and reused
 * 3. Repository connections should be shared
 *
 * THREAD SAFETY NOTE:
 * This service is designed for single-threaded JavaScript execution.
 * If using workers, each worker should have its own instance.
 */
export class CashuWalletService {
  // -------------------------------------------------------------------------
  // Singleton Implementation
  // -------------------------------------------------------------------------

  /** The single instance of this service */
  private static instance: CashuWalletService;

  // -------------------------------------------------------------------------
  // Instance Properties
  // -------------------------------------------------------------------------

  /**
   * Cache of CashuWallet instances, keyed by mint URL.
   *
   * We cache these because:
   * 1. Creating a CashuWallet involves network calls to fetch keysets
   * 2. Reusing wallets is more efficient
   * 3. Keysets are cached within the wallet
   */
  private wallets: Map<string, CashuWallet> = new Map();

  /** Repository for storing and retrieving proofs (ecash tokens) */
  private proofRepo: ProofRepository;

  /** Repository for storing and retrieving mint information and keysets */
  private mintRepo: MintRepository;

  /** Repository for storing transaction history */
  private txRepo: TransactionRepository;

  // -------------------------------------------------------------------------
  // Constructor (private for singleton)
  // -------------------------------------------------------------------------

  /**
   * Private constructor - use getInstance() instead.
   *
   * Initializes connections to all required repositories.
   * These repositories handle the actual SQLite database operations.
   */
  private constructor() {
    this.proofRepo = ProofRepository.getInstance();
    this.mintRepo = MintRepository.getInstance();
    this.txRepo = TransactionRepository.getInstance();
  }

  /**
   * Get the singleton instance of CashuWalletService.
   *
   * This is the ONLY way to get an instance of this service.
   * The same instance is returned every time, ensuring consistent state.
   *
   * @returns The singleton CashuWalletService instance
   *
   * @example
   * ```typescript
   * const cashu = CashuWalletService.getInstance();
   * const balance = cashu.getWalletInfo('https://mint.example.com');
   * ```
   */
  static getInstance(): CashuWalletService {
    if (!CashuWalletService.instance) {
      CashuWalletService.instance = new CashuWalletService();
    }
    return CashuWalletService.instance;
  }

  // =========================================================================
  // PRIVATE HELPER METHODS
  // =========================================================================

  /**
   * Get or create a CashuWallet instance for a specific mint.
   *
   * CashuWallet is the main class from @cashu/cashu-ts that handles
   * protocol operations. Each mint needs its own wallet instance because
   * each mint has different keysets and potentially different protocol versions.
   *
   * The wallet is cached after creation for efficiency.
   *
   * @param mintUrl - The URL of the Cashu mint (e.g., 'https://mint.example.com')
   * @returns A CashuWallet instance configured for the specified mint
   *
   * @internal This is a private helper method, not part of the public API
   */
  private async getWallet(mintUrl: string): Promise<CashuWallet> {
    // Check if we already have a cached wallet for this mint
    if (this.wallets.has(mintUrl)) {
      return this.wallets.get(mintUrl)!;
    }

    // Create a new CashuMint instance - this represents the mint server
    // The CashuMint class handles HTTP communication with the mint
    const mint = new CashuMint(mintUrl);

    // Create a new CashuWallet instance - this handles all crypto operations
    // The wallet will automatically fetch keysets from the mint
    const wallet = new CashuWallet(mint);

    // Cache the wallet for future use
    this.wallets.set(mintUrl, wallet);

    return wallet;
  }

  /**
   * Convert a proof from the Cashu library format to our internal Proof format.
   *
   * The Cashu library uses a simplified proof structure, but we need to track
   * additional metadata like state, OCR status, and creation time.
   *
   * PROOF STRUCTURE EXPLAINED:
   * - secret: A random value that only you know. Used to claim the proof.
   * - C: The blind signature from the mint. Proves the mint signed this amount.
   * - amount: The value in satoshis. Must be a power of 2 (1, 2, 4, 8, 16, etc.)
   * - id (keysetId): Identifies which mint keyset was used to sign this proof.
   *
   * @param cashuProof - Proof object from @cashu/cashu-ts library
   * @param mintUrl - The URL of the mint that issued this proof
   * @param state - Current state of the proof (default: UNSPENT)
   * @param isOCR - Whether this proof is part of the Offline Cash Reserve
   * @returns Our internal Proof format (without id and createdAt, which are auto-generated)
   *
   * @internal This is a private helper method
   */
  private cashuProofToProof(
    cashuProof: CashuProof,
    mintUrl: string,
    state: ProofState = ProofState.UNSPENT,
    isOCR: boolean = false
  ): Omit<Proof, 'id' | 'createdAt'> {
    return {
      secret: cashuProof.secret,     // Your secret - NEVER share this!
      C: cashuProof.C,               // The blind signature
      amount: cashuProof.amount,     // Value in sats (power of 2)
      mintUrl,                       // Which mint issued this
      keysetId: cashuProof.id,       // Which keyset was used to sign
      state,                         // Track if spent, pending, etc.
      isOCR,                         // Part of offline reserve?
    };
  }

  /**
   * Convert our internal Proof format back to the Cashu library format.
   *
   * When calling @cashu/cashu-ts methods, we need to provide proofs in
   * their expected format. This strips away our metadata.
   *
   * @param proof - Our internal Proof object with all metadata
   * @returns A simplified proof object for the Cashu library
   *
   * @internal This is a private helper method
   */
  private proofToCashuProof(proof: Proof): CashuProof {
    return {
      secret: proof.secret,
      C: proof.C,
      amount: proof.amount,
      id: proof.keysetId,  // Note: Cashu library uses 'id' for keyset ID
    };
  }

  // =========================================================================
  // MINT OPERATIONS
  // =========================================================================
  // These methods handle the creation of new ecash tokens from Lightning.

  /**
   * Request a mint quote (Step 1 of minting process).
   *
   * This is the first step in converting Lightning sats to ecash:
   * 1. Request a quote from the mint (this method)
   * 2. Pay the Lightning invoice in the quote
   * 3. Call mintTokens() to receive your ecash
   *
   * The quote contains a Lightning invoice that you must pay. Once paid,
   * the mint will be ready to issue ecash tokens for that amount.
   *
   * @param mintUrl - The URL of the Cashu mint
   * @param amount - The amount in satoshis you want to mint
   * @returns Object containing the quote ID and Lightning invoice (request)
   *
   * @throws Error if the mint is unreachable or rejects the amount
   *
   * @example
   * ```typescript
   * const cashu = CashuWalletService.getInstance();
   *
   * // Step 1: Get a quote (Lightning invoice)
   * const { quote, request } = await cashu.requestMintQuote(
   *   'https://mint.example.com',
   *   10000  // 10,000 sats
   * );
   *
   * console.log('Pay this invoice:', request);
   * // request is something like: lnbc100u1p3...
   *
   * // Step 2: User pays the Lightning invoice externally
   *
   * // Step 3: Claim the ecash (see mintTokens)
   * ```
   */
  async requestMintQuote(
    mintUrl: string,
    amount: number
  ): Promise<{ quote: string; request: string }> {
    // Get the wallet for this mint
    const wallet = await this.getWallet(mintUrl);

    // Request a quote from the mint
    // The mint will return:
    // - quote: A unique ID for this minting request
    // - request: A Lightning invoice to pay
    const { quote, request } = await wallet.getMintQuote(amount);

    return { quote, request };
  }

  /**
   * Mint tokens after paying a Lightning invoice (Step 3 of minting process).
   *
   * After the user has paid the Lightning invoice from requestMintQuote(),
   * call this method to actually receive the ecash tokens.
   *
   * HOW BLIND MINTING WORKS:
   * 1. Client creates random secrets for each token
   * 2. Client "blinds" these secrets (cryptographic hiding)
   * 3. Mint signs the blinded secrets (doesn't see the real values)
   * 4. Client "unblinds" to get valid signatures
   * 5. Client now has ecash proofs that mint can't trace!
   *
   * @param mintUrl - The URL of the Cashu mint
   * @param amount - The amount in satoshis being minted (must match quote)
   * @param quote - The quote ID from requestMintQuote()
   * @param isOCR - Whether to mark these as Offline Cash Reserve proofs
   * @returns MintResult with the new proofs and transaction info
   *
   * @throws Error if the quote is invalid, expired, or unpaid
   *
   * @example
   * ```typescript
   * // After user paid the Lightning invoice...
   * const result = await cashu.mintTokens(
   *   'https://mint.example.com',
   *   10000,
   *   quote.quote,
   *   false  // Not for OCR
   * );
   *
   * console.log(`Minted ${result.total} sats in ${result.proofs.length} proofs`);
   * // Now you have ecash tokens in your wallet!
   * ```
   */
  async mintTokens(
    mintUrl: string,
    amount: number,
    quote: string,
    isOCR: boolean = false
  ): Promise<MintResult> {
    const wallet = await this.getWallet(mintUrl);
    const transactionId = generateUUID();

    try {
      // Create a transaction record BEFORE the operation
      // This ensures we can track even failed operations
      await this.txRepo.create({
        type: TransactionType.RECEIVE,
        amount,
        mintUrl,
        status: TransactionStatus.PENDING,
        direction: TransactionDirection.INCOMING,
        paymentRequest: quote,
        proofCount: 0,
      });

      // Request tokens from the mint
      // This is where the blind signature magic happens:
      // - We send blinded secrets to the mint
      // - Mint signs them and returns blinded signatures
      // - cashu-ts unblinds them for us automatically
      const { proofs: cashuProofs } = await wallet.requestTokens(amount, quote);

      // Convert and store each proof in our database
      const proofs: Proof[] = [];
      for (const cashuProof of cashuProofs) {
        // Convert to our format with additional metadata
        const proofData = this.cashuProofToProof(cashuProof, mintUrl, ProofState.UNSPENT, isOCR);

        // Store in database - now we own these proofs!
        const proof = await this.proofRepo.create(proofData);
        proofs.push(proof);
      }

      // Update transaction as completed
      await this.txRepo.update(transactionId, {
        status: TransactionStatus.COMPLETED,
        proofCount: proofs.length,
        completedAt: Date.now(),
      });

      return {
        proofs,
        total: amount,
        transactionId,
      };
    } catch (error: any) {
      // Mark transaction as failed for debugging/recovery
      await this.txRepo.markFailed(transactionId);
      throw new Error(`Mint failed: ${error.message}`);
    }
  }

  // =========================================================================
  // SWAP OPERATIONS
  // =========================================================================
  // Swapping allows exchanging proofs for new ones at the same mint.

  /**
   * Swap proofs for new proofs at the same mint.
   *
   * Swapping is a fundamental operation in Cashu with many use cases:
   *
   * PRIVACY:
   * - Original proofs could be linked to how you received them
   * - New proofs have no history - unlinkable to the originals
   * - Swap before spending for maximum privacy
   *
   * DENOMINATION CHANGES:
   * - Need to send 150 sats but only have a 256 sat proof?
   * - Swap the 256 for 128 + 64 + 32 + 16 + 8 + 4 + 2 + 1 + 1
   * - Now you can send exactly 150 sats
   *
   * KEYSET ROTATION:
   * - Mints periodically rotate their signing keys
   * - Old proofs with old keysets might stop working
   * - Swap to get new proofs with current keyset
   *
   * HOW IT WORKS:
   * 1. Send your proofs to the mint
   * 2. Mint verifies they're valid and unspent
   * 3. Mint marks them as spent (can't use them again!)
   * 4. Mint creates new blind signatures for same total amount
   * 5. You receive new, fresh proofs
   *
   * @param mintUrl - The URL of the Cashu mint
   * @param proofIds - Array of proof IDs to swap (from our database)
   * @param targetAmounts - Optional specific denominations for new proofs
   * @returns SwapResult with new proofs and old (spent) proofs
   *
   * @throws Error if any proof is not found, already spent, or swap fails
   *
   * @example
   * ```typescript
   * // Swap some proofs for privacy
   * const result = await cashu.swapProofs(
   *   'https://mint.example.com',
   *   ['proof-id-1', 'proof-id-2']
   * );
   *
   * console.log(`Swapped for ${result.newProofs.length} new proofs`);
   * // Old proofs are now SPENT and cannot be used
   * ```
   */
  async swapProofs(
    mintUrl: string,
    proofIds: string[],
    targetAmounts?: number[]
  ): Promise<SwapResult> {
    const wallet = await this.getWallet(mintUrl);
    const transactionId = generateUUID();

    try {
      // Fetch and validate all proofs from database
      const oldProofs: Proof[] = [];
      for (const id of proofIds) {
        const proof = await this.proofRepo.getById(id);

        // Proof must exist
        if (!proof) throw new Error(`Proof ${id} not found`);

        // Proof must be unspent (can't swap already-spent proofs!)
        if (proof.state !== ProofState.UNSPENT) {
          throw new Error(`Proof ${id} is not unspent (state: ${proof.state})`);
        }

        oldProofs.push(proof);
      }

      // Calculate total amount being swapped
      const totalAmount = oldProofs.reduce((sum, p) => sum + p.amount, 0);

      // Create transaction record
      await this.txRepo.create({
        type: TransactionType.SWAP,
        amount: totalAmount,
        mintUrl,
        status: TransactionStatus.PENDING,
        direction: TransactionDirection.OUTGOING,
        proofCount: oldProofs.length,
      });

      // Mark proofs as PENDING_SWAP to prevent double-spend
      // If we crash here, we can see these proofs were mid-swap
      for (const proof of oldProofs) {
        await this.proofRepo.transitionState(
          proof.id,
          ProofState.UNSPENT,
          ProofState.PENDING_SWAP,
          transactionId
        );
      }

      // Convert to Cashu library format
      const cashuProofs = oldProofs.map(p => this.proofToCashuProof(p));

      // Perform the swap with the mint
      // wallet.send() with same amount returns change as new proofs
      const { returnChange: newCashuProofs } = await wallet.send(
        totalAmount,
        cashuProofs,
        targetAmounts
      );

      // Store new proofs in database
      const newProofs: Proof[] = [];
      for (const cashuProof of newCashuProofs) {
        const proofData = this.cashuProofToProof(
          cashuProof,
          mintUrl,
          ProofState.UNSPENT,
          oldProofs[0]?.isOCR || false  // Preserve OCR status from original proofs
        );
        const proof = await this.proofRepo.create(proofData);
        newProofs.push(proof);
      }

      // Mark old proofs as permanently SPENT
      // They can never be used again - the mint has recorded them
      for (const proof of oldProofs) {
        await this.proofRepo.transitionState(
          proof.id,
          ProofState.PENDING_SWAP,
          ProofState.SPENT,
          transactionId
        );
      }

      // Update transaction as completed
      await this.txRepo.markCompleted(transactionId);

      return {
        newProofs,
        oldProofs,
        total: totalAmount,
        transactionId,
      };
    } catch (error: any) {
      // ROLLBACK: If swap failed, proofs are still valid
      // Reset them back to UNSPENT so user can try again
      for (const id of proofIds) {
        await this.proofRepo.transitionState(
          id,
          ProofState.PENDING_SWAP,
          ProofState.UNSPENT
        );
      }

      await this.txRepo.markFailed(transactionId);
      throw new Error(`Swap failed: ${error.message}`);
    }
  }

  // =========================================================================
  // SEND OPERATIONS
  // =========================================================================
  // These methods handle sending ecash to other users.

  /**
   * Prepare proofs for sending to another user.
   *
   * This method selects proofs totaling the requested amount and prepares
   * them for transfer. The proofs are marked as PENDING_SEND until the
   * transfer is confirmed or cancelled.
   *
   * SENDING FLOW:
   * 1. Call send() to select and prepare proofs (this method)
   * 2. Encode proofs as token string with encodeToken()
   * 3. Share the token string with recipient
   * 4. Call confirmSend() after recipient redeems, OR
   * 5. Call cancelSend() if transfer failed
   *
   * PROOF SELECTION ALGORITHM:
   * - Selects proofs that sum to >= requested amount
   * - Prefers exact matches to avoid creating change
   * - If no exact match, swaps to create exact amount + change
   * - Change proofs stay in your wallet
   *
   * @param mintUrl - The URL of the Cashu mint
   * @param amount - Amount in satoshis to send
   * @param useOCR - Whether to use Offline Cash Reserve proofs
   * @returns Object with proofs to send, any change, and transaction ID
   *
   * @throws Error if insufficient balance or proof selection fails
   *
   * @example
   * ```typescript
   * // Prepare to send 500 sats
   * const { proofs, change, transactionId } = await cashu.send(
   *   'https://mint.example.com',
   *   500,
   *   false  // Use regular proofs, not OCR
   * );
   *
   * // Encode as shareable token
   * const token = cashu.encodeToken(proofs);
   * console.log('Share this token:', token);
   * // Token looks like: cashuAeyJ0b2tlbiI6...
   *
   * // After recipient redeems successfully:
   * await cashu.confirmSend(proofs.map(p => p.id), transactionId);
   * ```
   */
  async send(
    mintUrl: string,
    amount: number,
    useOCR: boolean = false
  ): Promise<{ proofs: Proof[]; change?: Proof[]; transactionId: string }> {
    const wallet = await this.getWallet(mintUrl);
    const transactionId = generateUUID();

    try {
      // Create transaction record
      await this.txRepo.create({
        type: TransactionType.SEND,
        amount,
        mintUrl,
        status: TransactionStatus.PENDING,
        direction: TransactionDirection.OUTGOING,
        proofCount: 0,
      });

      // Select proofs that sum to at least the requested amount
      // This also locks them (marks as PENDING_SEND) to prevent double-spend
      const selection = await this.proofRepo.selectProofsForAmount(
        mintUrl,
        amount,
        transactionId,
        useOCR
      );

      // CASE 1: Exact amount found
      // We found proofs that sum exactly to the amount - no change needed!
      if (selection.change === 0) {
        await this.txRepo.update(transactionId, {
          proofCount: selection.proofs.length,
        });

        return {
          proofs: selection.proofs,
          transactionId,
        };
      }

      // CASE 2: Need to create change
      // Selected proofs sum to more than amount, need to swap for exact amounts
      const cashuProofs = selection.proofs.map(p => this.proofToCashuProof(p));

      // wallet.send() splits proofs into:
      // - send: Proofs totaling exactly the requested amount
      // - returnChange: Leftover proofs that stay with us
      const { send: sendProofs, returnChange: changeProofs } = await wallet.send(
        amount,
        cashuProofs
      );

      // Store the proofs to send (marked as PENDING_SEND)
      const proofs: Proof[] = [];
      for (const cashuProof of sendProofs) {
        const proofData = this.cashuProofToProof(
          cashuProof,
          mintUrl,
          ProofState.PENDING_SEND,
          useOCR
        );
        const proof = await this.proofRepo.create(proofData);
        proofs.push(proof);
      }

      // Store change proofs (stay in wallet as UNSPENT)
      const change: Proof[] = [];
      for (const cashuProof of changeProofs) {
        const proofData = this.cashuProofToProof(
          cashuProof,
          mintUrl,
          ProofState.UNSPENT,
          useOCR
        );
        const proof = await this.proofRepo.create(proofData);
        change.push(proof);
      }

      // Mark original proofs as spent (they were consumed in the swap)
      for (const proof of selection.proofs) {
        await this.proofRepo.transitionState(
          proof.id,
          ProofState.PENDING_SEND,
          ProofState.SPENT,
          transactionId
        );
      }

      // Update transaction
      await this.txRepo.update(transactionId, {
        proofCount: proofs.length,
      });

      return {
        proofs,
        change,
        transactionId,
      };
    } catch (error: any) {
      await this.txRepo.markFailed(transactionId);
      throw new Error(`Send failed: ${error.message}`);
    }
  }

  /**
   * Confirm that sent proofs were successfully redeemed by recipient.
   *
   * Call this after the recipient has successfully received and redeemed
   * your token. This permanently marks the proofs as SPENT in our database.
   *
   * WHEN TO CALL:
   * - After getting confirmation from recipient
   * - After verifying proofs are spent at the mint
   * - After successful in-person transaction
   *
   * @param proofIds - IDs of the proofs that were sent
   * @param transactionId - Transaction ID from the send() call
   *
   * @example
   * ```typescript
   * // After recipient confirms they got the tokens:
   * await cashu.confirmSend(
   *   ['proof-1', 'proof-2'],
   *   'tx-12345'
   * );
   * // Proofs are now permanently marked as SPENT
   * ```
   */
  async confirmSend(proofIds: string[], transactionId: string): Promise<void> {
    // Transition each proof from PENDING_SEND to SPENT
    for (const id of proofIds) {
      await this.proofRepo.transitionState(
        id,
        ProofState.PENDING_SEND,
        ProofState.SPENT,
        transactionId
      );
    }

    // Mark transaction as completed
    await this.txRepo.markCompleted(transactionId);
  }

  /**
   * Cancel a send operation and recover the proofs.
   *
   * Call this if the recipient couldn't redeem the token, or if you
   * want to cancel the transfer. Proofs are reset to UNSPENT state.
   *
   * IMPORTANT: Only call this if you're SURE the recipient hasn't redeemed!
   * If they have redeemed, these proofs are actually spent at the mint,
   * and marking them UNSPENT would create a false balance.
   *
   * @param proofIds - IDs of the proofs from the cancelled send
   * @param transactionId - Transaction ID from the send() call
   *
   * @example
   * ```typescript
   * // Transfer failed, recipient couldn't scan QR:
   * await cashu.cancelSend(
   *   ['proof-1', 'proof-2'],
   *   'tx-12345'
   * );
   * // Proofs are back to UNSPENT, can be used again
   * ```
   */
  async cancelSend(proofIds: string[], transactionId: string): Promise<void> {
    // Reset proofs back to UNSPENT
    for (const id of proofIds) {
      await this.proofRepo.transitionState(
        id,
        ProofState.PENDING_SEND,
        ProofState.UNSPENT
      );
    }

    // Mark transaction as failed
    await this.txRepo.markFailed(transactionId);
  }

  // =========================================================================
  // RECEIVE OPERATIONS
  // =========================================================================
  // These methods handle receiving ecash from other users.

  /**
   * Receive tokens from a token string.
   *
   * When someone sends you ecash, they give you a token string.
   * This method decodes the token, validates it with the mint,
   * and stores the proofs in your wallet.
   *
   * WHAT HAPPENS DURING RECEIVE:
   * 1. Token string is decoded to extract proofs and mint URL
   * 2. Proofs are sent to the mint for validation
   * 3. Mint verifies proofs are unspent and valid
   * 4. Mint issues NEW proofs to you (swaps them)
   * 5. Original proofs are now spent (sender can't use them)
   * 6. New proofs are stored in your database
   *
   * WHY SWAP ON RECEIVE?
   * - Proves the proofs are valid and unspent
   * - Breaks linkability between sender and receiver
   * - You get fresh proofs that only you know
   *
   * @param token - The Cashu token string (starts with 'cashu...')
   * @param isOCR - Whether to mark received proofs as OCR
   * @returns Object with received proofs, total amount, and transaction ID
   *
   * @throws Error if token is invalid, proofs are spent, or mint unreachable
   *
   * @example
   * ```typescript
   * // Receive tokens from a friend
   * const tokenString = 'cashuAeyJ0b2tlbiI6...';
   *
   * try {
   *   const result = await cashu.receive(tokenString);
   *   console.log(`Received ${result.total} sats!`);
   * } catch (error) {
   *   console.log('Token invalid or already claimed');
   * }
   * ```
   */
  async receive(
    token: string,
    isOCR: boolean = false
  ): Promise<{ proofs: Proof[]; total: number; transactionId: string }> {
    const transactionId = generateUUID();

    try {
      // Decode the token string to extract mint URL and proofs
      const decoded = this.decodeToken(token);

      // Extract mint URL from the first token entry
      const mintUrl = decoded.token[0]?.mint;
      if (!mintUrl) throw new Error('Invalid token: no mint URL');

      // Get wallet for this mint
      const wallet = await this.getWallet(mintUrl);

      // Calculate total amount from the token
      const total = decoded.token[0].proofs.reduce((sum: number, p: any) => sum + p.amount, 0);

      // Create transaction record
      await this.txRepo.create({
        type: TransactionType.RECEIVE,
        amount: total,
        mintUrl,
        status: TransactionStatus.PENDING,
        direction: TransactionDirection.INCOMING,
        proofCount: decoded.token[0].proofs.length,
      });

      // Receive proofs from the mint
      // This swaps the token's proofs for new proofs that only we know
      // The mint validates the original proofs and issues fresh ones
      const { proofs: cashuProofs } = await wallet.receive(decoded);

      // Store received proofs in our database
      const proofs: Proof[] = [];
      for (const cashuProof of cashuProofs) {
        const proofData = this.cashuProofToProof(
          cashuProof,
          mintUrl,
          ProofState.UNSPENT,
          isOCR
        );
        const proof = await this.proofRepo.create(proofData);
        proofs.push(proof);
      }

      // Mark transaction as completed
      await this.txRepo.markCompleted(transactionId);

      return {
        proofs,
        total,
        transactionId,
      };
    } catch (error: any) {
      await this.txRepo.markFailed(transactionId);
      throw new Error(`Receive failed: ${error.message}`);
    }
  }

  // =========================================================================
  // MELT OPERATIONS (Lightning Payments)
  // =========================================================================
  // Melting converts ecash back to Lightning for paying invoices.

  /**
   * Get a quote for paying a Lightning invoice (melting).
   *
   * Before melting tokens to pay a Lightning invoice, you need to get
   * a quote from the mint. The quote tells you:
   * - The amount you need to pay (in sats)
   * - The fee the mint will charge
   * - A quote ID for the melt operation
   *
   * @param mintUrl - The URL of the Cashu mint
   * @param invoice - The Lightning invoice (BOLT11) to pay
   * @returns Quote with ID, amount, and fee
   *
   * @throws Error if invoice is invalid or mint can't pay it
   *
   * @example
   * ```typescript
   * const invoice = 'lnbc100u1p3...';  // Lightning invoice
   *
   * const quote = await cashu.getMeltQuote(
   *   'https://mint.example.com',
   *   invoice
   * );
   *
   * console.log(`Amount: ${quote.amount} sats`);
   * console.log(`Fee: ${quote.fee} sats`);
   * console.log(`Total needed: ${quote.amount + quote.fee} sats`);
   * ```
   */
  async getMeltQuote(
    mintUrl: string,
    invoice: string
  ): Promise<{ quote: string; amount: number; fee: number }> {
    const wallet = await this.getWallet(mintUrl);

    // Get quote from mint
    // The mint decodes the invoice and calculates the fee
    const { quote, amount, fee_reserve } = await wallet.getMeltQuote(invoice);

    return {
      quote,
      amount,
      fee: fee_reserve,
    };
  }

  /**
   * Melt tokens to pay a Lightning invoice.
   *
   * This is how you "cash out" ecash to pay real Lightning invoices.
   * You provide proofs and an invoice, the mint:
   * 1. Validates and consumes your proofs
   * 2. Pays the Lightning invoice
   * 3. Returns any change (if proofs > invoice + fee)
   *
   * MELT vs SEND:
   * - Send: Transfer ecash to another Cashu user
   * - Melt: Convert ecash to Lightning payment
   *
   * @param mintUrl - The URL of the Cashu mint
   * @param invoice - The Lightning invoice to pay
   * @param proofIds - IDs of proofs to use for payment
   * @returns MeltResult with payment status and any change
   *
   * @throws Error if insufficient proofs, invalid invoice, or payment fails
   *
   * @example
   * ```typescript
   * // Get a quote first
   * const quote = await cashu.getMeltQuote(mintUrl, invoice);
   * const totalNeeded = quote.amount + quote.fee;
   *
   * // Select proofs covering the total
   * const proofIds = selectProofsForAmount(totalNeeded);
   *
   * // Melt to pay the invoice
   * const result = await cashu.melt(mintUrl, invoice, proofIds);
   *
   * if (result.isPaid) {
   *   console.log('Invoice paid! Preimage:', result.preimage);
   *   if (result.change) {
   *     console.log(`Got ${result.change.length} change proofs back`);
   *   }
   * }
   * ```
   */
  async melt(
    mintUrl: string,
    invoice: string,
    proofIds: string[]
  ): Promise<MeltResult> {
    const wallet = await this.getWallet(mintUrl);
    const transactionId = generateUUID();

    try {
      // Get proofs from database
      const proofs: Proof[] = [];
      for (const id of proofIds) {
        const proof = await this.proofRepo.getById(id);
        if (!proof) throw new Error(`Proof ${id} not found`);
        proofs.push(proof);
      }

      const totalAmount = proofs.reduce((sum, p) => sum + p.amount, 0);

      // Create transaction record
      await this.txRepo.create({
        type: TransactionType.LIGHTNING,
        amount: totalAmount,
        mintUrl,
        status: TransactionStatus.PENDING,
        direction: TransactionDirection.OUTGOING,
        paymentRequest: invoice,
        proofCount: proofs.length,
      });

      // Mark proofs as pending
      for (const proof of proofs) {
        await this.proofRepo.transitionState(
          proof.id,
          ProofState.UNSPENT,
          ProofState.PENDING_SEND,
          transactionId
        );
      }

      // Convert to Cashu library format
      const cashuProofs = proofs.map(p => this.proofToCashuProof(p));

      // Melt tokens to pay the Lightning invoice
      // The mint will:
      // 1. Validate our proofs
      // 2. Pay the Lightning invoice
      // 3. Return change if proofs > invoice + fee
      const result = await wallet.meltTokens({
        proofs: cashuProofs,
        invoice,
      });

      // Mark proofs as spent (mint has consumed them)
      for (const proof of proofs) {
        await this.proofRepo.transitionState(
          proof.id,
          ProofState.PENDING_SEND,
          ProofState.SPENT,
          transactionId
        );
      }

      // Store any change proofs
      let change: Proof[] | undefined;
      if (result.change && result.change.length > 0) {
        change = [];
        for (const cashuProof of result.change) {
          const proofData = this.cashuProofToProof(
            cashuProof,
            mintUrl,
            ProofState.UNSPENT,
            false  // Change from melt is not OCR
          );
          const proof = await this.proofRepo.create(proofData);
          change.push(proof);
        }
      }

      // Mark transaction as completed
      await this.txRepo.markCompleted(transactionId);

      return {
        isPaid: result.isPaid,
        preimage: result.preimage,
        change,
        fee: result.fee_reserve || 0,
        transactionId,
      };
    } catch (error: any) {
      // Rollback: mark proofs as unspent again
      // Note: This is only safe if the payment actually failed!
      // If the payment succeeded but we crashed, proofs are actually spent.
      for (const id of proofIds) {
        await this.proofRepo.transitionState(
          id,
          ProofState.PENDING_SEND,
          ProofState.UNSPENT
        );
      }

      await this.txRepo.markFailed(transactionId);
      throw new Error(`Melt failed: ${error.message}`);
    }
  }

  // =========================================================================
  // TOKEN ENCODING/DECODING
  // =========================================================================
  // These methods convert between proofs and shareable token strings.

  /**
   * Encode proofs as a shareable token string.
   *
   * Token strings are the standard way to share Cashu ecash.
   * The format is specified in NUT-00 of the Cashu protocol.
   *
   * TOKEN FORMAT:
   * - Prefix: 'cashu' (version identifier)
   * - Body: Base64-encoded JSON with mint URL and proofs
   *
   * @param proofs - Array of proofs to encode
   * @returns A token string starting with 'cashu...'
   *
   * @throws Error if no proofs provided
   *
   * @example
   * ```typescript
   * const token = cashu.encodeToken(proofsToSend);
   * console.log(token);
   * // Output: cashuAeyJ0b2tlbiI6W3sibWludCI6Imh0dHBzOi8v...
   *
   * // Share this string with the recipient!
   * ```
   */
  encodeToken(proofs: Proof[]): string {
    if (proofs.length === 0) throw new Error('No proofs to encode');

    // All proofs should be from the same mint
    const mintUrl = proofs[0].mintUrl;

    // Convert to Cashu library format
    const cashuProofs = proofs.map(p => this.proofToCashuProof(p));

    // Build the token structure
    // Note: Multi-mint tokens are possible but we use single-mint here
    const token = {
      token: [
        {
          mint: mintUrl,
          proofs: cashuProofs,
        },
      ],
    };

    // Use Cashu library to encode with proper prefix and formatting
    return CashuWallet.getEncodedToken(token);
  }

  /**
   * Decode a token string to extract mint URL and proofs.
   *
   * @param token - The Cashu token string to decode
   * @returns Decoded token object with mint and proofs
   *
   * @throws Error if token format is invalid
   *
   * @example
   * ```typescript
   * const decoded = cashu.decodeToken('cashuAeyJ0b2...');
   * console.log('Mint:', decoded.token[0].mint);
   * console.log('Proofs:', decoded.token[0].proofs.length);
   * ```
   */
  decodeToken(token: string): any {
    return CashuWallet.getDecodedToken(token);
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Check if proofs are still spendable (not already redeemed).
   *
   * This contacts the mint to verify each proof's status.
   * Useful for:
   * - Checking if sent tokens were claimed
   * - Validating proofs before trusting them
   * - Cleaning up spent proofs from database
   *
   * @param mintUrl - The URL of the Cashu mint
   * @param proofIds - Array of proof IDs to check
   * @returns Array of spendable status and total spendable amount
   *
   * @example
   * ```typescript
   * // Check if tokens I sent were claimed
   * const { spendable, total } = await cashu.checkProofsSpendable(
   *   mintUrl,
   *   sentProofIds
   * );
   *
   * if (spendable.every(s => !s)) {
   *   console.log('All tokens have been claimed!');
   * }
   * ```
   */
  async checkProofsSpendable(
    mintUrl: string,
    proofIds: string[]
  ): Promise<{ spendable: boolean[]; total: number }> {
    const wallet = await this.getWallet(mintUrl);

    // Get proofs from database
    const proofs: Proof[] = [];
    for (const id of proofIds) {
      const proof = await this.proofRepo.getById(id);
      if (!proof) throw new Error(`Proof ${id} not found`);
      proofs.push(proof);
    }

    const cashuProofs = proofs.map(p => this.proofToCashuProof(p));

    // Check with mint
    // Returns array of booleans indicating if each proof is spent
    const spendable = await wallet.checkProofsSpent(cashuProofs);

    // Calculate total of still-spendable proofs
    const total = proofs
      .filter((_, i) => spendable[i])
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      spendable,
      total,
    };
  }

  /**
   * Get wallet information for a specific mint.
   *
   * Returns current balance, proof count, and OCR balance.
   * This is a synchronous method that reads from local database only.
   *
   * @param mintUrl - The URL of the Cashu mint
   * @returns Object with balance, proof count, and OCR balance
   *
   * @example
   * ```typescript
   * const info = cashu.getWalletInfo('https://mint.example.com');
   * console.log(`Balance: ${info.balance} sats`);
   * console.log(`Proofs: ${info.proofCount}`);
   * console.log(`OCR Balance: ${info.ocrBalance} sats`);
   * ```
   */
  getWalletInfo(mintUrl: string): {
    balance: number;
    proofCount: number;
    ocrBalance: number;
  } {
    // Get total balance at this mint
    const balance = this.proofRepo.getBalance(mintUrl);

    // Get count of unspent proofs
    const proofs = this.proofRepo.getAll({ mintUrl, state: ProofState.UNSPENT });

    // Get OCR-specific balance
    const ocrBalance = this.proofRepo.getOCRBalance();

    return {
      balance,
      proofCount: proofs.length,
      ocrBalance,
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

/**
 * Default export: The singleton instance of CashuWalletService.
 *
 * Import and use directly:
 * ```typescript
 * import cashuService from './CashuWalletService';
 * const balance = cashuService.getWalletInfo(mintUrl);
 * ```
 */
export default CashuWalletService.getInstance();
