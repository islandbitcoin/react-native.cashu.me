/**
 * IncomingParser Tests
 *
 * Tests for the incoming data parser utility that detects
 * Cashu tokens, Lightning invoices, and LNURLs.
 */

import {
  parseIncoming,
  isCashuToken,
  isLightningInvoice,
  isLnurl,
} from '../IncomingParser';

describe('IncomingParser', () => {
  describe('parseIncoming', () => {
    describe('Cashu Token Detection', () => {
      it('should detect Cashu v3 token (cashuA)', () => {
        const token = 'cashuAeyJ0b2tlbiI6W3sibWludCI6Imh0dHBzOi8vbWludC5leGFtcGxlLmNvbSJ9XX0=';
        const result = parseIncoming(token);

        expect(result.type).toBe('cashu');
        expect(result.data).toBe(token);
      });

      it('should detect Cashu v4 token (cashuB)', () => {
        const token = 'cashuBeyJ0b2tlbiI6W3sibWludCI6Imh0dHBzOi8vbWludC5leGFtcGxlLmNvbSJ9XX0=';
        const result = parseIncoming(token);

        expect(result.type).toBe('cashu');
        expect(result.data).toBe(token);
      });

      it('should detect lowercase cashu token', () => {
        const token = 'cashuaeyJ0b2tlbiI6W10=';
        const result = parseIncoming(token);

        expect(result.type).toBe('cashu');
      });

      it('should handle cashu: URI scheme', () => {
        const uri = 'cashu:cashuAeyJ0b2tlbiI6W119';
        const result = parseIncoming(uri);

        expect(result.type).toBe('cashu');
        expect(result.data).toBe('cashuAeyJ0b2tlbiI6W119');
      });

      it('should trim whitespace from token', () => {
        const token = '  cashuAeyJ0b2tlbiI6W119  ';
        const result = parseIncoming(token);

        expect(result.type).toBe('cashu');
        expect(result.data).toBe('cashuAeyJ0b2tlbiI6W119');
      });
    });

    describe('Lightning Invoice Detection', () => {
      it('should detect mainnet Lightning invoice (lnbc)', () => {
        const invoice = 'lnbc100n1pjkz4n2pp5xxxxxhash';
        const result = parseIncoming(invoice);

        expect(result.type).toBe('lightning');
        expect(result.data).toBe(invoice);
      });

      it('should detect testnet Lightning invoice (lntb)', () => {
        const invoice = 'lntb100n1pjkz4n2pp5xxxxxhash';
        const result = parseIncoming(invoice);

        expect(result.type).toBe('lightning');
        expect(result.data).toBe(invoice);
      });

      it('should detect regtest Lightning invoice (lnbcrt)', () => {
        const invoice = 'lnbcrt100n1pjkz4n2pp5xxxxxhash';
        const result = parseIncoming(invoice);

        expect(result.type).toBe('lightning');
        expect(result.data).toBe(invoice);
      });

      it('should detect uppercase Lightning invoice', () => {
        const invoice = 'LNBC100N1PJKZ4N2PP5XXXXXHASH';
        const result = parseIncoming(invoice);

        expect(result.type).toBe('lightning');
      });

      it('should handle lightning: URI scheme', () => {
        const uri = 'lightning:lnbc100n1pjkz4n2pp5xxxxxhash';
        const result = parseIncoming(uri);

        expect(result.type).toBe('lightning');
        expect(result.data).toBe('lnbc100n1pjkz4n2pp5xxxxxhash');
      });
    });

    describe('LNURL Detection', () => {
      it('should detect LNURL', () => {
        const lnurl = 'lnurl1dp68gurn8ghj7ampd3kx2ar0veekzar0wd5xj';
        const result = parseIncoming(lnurl);

        expect(result.type).toBe('lnurl');
        expect(result.data).toBe(lnurl);
      });

      it('should detect uppercase LNURL', () => {
        const lnurl = 'LNURL1DP68GURN8GHJ7AMPD3KX2AR0VEEKZAR0WD5XJ';
        const result = parseIncoming(lnurl);

        expect(result.type).toBe('lnurl');
      });
    });

    describe('Unknown Data', () => {
      it('should return unknown for random string', () => {
        const data = 'some random text';
        const result = parseIncoming(data);

        expect(result.type).toBe('unknown');
        expect(result.data).toBe(data);
      });

      it('should return unknown for empty string', () => {
        const result = parseIncoming('');

        expect(result.type).toBe('unknown');
        expect(result.data).toBe('');
      });

      it('should return unknown for Bitcoin address', () => {
        const address = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';
        const result = parseIncoming(address);

        expect(result.type).toBe('unknown');
      });

      it('should return unknown for URLs', () => {
        const url = 'https://example.com';
        const result = parseIncoming(url);

        expect(result.type).toBe('unknown');
      });
    });
  });

  describe('isCashuToken', () => {
    it('should return true for cashuA token', () => {
      expect(isCashuToken('cashuAeyJ0b2tlbiI6W119')).toBe(true);
    });

    it('should return true for cashuB token', () => {
      expect(isCashuToken('cashuBeyJ0b2tlbiI6W119')).toBe(true);
    });

    it('should return false for Lightning invoice', () => {
      expect(isCashuToken('lnbc100n1pjkz4n2')).toBe(false);
    });

    it('should return false for random string', () => {
      expect(isCashuToken('hello world')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(isCashuToken('  cashuAeyJ0b2tlbiI6  ')).toBe(true);
    });
  });

  describe('isLightningInvoice', () => {
    it('should return true for lnbc invoice', () => {
      expect(isLightningInvoice('lnbc100n1pjkz4n2')).toBe(true);
    });

    it('should return true for lntb invoice', () => {
      expect(isLightningInvoice('lntb100n1pjkz4n2')).toBe(true);
    });

    it('should return true for lnbcrt invoice', () => {
      expect(isLightningInvoice('lnbcrt100n1pjkz4n2')).toBe(true);
    });

    it('should return true for lightning: URI', () => {
      expect(isLightningInvoice('lightning:lnbc100n1')).toBe(true);
    });

    it('should return false for Cashu token', () => {
      expect(isLightningInvoice('cashuAeyJ0b2tlbiI6')).toBe(false);
    });

    it('should return false for random string', () => {
      expect(isLightningInvoice('hello world')).toBe(false);
    });
  });

  describe('isLnurl', () => {
    it('should return true for LNURL', () => {
      expect(isLnurl('lnurl1dp68gurn8ghj7')).toBe(true);
    });

    it('should return false for Lightning invoice', () => {
      expect(isLnurl('lnbc100n1pjkz4n2')).toBe(false);
    });

    it('should return false for Cashu token', () => {
      expect(isLnurl('cashuAeyJ0b2tlbiI6')).toBe(false);
    });

    it('should return false for random string', () => {
      expect(isLnurl('hello world')).toBe(false);
    });
  });
});
