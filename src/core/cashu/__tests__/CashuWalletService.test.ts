/**
 * CashuWalletService Tests
 *
 * Tests for the main Cashu wallet operations including
 * send, receive, melt (Lightning payments), and mint operations.
 */

import { CashuMint, CashuWallet, getEncodedToken, getDecodedToken } from '@cashu/cashu-ts';
import { CashuWalletService } from '../CashuWalletService';
import ProofRepository from '../../../data/repositories/ProofRepository';
import MintRepository from '../../../data/repositories/MintRepository';
import TransactionRepository from '../../../data/repositories/TransactionRepository';
import { ProofState, TransactionStatus, Proof } from '../../../types';

// Create shared mock instances that will be used by both test and service
const mockProofRepoInstance = {
  create: jest.fn(),
  getById: jest.fn(),
  getBalance: jest.fn(),
  getProofCount: jest.fn(),
  getOCRBalance: jest.fn(),
  selectProofsForAmount: jest.fn(),
  transitionState: jest.fn(),
  getStats: jest.fn(),
};

const mockMintRepoInstance = {
  create: jest.fn(),
  getByUrl: jest.fn(),
};

const mockTxRepoInstance = {
  create: jest.fn(),
  update: jest.fn(),
  markCompleted: jest.fn(),
  markFailed: jest.fn(),
};

// Mock dependencies
jest.mock('@cashu/cashu-ts', () => ({
  CashuMint: jest.fn(),
  CashuWallet: jest.fn(),
  getEncodedToken: jest.fn(),
  getDecodedToken: jest.fn(),
}));

jest.mock('../../../data/repositories/ProofRepository', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => mockProofRepoInstance),
  },
}));

jest.mock('../../../data/repositories/MintRepository', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => mockMintRepoInstance),
  },
}));

jest.mock('../../../data/repositories/TransactionRepository', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => mockTxRepoInstance),
  },
}));

jest.mock('../../../utils/uuid', () => ({
  generateUUID: jest.fn(() => 'test-uuid-123'),
}));

describe('CashuWalletService', () => {
  let service: CashuWalletService;
  let mockWallet: jest.Mocked<any>;
  let mockMint: jest.Mocked<any>;

  const testMintUrl = 'https://mint.example.com';
  const testProofs: Proof[] = [
    {
      id: 'proof-1',
      secret: 'secret1',
      C: 'C1',
      amount: 64,
      mintUrl: testMintUrl,
      keysetId: 'keyset1',
      state: ProofState.UNSPENT,
      isOCR: false,
      createdAt: Date.now(),
    },
    {
      id: 'proof-2',
      secret: 'secret2',
      C: 'C2',
      amount: 32,
      mintUrl: testMintUrl,
      keysetId: 'keyset1',
      state: ProofState.UNSPENT,
      isOCR: false,
      createdAt: Date.now(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton for each test
    (CashuWalletService as any).instance = undefined;

    // Setup mock wallet
    mockWallet = {
      createMintQuote: jest.fn().mockResolvedValue({
        quote: 'quote-123',
        request: 'lnbc100n1...',
      }),
      mintProofs: jest.fn().mockResolvedValue([
        { amount: 64, secret: 'new-secret-1', C: 'new-C-1', id: 'keyset1' },
        { amount: 32, secret: 'new-secret-2', C: 'new-C-2', id: 'keyset1' },
      ]),
      send: jest.fn().mockResolvedValue({
        send: [{ amount: 64, secret: 'send-secret', C: 'send-C', id: 'keyset1' }],
        keep: [{ amount: 32, secret: 'keep-secret', C: 'keep-C', id: 'keyset1' }],
      }),
      receive: jest.fn().mockResolvedValue([
        { amount: 100, secret: 'received-secret', C: 'received-C', id: 'keyset1' },
      ]),
      createMeltQuote: jest.fn().mockResolvedValue({
        quote: 'melt-quote-123',
        amount: 100,
        fee_reserve: 2,
        state: 'UNPAID',
        expiry: Date.now() + 600000,
      }),
      checkMeltQuote: jest.fn().mockResolvedValue({
        quote: 'melt-quote-123',
        amount: 100,
        fee_reserve: 2,
        state: 'UNPAID',
      }),
      meltProofs: jest.fn().mockResolvedValue({
        quote: {
          state: 'PAID',
          payment_preimage: 'preimage-abc123',
        },
        change: [{ amount: 2, secret: 'change-secret', C: 'change-C', id: 'keyset1' }],
      }),
      checkProofsStates: jest.fn().mockResolvedValue([
        { state: 'UNSPENT' },
        { state: 'SPENT' },
      ]),
    };

    mockMint = {};

    (CashuMint as jest.Mock).mockImplementation(() => mockMint);
    (CashuWallet as jest.Mock).mockImplementation(() => mockWallet);

    // Setup mock proof repository
    mockProofRepoInstance.create.mockImplementation(async (data) => ({
      id: `proof-${Date.now()}`,
      ...data,
      createdAt: Date.now(),
    }));

    mockProofRepoInstance.getById.mockImplementation(async (id) =>
      testProofs.find((p) => p.id === id) || null
    );

    mockProofRepoInstance.selectProofsForAmount.mockResolvedValue({
      proofs: testProofs,
      total: 96,
      change: 0,
    });

    mockProofRepoInstance.transitionState.mockResolvedValue(true);
    mockProofRepoInstance.getBalance.mockReturnValue(1000);
    mockProofRepoInstance.getProofCount.mockReturnValue(10);
    mockProofRepoInstance.getOCRBalance.mockReturnValue(200);
    mockProofRepoInstance.getStats.mockReturnValue({
      totalBalance: 1000,
      unspentCount: 10,
      spentCount: 5,
      pendingCount: 0,
    });

    // Setup mock transaction repository
    mockTxRepoInstance.create.mockResolvedValue({
      id: 'tx-123',
      type: 'SEND',
      amount: 100,
      mintUrl: testMintUrl,
      status: TransactionStatus.PENDING,
      createdAt: Date.now(),
    } as any);

    // Setup token encoding/decoding mocks
    (getEncodedToken as jest.Mock).mockReturnValue('cashuAeyJ0b2tlbiI6W119');
    (getDecodedToken as jest.Mock).mockReturnValue({
      token: [
        {
          mint: testMintUrl,
          proofs: [{ amount: 100, secret: 'decoded-secret', C: 'decoded-C', id: 'keyset1' }],
        },
      ],
    });

    service = CashuWalletService.getInstance();
  });

  describe('Send Operations', () => {
    describe('send()', () => {
      it('should mark proofs as SPENT when exact amount found', async () => {
        mockProofRepoInstance.selectProofsForAmount.mockResolvedValue({
          proofs: [testProofs[0]], // 64 sats
          total: 64,
          change: 0, // Exact match
        });

        const result = await service.send(testMintUrl, 64);

        expect(result.proofs).toHaveLength(1);
        expect(result.transactionId).toBe('test-uuid-123');
        expect(mockProofRepoInstance.transitionState).toHaveBeenCalledWith(
          testProofs[0].id,
          ProofState.PENDING_SEND,
          ProofState.SPENT,
          'test-uuid-123'
        );
      });

      it('should create change proofs when amount does not match exactly', async () => {
        mockProofRepoInstance.selectProofsForAmount.mockResolvedValue({
          proofs: testProofs, // 96 sats
          total: 96,
          change: 32, // Need change
        });

        const result = await service.send(testMintUrl, 64);

        expect(mockWallet.send).toHaveBeenCalledWith(64, expect.any(Array));
        expect(result.proofs).toBeDefined();
        expect(result.change).toBeDefined();
        expect(mockProofRepoInstance.create).toHaveBeenCalled();
      });

      it('should mark transaction as COMPLETED on success', async () => {
        mockProofRepoInstance.selectProofsForAmount.mockResolvedValue({
          proofs: [testProofs[0]],
          total: 64,
          change: 0,
        });

        await service.send(testMintUrl, 64);

        expect(mockTxRepoInstance.update).toHaveBeenCalledWith(
          'test-uuid-123',
          expect.objectContaining({
            status: TransactionStatus.COMPLETED,
          })
        );
      });

      it('should throw error on insufficient balance', async () => {
        mockProofRepoInstance.selectProofsForAmount.mockRejectedValue(
          new Error('Insufficient balance')
        );

        await expect(service.send(testMintUrl, 10000)).rejects.toThrow(
          'Send failed: Insufficient balance'
        );

        expect(mockTxRepoInstance.markFailed).toHaveBeenCalledWith('test-uuid-123');
      });
    });

    describe('confirmSend()', () => {
      it('should transition proofs from PENDING_SEND to SPENT', async () => {
        await service.confirmSend(['proof-1', 'proof-2'], 'tx-123');

        expect(mockProofRepoInstance.transitionState).toHaveBeenCalledWith(
          'proof-1',
          ProofState.PENDING_SEND,
          ProofState.SPENT,
          'tx-123'
        );
        expect(mockProofRepoInstance.transitionState).toHaveBeenCalledWith(
          'proof-2',
          ProofState.PENDING_SEND,
          ProofState.SPENT,
          'tx-123'
        );
        expect(mockTxRepoInstance.markCompleted).toHaveBeenCalledWith('tx-123');
      });
    });

    describe('cancelSend()', () => {
      it('should reset proofs to UNSPENT', async () => {
        await service.cancelSend(['proof-1', 'proof-2'], 'tx-123');

        expect(mockProofRepoInstance.transitionState).toHaveBeenCalledWith(
          'proof-1',
          ProofState.PENDING_SEND,
          ProofState.UNSPENT
        );
        expect(mockProofRepoInstance.transitionState).toHaveBeenCalledWith(
          'proof-2',
          ProofState.PENDING_SEND,
          ProofState.UNSPENT
        );
        expect(mockTxRepoInstance.markFailed).toHaveBeenCalledWith('tx-123');
      });
    });

    describe('encodeToken()', () => {
      it('should create valid token string', () => {
        const token = service.encodeToken(testProofs);

        expect(getEncodedToken).toHaveBeenCalledWith({
          mint: testMintUrl,
          proofs: expect.arrayContaining([
            expect.objectContaining({ secret: 'secret1', C: 'C1', amount: 64 }),
          ]),
        });
        expect(token).toBe('cashuAeyJ0b2tlbiI6W119');
      });

      it('should throw error for empty proofs array', () => {
        expect(() => service.encodeToken([])).toThrow('No proofs to encode');
      });
    });
  });

  describe('Melt Operations (Lightning Payments)', () => {
    const testInvoice = 'lnbc100n1pjkz4n2pp5xxxxxhash';

    describe('getMeltQuote()', () => {
      it('should return quote with amount and feeReserve', async () => {
        const result = await service.getMeltQuote(testMintUrl, testInvoice);

        expect(result.quote).toBe('melt-quote-123');
        expect(result.amount).toBe(100);
        expect(result.feeReserve).toBe(2);
        expect(result.state).toBe('UNPAID');
        expect(mockWallet.createMeltQuote).toHaveBeenCalledWith(testInvoice);
      });

      it('should handle invalid invoice error', async () => {
        mockWallet.createMeltQuote.mockRejectedValue(
          new Error('Invalid invoice')
        );

        await expect(
          service.getMeltQuote(testMintUrl, 'invalid-invoice')
        ).rejects.toThrow('Failed to get melt quote: Invalid invoice');
      });
    });

    describe('melt()', () => {
      it('should mark proofs as SPENT after successful payment', async () => {
        const result = await service.melt(testMintUrl, testInvoice, 'melt-quote-123');

        expect(result.paid).toBe(true);
        expect(mockProofRepoInstance.transitionState).toHaveBeenCalledWith(
          expect.any(String),
          ProofState.PENDING_SEND,
          ProofState.SPENT,
          'test-uuid-123'
        );
      });

      it('should return payment preimage on success', async () => {
        const result = await service.melt(testMintUrl, testInvoice, 'melt-quote-123');

        expect(result.paid).toBe(true);
        expect(result.preimage).toBe('preimage-abc123');
      });

      it('should store change proofs', async () => {
        const result = await service.melt(testMintUrl, testInvoice, 'melt-quote-123');

        expect(result.change).toBeDefined();
        expect(result.change).toHaveLength(1);
        expect(mockProofRepoInstance.create).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 2,
            state: ProofState.UNSPENT,
          })
        );
      });

      it('should handle payment failure', async () => {
        mockWallet.meltProofs.mockResolvedValue({
          quote: { state: 'UNPAID' },
          change: [],
        });

        const result = await service.melt(testMintUrl, testInvoice, 'melt-quote-123');

        expect(result.paid).toBe(false);
        expect(result.preimage).toBeUndefined();
      });

      it('should handle network errors', async () => {
        mockWallet.checkMeltQuote.mockRejectedValue(
          new Error('Network timeout')
        );

        await expect(
          service.melt(testMintUrl, testInvoice, 'melt-quote-123')
        ).rejects.toThrow('Melt failed: Network timeout');

        expect(mockTxRepoInstance.markFailed).toHaveBeenCalledWith('test-uuid-123');
      });
    });
  });

  describe('Receive Operations', () => {
    const testToken = 'cashuAeyJ0b2tlbiI6W119';

    describe('receive()', () => {
      it('should store new proofs as UNSPENT', async () => {
        const result = await service.receive(testToken);

        expect(result.proofs).toBeDefined();
        expect(mockProofRepoInstance.create).toHaveBeenCalledWith(
          expect.objectContaining({
            state: ProofState.UNSPENT,
            mintUrl: testMintUrl,
          })
        );
      });

      it('should return total amount received', async () => {
        const result = await service.receive(testToken);

        expect(result.total).toBe(100);
      });

      it('should mark transaction as completed', async () => {
        await service.receive(testToken);

        expect(mockTxRepoInstance.markCompleted).toHaveBeenCalledWith('test-uuid-123');
      });

      it('should handle already-spent token error', async () => {
        mockWallet.receive.mockRejectedValue(
          new Error('Token already spent')
        );

        await expect(service.receive(testToken)).rejects.toThrow(
          'Receive failed: Token already spent'
        );

        expect(mockTxRepoInstance.markFailed).toHaveBeenCalledWith('test-uuid-123');
      });

      it('should handle invalid token format', async () => {
        (getDecodedToken as jest.Mock).mockReturnValue({
          token: [{ mint: null, proofs: [] }],
        });

        await expect(service.receive('invalid-token')).rejects.toThrow(
          'Receive failed: Invalid token: no mint URL'
        );
      });
    });

    describe('decodeToken()', () => {
      it('should extract mint URL and proofs from token', () => {
        const decoded = service.decodeToken(testToken);

        expect(getDecodedToken).toHaveBeenCalledWith(testToken);
        expect(decoded.token[0].mint).toBe(testMintUrl);
        expect(decoded.token[0].proofs).toHaveLength(1);
      });
    });
  });

  describe('Mint Operations', () => {
    describe('requestMintQuote()', () => {
      it('should return quote with Lightning invoice', async () => {
        const result = await service.requestMintQuote(testMintUrl, 1000);

        expect(result.quote).toBe('quote-123');
        expect(result.request).toBe('lnbc100n1...');
        expect(mockWallet.createMintQuote).toHaveBeenCalledWith(1000);
      });

      it('should handle mint errors', async () => {
        mockWallet.createMintQuote.mockRejectedValue(
          new Error('Mint offline')
        );

        await expect(
          service.requestMintQuote(testMintUrl, 1000)
        ).rejects.toThrow('Mint offline');
      });
    });

    describe('mintTokens()', () => {
      it('should store new proofs as UNSPENT', async () => {
        const result = await service.mintTokens(
          testMintUrl,
          96,
          'quote-123',
          false
        );

        expect(result.proofs).toBeDefined();
        expect(result.total).toBe(96);
        expect(mockProofRepoInstance.create).toHaveBeenCalledWith(
          expect.objectContaining({
            state: ProofState.UNSPENT,
            isOCR: false,
          })
        );
      });

      it('should mark proofs as OCR when specified', async () => {
        await service.mintTokens(testMintUrl, 96, 'quote-123', true);

        expect(mockProofRepoInstance.create).toHaveBeenCalledWith(
          expect.objectContaining({
            isOCR: true,
          })
        );
      });

      it('should mark transaction as completed', async () => {
        await service.mintTokens(testMintUrl, 96, 'quote-123', false);

        expect(mockTxRepoInstance.update).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            status: TransactionStatus.COMPLETED,
          })
        );
      });

      it('should handle mint failure', async () => {
        mockWallet.mintProofs.mockRejectedValue(
          new Error('Quote not paid')
        );

        await expect(
          service.mintTokens(testMintUrl, 96, 'quote-123', false)
        ).rejects.toThrow('Mint failed: Quote not paid');

        expect(mockTxRepoInstance.markFailed).toHaveBeenCalled();
      });
    });
  });

  describe('Utility Methods', () => {
    describe('checkProofsSpendable()', () => {
      it('should return spendability status for each proof', async () => {
        const result = await service.checkProofsSpendable(testMintUrl, [
          'proof-1',
          'proof-2',
        ]);

        expect(result.spendable).toEqual([true, false]);
        expect(mockWallet.checkProofsStates).toHaveBeenCalled();
      });

      it('should calculate total of spendable proofs', async () => {
        const result = await service.checkProofsSpendable(testMintUrl, [
          'proof-1',
          'proof-2',
        ]);

        // proof-1 is spendable (64 sats), proof-2 is spent
        expect(result.total).toBe(64);
      });

      it('should throw error for non-existent proof', async () => {
        await expect(
          service.checkProofsSpendable(testMintUrl, ['non-existent'])
        ).rejects.toThrow('Proof non-existent not found');
      });
    });

    describe('getWalletInfo()', () => {
      it('should return wallet balance and proof count', () => {
        const info = service.getWalletInfo(testMintUrl);

        expect(info.balance).toBe(1000);
        expect(info.proofCount).toBe(10);
        expect(info.ocrBalance).toBe(200);
        expect(mockProofRepoInstance.getBalance).toHaveBeenCalledWith(testMintUrl);
        expect(mockProofRepoInstance.getProofCount).toHaveBeenCalledWith(testMintUrl);
      });
    });
  });

  describe('Swap Operations', () => {
    describe('swapProofs()', () => {
      it('should swap proofs and return new proofs', async () => {
        const result = await service.swapProofs(testMintUrl, ['proof-1', 'proof-2']);

        expect(result.newProofs).toBeDefined();
        expect(result.oldProofs).toHaveLength(2);
        expect(result.total).toBe(96);
        expect(mockWallet.send).toHaveBeenCalledWith(96, expect.any(Array));
      });

      it('should mark old proofs as SPENT', async () => {
        await service.swapProofs(testMintUrl, ['proof-1', 'proof-2']);

        expect(mockProofRepoInstance.transitionState).toHaveBeenCalledWith(
          'proof-1',
          ProofState.PENDING_SWAP,
          ProofState.SPENT,
          expect.any(String)
        );
      });

      it('should rollback on swap failure', async () => {
        mockWallet.send.mockRejectedValue(new Error('Swap failed at mint'));

        await expect(
          service.swapProofs(testMintUrl, ['proof-1', 'proof-2'])
        ).rejects.toThrow('Swap failed: Swap failed at mint');

        // Should rollback proofs to UNSPENT
        expect(mockProofRepoInstance.transitionState).toHaveBeenCalledWith(
          'proof-1',
          ProofState.PENDING_SWAP,
          ProofState.UNSPENT
        );
      });

      it('should reject swapping already-spent proofs', async () => {
        mockProofRepoInstance.getById.mockImplementation(async (id) => {
          if (id === 'proof-1') {
            return { ...testProofs[0], state: ProofState.SPENT };
          }
          return testProofs.find((p) => p.id === id) || null;
        });

        await expect(
          service.swapProofs(testMintUrl, ['proof-1'])
        ).rejects.toThrow('Swap failed: Proof proof-1 is not unspent');
      });
    });
  });
});
