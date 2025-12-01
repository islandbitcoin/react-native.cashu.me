/**
 * Incoming Parser
 *
 * Detects the type of scanned data and routes appropriately.
 * Supports: Cashu tokens, Lightning invoices, LNURL
 */

export type IncomingType = 'cashu' | 'lightning' | 'lnurl' | 'unknown';

export interface ParsedIncoming {
  type: IncomingType;
  data: string;
  amount?: number;
  memo?: string;
}

/**
 * Parse incoming data from QR code or paste
 */
export function parseIncoming(data: string): ParsedIncoming {
  const trimmed = data.trim();
  const lower = trimmed.toLowerCase();

  // Check for cashu: URI scheme FIRST (before generic cashu check)
  if (lower.startsWith('cashu:')) {
    const token = trimmed.substring(6);
    return {
      type: 'cashu',
      data: token,
    };
  }

  // Check for lightning: URI scheme FIRST (before generic invoice check)
  if (lower.startsWith('lightning:')) {
    const invoice = trimmed.substring(10);
    return parseIncoming(invoice);
  }

  // Check for Cashu token (v4: cashuB, v3: cashuA)
  if (lower.startsWith('cashu')) {
    return {
      type: 'cashu',
      data: trimmed,
    };
  }

  // Check for Lightning invoice (BOLT11)
  if (lower.startsWith('lnbc') || lower.startsWith('lntb') || lower.startsWith('lnbcrt')) {
    return {
      type: 'lightning',
      data: trimmed,
      // Amount would need to be decoded from invoice
    };
  }

  // Check for LNURL
  if (lower.startsWith('lnurl')) {
    return {
      type: 'lnurl',
      data: trimmed,
    };
  }

  return {
    type: 'unknown',
    data: trimmed,
  };
}

/**
 * Check if string looks like a valid Cashu token
 */
export function isCashuToken(data: string): boolean {
  const lower = data.toLowerCase().trim();
  return lower.startsWith('cashu');
}

/**
 * Check if string looks like a Lightning invoice
 */
export function isLightningInvoice(data: string): boolean {
  const lower = data.toLowerCase().trim();
  return (
    lower.startsWith('lnbc') ||
    lower.startsWith('lntb') ||
    lower.startsWith('lnbcrt') ||
    lower.startsWith('lightning:')
  );
}

/**
 * Check if string looks like an LNURL
 */
export function isLnurl(data: string): boolean {
  const lower = data.toLowerCase().trim();
  return lower.startsWith('lnurl');
}
