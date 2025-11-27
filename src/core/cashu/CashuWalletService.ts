/**
 * CashuWalletService
 *
 * Integrates @cashu/cashu-ts with our offline-first architecture.
 * Wraps the upstream CashuWallet and connects it to our repository layer.
 *
 * Features:
 * - Proof lifecycle management (mint, swap, melt, split)
 * - Automatic proof storage in database
 * - State machine integration
 * - Multi-mint support
 * - Offline operation queueing
 *
 * Architecture:
 * - Uses @cashu/cashu-ts for Cashu protocol
 * - Stores proofs in ProofRepository
 * - Tracks operations in TransactionRepository
 * - Syncs keysets via MintRepository
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

/**
 * Mint operation result
 */
export interface MintResult {
  proofs: Proof[];
  total: number;
  transactionId: string;
}

/**
 * Swap result
 */
export interface SwapResult {
  newProofs: Proof[];
  oldProofs: Proof[];
  total: number;
  transactionId: string;
}

/**
 * Melt result (send payment)
 */
export interface MeltResult {
  isPaid: boolean;
  preimage?: string;
  change?: Proof[];
  fee: number;
  transactionId: string;
}

/**
 * Split result
 */
export interface SplitResult {
  newProofs: Proof[];
  oldProofs: Proof[];
  transactionId: string;
}

/**
 * CashuWalletService class
 */
export class CashuWalletService {
  private static instance: CashuWalletService;

  private wallets: Map<string, CashuWallet> = new Map();
  private proofRepo: ProofRepository;
  private mintRepo: MintRepository;
  private txRepo: TransactionRepository;

  private constructor() {
    this.proofRepo = ProofRepository.getInstance();
    this.mintRepo = MintRepository.getInstance();
    this.txRepo = TransactionRepository.getInstance();
  }

  static getInstance(): CashuWalletService {
    if (!CashuWalletService.instance) {
      CashuWalletService.instance = new CashuWalletService();
    }
    return CashuWalletService.instance;
  }

  /**
   * Get or create wallet for a mint
   */
  private async getWallet(mintUrl: string): Promise<CashuWallet> {
    // Check cache
    if (this.wallets.has(mintUrl)) {
      return this.wallets.get(mintUrl)!;
    }

    // Create new wallet
    const mint = new CashuMint(mintUrl);
    const wallet = new CashuWallet(mint);

    // Cache wallet
    this.wallets.set(mintUrl, wallet);

    return wallet;
  }

  /**
   * Convert Cashu library proof to our Proof type
   */
  private cashuProofToProof(
    cashuProof: CashuProof,
    mintUrl: string,
    state: ProofState = ProofState.UNSPENT,
    isOCR: boolean = false
  ): Omit<Proof, 'id' | 'createdAt'> {
    return {
      secret: cashuProof.secret,
      C: cashuProof.C,
      amount: cashuProof.amount,
      mintUrl,
      keysetId: cashuProof.id, // Keyset ID
      state,
      isOCR,
    };
  }

  /**
   * Convert our Proof to Cashu library proof
   */
  private proofToCashuProof(proof: Proof): CashuProof {
    return {
      secret: proof.secret,
      C: proof.C,
      amount: proof.amount,
      id: proof.keysetId, // Keyset ID in Cashu library
    };
  }

  // ============================================
  // MINT OPERATIONS
  // ============================================

  /**
   * Request mint quote (prepare to receive)
   */
  async requestMintQuote(
    mintUrl: string,
    amount: number
  ): Promise<{ quote: string; request: string }> {
    const wallet = await this.getWallet(mintUrl);

    // Request quote from mint
    const { quote, request } = await wallet.getMintQuote(amount);

    return { quote, request };
  }

  /**
   * Mint tokens (receive ecash after payment)
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
      // Create transaction record
      await this.txRepo.create({
        type: TransactionType.RECEIVE,
        amount,
        mintUrl,
        status: TransactionStatus.PENDING,
        direction: TransactionDirection.INCOMING,
        paymentRequest: quote,
        proofCount: 0,
      });

      // Mint proofs
      const { proofs: cashuProofs } = await wallet.requestTokens(amount, quote);

      // Convert and store proofs
      const proofs: Proof[] = [];
      for (const cashuProof of cashuProofs) {
        const proofData = this.cashuProofToProof(cashuProof, mintUrl, ProofState.UNSPENT, isOCR);
        const proof = await this.proofRepo.create(proofData);
        proofs.push(proof);
      }

      // Update transaction
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
      // Mark transaction as failed
      await this.txRepo.markFailed(transactionId);
      throw new Error(`Mint failed: ${error.message}`);
    }
  }

  // ============================================
  // SWAP OPERATIONS
  // ============================================

  /**
   * Swap proofs (exchange for new proofs at same mint)
   * Used for privacy, denomination changes, or refreshing old proofs
   */
  async swapProofs(
    mintUrl: string,
    proofIds: string[],
    targetAmounts?: number[]
  ): Promise<SwapResult> {
    const wallet = await this.getWallet(mintUrl);
    const transactionId = generateUUID();

    try {
      // Get proofs from database
      const oldProofs: Proof[] = [];
      for (const id of proofIds) {
        const proof = await this.proofRepo.getById(id);
        if (!proof) throw new Error(`Proof ${id} not found`);
        if (proof.state !== ProofState.UNSPENT) {
          throw new Error(`Proof ${id} is not unspent (state: ${proof.state})`);
        }
        oldProofs.push(proof);
      }

      const totalAmount = oldProofs.reduce((sum, p) => sum + p.amount, 0);

      // Create transaction
      await this.txRepo.create({
        type: TransactionType.SWAP,
        amount: totalAmount,
        mintUrl,
        status: TransactionStatus.PENDING,
        direction: TransactionDirection.OUTGOING,
        proofCount: oldProofs.length,
      });

      // Mark old proofs as pending swap
      for (const proof of oldProofs) {
        await this.proofRepo.transitionState(
          proof.id,
          ProofState.UNSPENT,
          ProofState.PENDING_SWAP,
          transactionId
        );
      }

      // Convert to Cashu proofs
      const cashuProofs = oldProofs.map(p => this.proofToCashuProof(p));

      // Perform swap
      const { returnChange: newCashuProofs } = await wallet.send(
        totalAmount,
        cashuProofs,
        targetAmounts
      );

      // Store new proofs
      const newProofs: Proof[] = [];
      for (const cashuProof of newCashuProofs) {
        const proofData = this.cashuProofToProof(
          cashuProof,
          mintUrl,
          ProofState.UNSPENT,
          oldProofs[0]?.isOCR || false // Preserve OCR status
        );
        const proof = await this.proofRepo.create(proofData);
        newProofs.push(proof);
      }

      // Mark old proofs as spent
      for (const proof of oldProofs) {
        await this.proofRepo.transitionState(
          proof.id,
          ProofState.PENDING_SWAP,
          ProofState.SPENT,
          transactionId
        );
      }

      // Update transaction
      await this.txRepo.markCompleted(transactionId);

      return {
        newProofs,
        oldProofs,
        total: totalAmount,
        transactionId,
      };
    } catch (error: any) {
      // Rollback: mark proofs as unspent again
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

  // ============================================
  // SEND OPERATIONS
  // ============================================

  /**
   * Send tokens (select proofs and prepare for sending)
   * Returns proofs that can be encoded as token
   */
  async send(
    mintUrl: string,
    amount: number,
    useOCR: boolean = false
  ): Promise<{ proofs: Proof[]; change?: Proof[]; transactionId: string }> {
    const wallet = await this.getWallet(mintUrl);
    const transactionId = generateUUID();

    try {
      // Create transaction
      await this.txRepo.create({
        type: TransactionType.SEND,
        amount,
        mintUrl,
        status: TransactionStatus.PENDING,
        direction: TransactionDirection.OUTGOING,
        proofCount: 0,
      });

      // Select proofs (this locks them)
      const selection = await this.proofRepo.selectProofsForAmount(
        mintUrl,
        amount,
        transactionId,
        useOCR
      );

      // If exact amount, return selected proofs
      if (selection.change === 0) {
        await this.txRepo.update(transactionId, {
          proofCount: selection.proofs.length,
        });

        return {
          proofs: selection.proofs,
          transactionId,
        };
      }

      // Need to swap for exact amount + change
      const cashuProofs = selection.proofs.map(p => this.proofToCashuProof(p));

      const { send: sendProofs, returnChange: changeProofs } = await wallet.send(
        amount,
        cashuProofs
      );

      // Store send proofs (these will be sent)
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

      // Store change proofs (these stay with us)
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

      // Mark old proofs as spent
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
   * Confirm send (mark proofs as spent after successful transmission)
   */
  async confirmSend(proofIds: string[], transactionId: string): Promise<void> {
    for (const id of proofIds) {
      await this.proofRepo.transitionState(
        id,
        ProofState.PENDING_SEND,
        ProofState.SPENT,
        transactionId
      );
    }

    await this.txRepo.markCompleted(transactionId);
  }

  /**
   * Cancel send (rollback to unspent if send failed)
   */
  async cancelSend(proofIds: string[], transactionId: string): Promise<void> {
    for (const id of proofIds) {
      await this.proofRepo.transitionState(
        id,
        ProofState.PENDING_SEND,
        ProofState.UNSPENT
      );
    }

    await this.txRepo.markFailed(transactionId);
  }

  // ============================================
  // RECEIVE OPERATIONS
  // ============================================

  /**
   * Receive tokens (decode and store proofs from token string)
   */
  async receive(
    token: string,
    isOCR: boolean = false
  ): Promise<{ proofs: Proof[]; total: number; transactionId: string }> {
    const transactionId = generateUUID();

    try {
      // Decode token
      const decoded = this.decodeToken(token);

      const mintUrl = decoded.token[0]?.mint;
      if (!mintUrl) throw new Error('Invalid token: no mint URL');

      const wallet = await this.getWallet(mintUrl);

      // Get total amount
      const total = decoded.token[0].proofs.reduce((sum, p) => sum + p.amount, 0);

      // Create transaction
      await this.txRepo.create({
        type: TransactionType.RECEIVE,
        amount: total,
        mintUrl,
        status: TransactionStatus.PENDING,
        direction: TransactionDirection.INCOMING,
        proofCount: decoded.token[0].proofs.length,
      });

      // Receive proofs (this validates them with the mint)
      const { proofs: cashuProofs } = await wallet.receive(decoded);

      // Store proofs
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

      // Update transaction
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

  // ============================================
  // MELT OPERATIONS (Lightning)
  // ============================================

  /**
   * Get melt quote (prepare to pay Lightning invoice)
   */
  async getMeltQuote(
    mintUrl: string,
    invoice: string
  ): Promise<{ quote: string; amount: number; fee: number }> {
    const wallet = await this.getWallet(mintUrl);

    const { quote, amount, fee_reserve } = await wallet.getMeltQuote(invoice);

    return {
      quote,
      amount,
      fee: fee_reserve,
    };
  }

  /**
   * Melt tokens (pay Lightning invoice)
   */
  async melt(
    mintUrl: string,
    invoice: string,
    proofIds: string[]
  ): Promise<MeltResult> {
    const wallet = await this.getWallet(mintUrl);
    const transactionId = generateUUID();

    try {
      // Get proofs
      const proofs: Proof[] = [];
      for (const id of proofIds) {
        const proof = await this.proofRepo.getById(id);
        if (!proof) throw new Error(`Proof ${id} not found`);
        proofs.push(proof);
      }

      const totalAmount = proofs.reduce((sum, p) => sum + p.amount, 0);

      // Create transaction
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

      // Convert to Cashu proofs
      const cashuProofs = proofs.map(p => this.proofToCashuProof(p));

      // Melt
      const result = await wallet.meltTokens({
        proofs: cashuProofs,
        invoice,
      });

      // Mark proofs as spent
      for (const proof of proofs) {
        await this.proofRepo.transitionState(
          proof.id,
          ProofState.PENDING_SEND,
          ProofState.SPENT,
          transactionId
        );
      }

      // Store change if any
      let change: Proof[] | undefined;
      if (result.change && result.change.length > 0) {
        change = [];
        for (const cashuProof of result.change) {
          const proofData = this.cashuProofToProof(
            cashuProof,
            mintUrl,
            ProofState.UNSPENT,
            false
          );
          const proof = await this.proofRepo.create(proofData);
          change.push(proof);
        }
      }

      // Update transaction
      await this.txRepo.markCompleted(transactionId);

      return {
        isPaid: result.isPaid,
        preimage: result.preimage,
        change,
        fee: result.fee_reserve || 0,
        transactionId,
      };
    } catch (error: any) {
      // Rollback
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

  // ============================================
  // TOKEN OPERATIONS
  // ============================================

  /**
   * Encode proofs as token string
   */
  encodeToken(proofs: Proof[]): string {
    if (proofs.length === 0) throw new Error('No proofs to encode');

    const mintUrl = proofs[0].mintUrl;
    const cashuProofs = proofs.map(p => this.proofToCashuProof(p));

    // Group by mint (in case of multi-mint tokens)
    const token = {
      token: [
        {
          mint: mintUrl,
          proofs: cashuProofs,
        },
      ],
    };

    // Use Cashu library to encode
    return CashuWallet.getEncodedToken(token);
  }

  /**
   * Decode token string to proofs
   */
  decodeToken(token: string): any {
    return CashuWallet.getDecodedToken(token);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Check if proofs are spendable (valid with mint)
   */
  async checkProofsSpendable(
    mintUrl: string,
    proofIds: string[]
  ): Promise<{ spendable: boolean[]; total: number }> {
    const wallet = await this.getWallet(mintUrl);

    // Get proofs
    const proofs: Proof[] = [];
    for (const id of proofIds) {
      const proof = await this.proofRepo.getById(id);
      if (!proof) throw new Error(`Proof ${id} not found`);
      proofs.push(proof);
    }

    const cashuProofs = proofs.map(p => this.proofToCashuProof(p));

    // Check with mint
    const spendable = await wallet.checkProofsSpent(cashuProofs);

    const total = proofs
      .filter((_, i) => spendable[i])
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      spendable,
      total,
    };
  }

  /**
   * Get wallet info (balance, proof count)
   */
  getWalletInfo(mintUrl: string): {
    balance: number;
    proofCount: number;
    ocrBalance: number;
  } {
    const balance = this.proofRepo.getBalance(mintUrl);
    const proofs = this.proofRepo.getAll({ mintUrl, state: ProofState.UNSPENT });
    const ocrBalance = this.proofRepo.getOCRBalance();

    return {
      balance,
      proofCount: proofs.length,
      ocrBalance,
    };
  }
}

/**
 * Singleton instance export
 */
export default CashuWalletService.getInstance();
