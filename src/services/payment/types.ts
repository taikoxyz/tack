export type PaymentProtocol = 'x402' | 'mpp';
export const PAYMENT_ENDPOINTS = [
  'pin',
  'retrieval',
  'private_object',
  'private_object_renewal',
] as const;
export type PaymentEndpoint = typeof PAYMENT_ENDPOINTS[number];

export function isPaymentEndpoint(value: string): value is PaymentEndpoint {
  return (PAYMENT_ENDPOINTS as readonly string[]).includes(value);
}

export function paymentEndpointForPath(path: string): PaymentEndpoint {
  if (path.startsWith('/ipfs/')) {
    return 'retrieval';
  }

  if (path === '/private/objects') {
    return 'private_object';
  }

  if (/^\/private\/objects\/[^/]+\/renew$/.test(path)) {
    return 'private_object_renewal';
  }

  return 'pin';
}

/**
 * Outcome of a successful payment, set on Hono's request context as
 * `paymentResult` by either the MPP middleware (services/payment/middleware.ts)
 * or the x402 middleware (services/x402.ts) after a verified settlement.
 *
 * The usage metrics recorder consumes this in app.ts's per-request middleware:
 * if all required usage fields are present and the response is 2xx,
 * PaymentRecorder writes a row to the `payments` table.
 *
 * The first four fields are required for backwards compat with existing
 * callers (which use `wallet`, `protocol`, `chainName`, `receipt`).
 *
 * The remaining usage fields are OPTIONAL during the wiring transition.
 * Once T10 (MPP) and T11 (x402) populate them, the recorder will see them
 * for every paid request. The recorder skips rows when any required
 * usage field is missing rather than rejecting the request — better
 * an under-count than a half-blank row.
 */
export interface PaymentResult {
  wallet: string;
  protocol: PaymentProtocol;
  chainName: string;
  receipt?: string;

  // Usage fields (optional during transition; required-in-spirit
  // once T10 + T11 land).
  chainId?: number;
  amountAtomic?: string;
  amountUsd?: number;
  assetAddress?: string;
  assetDecimals?: number;
  endpoint?: PaymentEndpoint;
  txHash?: string;
}

export interface PaymentSettlementCallbacks {
  onSettlementSuccess?: () => void | Promise<void>;
  onSettlementFailure?: () => void | Promise<void>;
}
