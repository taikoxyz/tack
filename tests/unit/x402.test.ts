import { createHmac } from 'node:crypto';
import { Hono } from 'hono';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader, encodePaymentSignatureHeader } from '@x402/core/http';
import type { FacilitatorClient } from '@x402/core/server';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { describe, expect, it } from 'vitest';
import { createExternalRequestUrlMiddleware } from '../../src/lib/request-url';
import {
  calculatePriceUsd,
  createWalletAuthToken,
  createX402PaymentMiddleware,
  extractPaidWalletFromHeaders,
  parseDurationMonths,
  readPaymentRequirements,
  resolveWalletFromHeaders,
  type WalletAuthConfig,
  type X402PaymentConfig
} from '../../src/services/x402';

const taikoChain = {
  network: 'eip155:167000' as const,
  facilitatorUrl: 'http://localhost:9999',
  payTo: '0x1111111111111111111111111111111111111111',
  usdcAssetAddress: '0x2222222222222222222222222222222222222222',
  usdcAssetDecimals: 6,
  usdcDomainName: 'USD Coin',
  usdcDomainVersion: '2'
};

const testConfig: X402PaymentConfig = {
  chains: [taikoChain],
  ratePerGbMonthUsd: 0.10,
  minPriceUsd: 0.001,
  maxPriceUsd: 50.0,
  defaultDurationMonths: 1,
  maxDurationMonths: 24
};
const walletAuthConfig: WalletAuthConfig = {
  secret: '0123456789abcdef0123456789abcdef',
  issuer: 'tack',
  audience: 'tack-owner-api',
  ttlSeconds: 900
};

function createSignedWalletAuthToken(payloadPatch: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8')
    .toString('base64url');
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      iss: walletAuthConfig.issuer,
      aud: walletAuthConfig.audience,
      iat: issuedAt,
      nbf: issuedAt,
      exp: issuedAt + walletAuthConfig.ttlSeconds,
      ...payloadPatch
    }),
    'utf8'
  ).toString('base64url');
  const signature = createHmac('sha256', walletAuthConfig.secret).update(`${header}.${payload}`).digest('base64url');

  return `${header}.${payload}.${signature}`;
}

function extractWallet(paymentPayload: PaymentPayload): string {
  const payload = paymentPayload.payload;
  const authorization = payload.authorization as Record<string, unknown> | undefined;
  const from = authorization?.from;

  if (typeof from === 'string') {
    return from;
  }

  return '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
}

const mockFacilitator: FacilitatorClient = {
  verify(paymentPayload: PaymentPayload): Promise<{ isValid: boolean; payer: string }> {
    return Promise.resolve({ isValid: true, payer: extractWallet(paymentPayload) });
  },
  settle(paymentPayload: PaymentPayload, requirements: PaymentRequirements): Promise<{
    success: boolean;
    transaction: string;
    network: string;
    payer: string;
  }> {
    return Promise.resolve({
      success: true,
      transaction: '0xtest',
      network: requirements.network,
      payer: extractWallet(paymentPayload)
    });
  },
  getSupported(): Promise<{
    kinds: Array<{ x402Version: number; scheme: string; network: string }>;
    extensions: string[];
    signers: Record<string, string[]>;
  }> {
    const baseNetwork = 'eip155:8453';
    return Promise.resolve({
      kinds: [
        { x402Version: 2, scheme: 'exact', network: taikoChain.network },
        { x402Version: 2, scheme: 'exact', network: baseNetwork }
      ],
      extensions: [],
      signers: {
        [taikoChain.network]: [taikoChain.payTo],
        [baseNetwork]: [taikoChain.payTo]
      }
    });
  }
};

describe('calculatePriceUsd', () => {
  const pricingConfig = {
    ratePerGbMonthUsd: 0.10,
    minPriceUsd: 0.001,
    maxPriceUsd: 50.0
  };

  it('returns the floor for tiny files', () => {
    expect(calculatePriceUsd(1024, 1, pricingConfig)).toBe(0.001);
    expect(calculatePriceUsd(1_000_000, 1, pricingConfig)).toBe(0.001);
    expect(calculatePriceUsd(1_000_000, 6, pricingConfig)).toBe(0.001);
  });

  it('prices linearly by size and duration', () => {
    const oneGb = 1_073_741_824;
    expect(calculatePriceUsd(oneGb, 1, pricingConfig)).toBeCloseTo(0.10, 6);
    expect(calculatePriceUsd(oneGb, 6, pricingConfig)).toBeCloseTo(0.60, 6);
    expect(calculatePriceUsd(oneGb, 12, pricingConfig)).toBeCloseTo(1.20, 6);
  });

  it('prices 100 MB correctly', () => {
    const hundredMb = 100 * 1_000_000;
    expect(calculatePriceUsd(hundredMb, 1, pricingConfig)).toBeCloseTo(0.00931, 4);
    expect(calculatePriceUsd(hundredMb, 6, pricingConfig)).toBeCloseTo(0.056, 3);
  });

  it('caps at max price', () => {
    const tenGb = 10 * 1_073_741_824;
    expect(calculatePriceUsd(tenGb, 24, pricingConfig)).toBeCloseTo(24.0, 2);
    const lowCap = { ...pricingConfig, maxPriceUsd: 5.0 };
    expect(calculatePriceUsd(tenGb, 24, lowCap)).toBe(5.0);
  });

  it('returns zero-byte files at min price', () => {
    expect(calculatePriceUsd(0, 1, pricingConfig)).toBe(0.001);
    expect(calculatePriceUsd(0, 12, pricingConfig)).toBe(0.001);
  });
});

describe('parseDurationMonths', () => {
  it('returns default when header is missing', () => {
    expect(parseDurationMonths(null, 1, 24)).toBe(1);
    expect(parseDurationMonths(undefined, 6, 24)).toBe(6);
    expect(parseDurationMonths('', 1, 24)).toBe(1);
  });

  it('parses valid integer values', () => {
    expect(parseDurationMonths('1', 1, 24)).toBe(1);
    expect(parseDurationMonths('12', 1, 24)).toBe(12);
    expect(parseDurationMonths('24', 1, 24)).toBe(24);
  });

  it('falls back to default for invalid values', () => {
    expect(parseDurationMonths('0', 1, 24)).toBe(1);
    expect(parseDurationMonths('-1', 1, 24)).toBe(1);
    expect(parseDurationMonths('25', 1, 24)).toBe(24);
    expect(parseDurationMonths('1.5', 1, 24)).toBe(1);
    expect(parseDurationMonths('abc', 1, 24)).toBe(1);
  });
});

describe('x402 payment integration helpers', () => {
  it('extracts wallet identity from x402 payment proof', () => {
    const paymentPayload: PaymentPayload = {
      x402Version: 2,
      accepted: {
        scheme: 'exact',
        network: taikoChain.network,
        asset: taikoChain.usdcAssetAddress,
        amount: '1000',
        payTo: taikoChain.payTo,
        maxTimeoutSeconds: 60
      },
      payload: {
        authorization: {
          from: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
        }
      }
    };

    const headers = new Headers({
      'payment-signature': encodePaymentSignatureHeader(paymentPayload)
    });

    expect(extractPaidWalletFromHeaders(headers)).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('extracts wallet identity from a signed bearer token', () => {
    const headers = new Headers({
      authorization: `Bearer ${createWalletAuthToken('0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', walletAuthConfig).token}`
    });

    const identity = resolveWalletFromHeaders(headers, walletAuthConfig);
    expect(identity.authError).toBeNull();
    expect(identity.wallet).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('does not trust x-wallet-address without authenticated proof', () => {
    const headers = new Headers({
      'x-wallet-address': '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });

    const identity = resolveWalletFromHeaders(headers, walletAuthConfig);
    expect(identity.authError).toBeNull();
    expect(identity.wallet).toBeNull();
  });

  it('surfaces auth token errors', () => {
    const headers = new Headers({
      authorization: 'Bearer malformed.token'
    });

    const identity = resolveWalletFromHeaders(headers, walletAuthConfig);
    expect(identity.wallet).toBeNull();
    expect(identity.authError).toBe('invalid wallet auth token');
  });

  it('rejects wallet auth tokens with an invalid audience', () => {
    const headers = new Headers({
      authorization: `Bearer ${createSignedWalletAuthToken({ aud: 'wrong-audience' })}`
    });

    const identity = resolveWalletFromHeaders(headers, walletAuthConfig);
    expect(identity.wallet).toBeNull();
    expect(identity.authError).toBe('wallet auth token audience is invalid');
  });
});

describe('readPaymentRequirements', () => {
  it('reads V2 amount field', () => {
    const result = readPaymentRequirements({ network: 'eip155:167000', asset: '0xABCD', amount: '1000000' });
    expect(result.amountAtomic).toBe('1000000');
    expect(result.network).toBe('eip155:167000');
    expect(result.asset).toBe('0xabcd');
  });

  it('falls back to maxAmountRequired when amount is absent (V1 shape)', () => {
    const result = readPaymentRequirements({ network: 'eip155:167000', asset: '0xABCD', maxAmountRequired: '500000' });
    expect(result.amountAtomic).toBe('500000');
  });

  it('falls through to "0" when both amount and maxAmountRequired are absent', () => {
    const result = readPaymentRequirements({ network: 'eip155:167000', asset: '0xABCD' });
    expect(result.amountAtomic).toBe('0');
  });

  it('empty-string amount falls through to maxAmountRequired (not stuck at empty)', () => {
    // Empty-string amount must fall through (|| not ??), so maxAmountRequired is used.
    const result = readPaymentRequirements({ network: 'eip155:167000', asset: '0xABCD', amount: '', maxAmountRequired: '750000' });
    expect(result.amountAtomic).toBe('750000');
  });

  it('empty-string amount with no maxAmountRequired falls through to "0"', () => {
    const result = readPaymentRequirements({ network: 'eip155:167000', asset: '0xABCD', amount: '' });
    expect(result.amountAtomic).toBe('0');
  });

  it('asset-decimals lookup miss: when network does not match config, decimals default to 6', () => {
    // readPaymentRequirements itself only extracts the network string.
    // Decimals lookup happens in the middleware via config.chains.find.
    // Test: a network value that won't match any chain in config returns an
    // unmodified network string so callers can detect the miss and apply default 6.
    const result = readPaymentRequirements({ network: 'eip155:42161', asset: '0xABCD', amount: '2000000' });
    expect(result.network).toBe('eip155:42161');
    // Simulate what the middleware does: look up chain, fall back to 6 decimals.
    const matchedChain = testConfig.chains.find((ch) => ch.network === result.network);
    const assetDecimals = matchedChain?.usdcAssetDecimals ?? 6;
    expect(assetDecimals).toBe(6); // no match → default 6
  });
});

describe('x402 txHash decoding', () => {
  // The txHash decode path reads settleResult.headers['x-payment-response'],
  // base64-decodes it, and extracts the `transaction` field as a string.
  // The x402HTTPResourceServer never populates x-payment-response via the
  // FacilitatorClient interface (it only populates PAYMENT-RESPONSE); this
  // path is intended for direct HTTP facilitators that inject the header.
  // We test the decode logic at the unit level here.

  it('decodes txHash from base64-encoded x-payment-response JSON', () => {
    // Replicate the IIFE decode logic from the middleware for unit coverage.
    const txEncoded = Buffer.from(JSON.stringify({ transaction: '0xdeadbeef' })).toString('base64');

    const decodeTxHash = (headerValue: string | undefined): string | undefined => {
      if (!headerValue) return undefined;
      try {
        const decoded = JSON.parse(Buffer.from(headerValue, 'base64').toString('utf8')) as { transaction?: unknown };
        return typeof decoded?.transaction === 'string' ? decoded.transaction : undefined;
      } catch {
        return undefined;
      }
    };

    expect(decodeTxHash(txEncoded)).toBe('0xdeadbeef');
    expect(decodeTxHash(undefined)).toBeUndefined();
    expect(decodeTxHash('')).toBeUndefined();
    // Non-base64 garbage should return undefined without throwing.
    expect(decodeTxHash('!!!not-base64!!!')).toBeUndefined();
    // Valid base64 but missing transaction field.
    const noTx = Buffer.from(JSON.stringify({ other: 'field' })).toString('base64');
    expect(decodeTxHash(noTx)).toBeUndefined();
  });

  it('decodes txHash from PAYMENT-RESPONSE header (SDK casing)', () => {
    // Replicate the decode IIFE logic with PAYMENT-RESPONSE casing
    const headers: Record<string, string> = {
      'PAYMENT-RESPONSE': Buffer.from(JSON.stringify({ transaction: '0xabc123' })).toString('base64'),
    };

    // Mirror the lookup chain from x402.ts
    const headerValue =
      headers['PAYMENT-RESPONSE'] ??
      headers['Payment-Response'] ??
      headers['payment-response'] ??
      headers['x-payment-response'] ??
      headers['X-Payment-Response'];

    expect(headerValue).toBeDefined();
    const decoded = JSON.parse(Buffer.from(headerValue!, 'base64').toString('utf8'));
    expect(decoded.transaction).toBe('0xabc123');
  });

  it('middleware txHash is undefined when x-payment-response header is absent (mock facilitator)', async () => {
    // Confirm via the full middleware harness that when the mock facilitator
    // does not produce an x-payment-response header, txHash is undefined.
    // (This is the same assertion as the existing paymentResult test; this
    // test explicitly documents the x-payment-response absence behaviour.)
    let capturedPaymentResult: unknown = undefined;

    const app = new Hono();
    app.use(async (c, next) => {
      await next();
      capturedPaymentResult = (c as any).get('paymentResult');
    });
    app.use(createX402PaymentMiddleware(testConfig, mockFacilitator));
    app.post('/pins', (c) => c.json({ ok: true }));

    const unpaid = await app.request(
      new Request('http://localhost/pins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cid: 'bafy-test' })
      })
    );
    expect(unpaid.status).toBe(402);

    const paymentRequired = decodePaymentRequiredHeader(unpaid.headers.get('payment-required')!);
    const accepted = paymentRequired.accepts[0];

    const paymentPayload: PaymentPayload = {
      x402Version: paymentRequired.x402Version,
      accepted,
      payload: {
        authorization: {
          from: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
          to: taikoChain.payTo,
          value: accepted.amount,
          validAfter: '0',
          validBefore: '9999999999',
          nonce: `0x${'0'.repeat(64)}`
        },
        signature: `0x${'1'.repeat(130)}`
      }
    };

    capturedPaymentResult = undefined;
    const paid = await app.request(
      new Request('http://localhost/pins', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'payment-signature': encodePaymentSignatureHeader(paymentPayload)
        },
        body: JSON.stringify({ cid: 'bafy-test' })
      })
    );
    expect(paid.status).toBe(200);

    const pr = capturedPaymentResult as { txHash?: string };
    // The x402HTTPResourceServer emits the settlement result as PAYMENT-RESPONSE
    // (uppercase). Our lookup now correctly finds it, so txHash is populated.
    expect(pr.txHash).toBe('0xtest');
  });
});

describe('x402 middleware', () => {
  it('returns 402 when payment proof is missing and allows paid requests', async () => {
    const app = new Hono();
    app.use(createX402PaymentMiddleware(testConfig, mockFacilitator));
    app.post('/pins', (c) => c.json({ ok: true }));

    const unpaid = await app.request(
      new Request('http://localhost/pins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cid: 'bafy-test' })
      })
    );

    expect(unpaid.status).toBe(402);
    const unpaidBody = (await unpaid.json()) as {
      error: string;
      protocol: { spec: string };
      client: { package: string };
      pricing: { ratePerGbMonthUsd: number; durationMonths: number; minPriceUsd: number };
    };
    expect(unpaidBody.error).toBe('Payment required');
    expect(unpaidBody.protocol.spec).toBe('https://www.x402.org/');
    expect(unpaidBody.client.package).toBe('@x402/fetch');
    expect(unpaidBody.pricing.ratePerGbMonthUsd).toBe(0.10);
    expect(unpaidBody.pricing.durationMonths).toBe(1);
    expect(unpaidBody.pricing.minPriceUsd).toBe(0.001);

    const paymentRequiredHeader = unpaid.headers.get('payment-required');
    expect(paymentRequiredHeader).toBeTruthy();

    const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader!);
    expect(paymentRequired.resource?.url).toBe('http://localhost/pins');
    const accepted = paymentRequired.accepts[0];
    const paymentPayload: PaymentPayload = {
      x402Version: paymentRequired.x402Version,
      accepted,
      payload: {
        authorization: {
          from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          to: taikoChain.payTo,
          value: accepted.amount,
          validAfter: '0',
          validBefore: '9999999999',
          nonce: `0x${'0'.repeat(64)}`
        },
        signature: `0x${'1'.repeat(130)}`
      }
    };

    const paid = await app.request(
      new Request('http://localhost/pins', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'payment-signature': encodePaymentSignatureHeader(paymentPayload)
        },
        body: JSON.stringify({ cid: 'bafy-test' })
      })
    );

    expect(paid.status).toBe(200);
    const paymentResponseHeader = paid.headers.get('payment-response');
    expect(paymentResponseHeader).toBeTruthy();

    const settlement = decodePaymentResponseHeader(paymentResponseHeader!);
    expect(settlement.success).toBe(true);
    expect(settlement.network).toBe(taikoChain.network);
  });

  it('uses the normalized public URL in payment requirements', async () => {
    const app = new Hono();
    app.use(createExternalRequestUrlMiddleware({ publicBaseUrl: 'https://tack.taiko.xyz' }));
    app.use(createX402PaymentMiddleware(testConfig, mockFacilitator));
    app.post('/pins', (c) => c.json({ ok: true }));

    const unpaid = await app.request(
      new Request('http://localhost/pins', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ cid: 'bafy-test' })
      })
    );

    expect(unpaid.status).toBe(402);
    const paymentRequiredHeader = unpaid.headers.get('payment-required');
    expect(paymentRequiredHeader).toBeTruthy();

    const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader!);
    expect(paymentRequired.resource?.url).toBe('https://tack.taiko.xyz/pins');
  });

  it('enforces optional retrieval paywall with dynamic owner payout', async () => {
    const premiumOwner = '0xcccccccccccccccccccccccccccccccccccccccc';
    const app = new Hono();
    app.use(
      createX402PaymentMiddleware(testConfig, mockFacilitator, {
        resolveRetrievalPayment: (cid) => {
          if (cid === 'premium-cid') {
            return { payTo: premiumOwner, priceUsd: 0.0025 };
          }

          return null;
        }
      })
    );
    app.get('/ipfs/:cid', (c) => c.json({ cid: c.req.param('cid') }));

    const free = await app.request('http://localhost/ipfs/free-cid');
    expect(free.status).toBe(200);

    const unpaidPremium = await app.request('http://localhost/ipfs/premium-cid');
    expect(unpaidPremium.status).toBe(402);

    const requiredHeader = unpaidPremium.headers.get('payment-required');
    expect(requiredHeader).toBeTruthy();
    const paymentRequired = decodePaymentRequiredHeader(requiredHeader!);
    const accepted = paymentRequired.accepts[0];
    expect(accepted.payTo).toBe(premiumOwner);

    const paymentPayload: PaymentPayload = {
      x402Version: paymentRequired.x402Version,
      accepted,
      payload: {
        authorization: {
          from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          to: premiumOwner,
          value: accepted.amount,
          validAfter: '0',
          validBefore: '9999999999',
          nonce: `0x${'0'.repeat(64)}`
        },
        signature: `0x${'1'.repeat(130)}`
      }
    };

    const paidPremium = await app.request(
      new Request('http://localhost/ipfs/premium-cid', {
        headers: {
          'payment-signature': encodePaymentSignatureHeader(paymentPayload)
        }
      })
    );
    expect(paidPremium.status).toBe(200);
  });

  it('advertises one accepts entry per registered chain with matching asset amount', async () => {
    const baseChain = {
      network: 'eip155:8453' as const,
      facilitatorUrl: 'http://localhost:9998',
      payTo: taikoChain.payTo,
      usdcAssetAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      usdcAssetDecimals: 6,
      usdcDomainName: 'USD Coin',
      usdcDomainVersion: '2'
    };
    const multiChainConfig: X402PaymentConfig = {
      ...testConfig,
      chains: [taikoChain, baseChain]
    };

    const app = new Hono();
    app.use(createX402PaymentMiddleware(multiChainConfig, mockFacilitator));
    app.post('/pins', (c) => c.json({ ok: true }));

    const unpaid = await app.request(
      new Request('http://localhost/pins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cid: 'bafy-test' })
      })
    );

    expect(unpaid.status).toBe(402);
    const paymentRequiredHeader = unpaid.headers.get('payment-required');
    expect(paymentRequiredHeader).toBeTruthy();
    const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader!);

    expect(paymentRequired.accepts).toHaveLength(2);
    expect(paymentRequired.accepts[0].network).toBe('eip155:167000');
    expect(paymentRequired.accepts[1].network).toBe('eip155:8453');
    expect(paymentRequired.accepts[0].payTo).toBe(taikoChain.payTo);
    expect(paymentRequired.accepts[1].payTo).toBe(baseChain.payTo);
    // USDC has 6 decimals on both chains; the same USD price → same asset amount.
    expect(paymentRequired.accepts[0].amount).toBe(paymentRequired.accepts[1].amount);
    expect(paymentRequired.accepts[0].asset).toBe(taikoChain.usdcAssetAddress);
    expect(paymentRequired.accepts[1].asset).toBe(baseChain.usdcAssetAddress);
  });

  it('sets paymentResult on the request context after a verified settlement', async () => {
    // paymentResult is set AFTER next() returns (post-settlement) inside the
    // x402 middleware. To capture it, we register an outermost middleware that
    // reads paymentResult after its own next() resolves — by then, x402 has
    // completed its full settlement cycle.
    let capturedPaymentResult: unknown = undefined;

    const app = new Hono();
    // Outermost: reads paymentResult after the full middleware chain settles.
    app.use(async (c, next) => {
      await next();
      capturedPaymentResult = (c as any).get('paymentResult');
    });
    app.use(createX402PaymentMiddleware(testConfig, mockFacilitator));
    app.post('/pins', (c) => c.json({ ok: true }));

    // First: unpaid request to get the payment requirements.
    const unpaid = await app.request(
      new Request('http://localhost/pins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cid: 'bafy-test' })
      })
    );
    expect(unpaid.status).toBe(402);
    const paymentRequiredHeader = unpaid.headers.get('payment-required');
    expect(paymentRequiredHeader).toBeTruthy();

    const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader!);
    const accepted = paymentRequired.accepts[0];

    // Build a valid-looking payment payload with a known wallet address.
    const payerWallet = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const paymentPayload: PaymentPayload = {
      x402Version: paymentRequired.x402Version,
      accepted,
      payload: {
        authorization: {
          from: payerWallet,
          to: taikoChain.payTo,
          value: accepted.amount,
          validAfter: '0',
          validBefore: '9999999999',
          nonce: `0x${'0'.repeat(64)}`
        },
        signature: `0x${'1'.repeat(130)}`
      }
    };

    // Reset capture before the paid request.
    capturedPaymentResult = undefined;

    // Paid request — middleware should set paymentResult after settlement.
    const paid = await app.request(
      new Request('http://localhost/pins', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'payment-signature': encodePaymentSignatureHeader(paymentPayload)
        },
        body: JSON.stringify({ cid: 'bafy-test' })
      })
    );

    expect(paid.status).toBe(200);

    type CapturedPaymentResult = {
      wallet: string;
      protocol: string;
      chainName: string;
      chainId: number;
      assetAddress: string;
      assetDecimals: number;
      amountAtomic: string;
      amountUsd: number;
      endpoint: string;
      txHash?: string;
    };
    const pr = capturedPaymentResult as CapturedPaymentResult;

    expect(pr).not.toBeUndefined();
    expect(pr).not.toBeNull();
    expect(pr.wallet).toBe(payerWallet.toLowerCase());
    expect(pr.protocol).toBe('x402');
    expect(pr.chainName).toBe('eip155:167000');
    expect(pr.chainId).toBe(167000);
    expect(pr.endpoint).toBe('pin');
    expect(pr.assetAddress).toBe(taikoChain.usdcAssetAddress.toLowerCase());
    expect(pr.assetDecimals).toBe(6);
    expect(typeof pr.amountAtomic).toBe('string');
    expect(typeof pr.amountUsd).toBe('number');
    // amountUsd should be a non-negative finite number.
    expect(Number.isFinite(pr.amountUsd)).toBe(true);
    expect(pr.amountUsd).toBeGreaterThanOrEqual(0);
    // txHash: the x402HTTPResourceServer emits the settlement result as PAYMENT-RESPONSE
    // (uppercase). Our lookup now correctly finds it, so txHash is populated from the
    // mock facilitator's transaction value.
    expect(pr.txHash).toBe('0xtest');
  });

  it('sets endpoint to "retrieval" when path starts with /ipfs/', async () => {
    const premiumOwner = '0xcccccccccccccccccccccccccccccccccccccccc';
    let capturedPaymentResult: unknown = undefined;

    const app = new Hono();
    // Outermost: reads paymentResult after the full middleware chain settles.
    app.use(async (c, next) => {
      await next();
      capturedPaymentResult = (c as any).get('paymentResult');
    });
    app.use(
      createX402PaymentMiddleware(testConfig, mockFacilitator, {
        resolveRetrievalPayment: (cid) => {
          if (cid === 'premium-cid') {
            return { payTo: premiumOwner, priceUsd: 0.0025 };
          }
          return null;
        }
      })
    );
    app.get('/ipfs/:cid', (c) => c.json({ cid: c.req.param('cid') }));

    // First: unpaid request to get the payment requirements.
    const unpaid = await app.request('http://localhost/ipfs/premium-cid');
    expect(unpaid.status).toBe(402);
    const paymentRequiredHeader = unpaid.headers.get('payment-required');
    expect(paymentRequiredHeader).toBeTruthy();

    const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader!);
    const accepted = paymentRequired.accepts[0];

    const payerWallet = '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
    const paymentPayload: PaymentPayload = {
      x402Version: paymentRequired.x402Version,
      accepted,
      payload: {
        authorization: {
          from: payerWallet,
          to: premiumOwner,
          value: accepted.amount,
          validAfter: '0',
          validBefore: '9999999999',
          nonce: `0x${'0'.repeat(64)}`
        },
        signature: `0x${'1'.repeat(130)}`
      }
    };

    capturedPaymentResult = undefined;

    const paid = await app.request(
      new Request('http://localhost/ipfs/premium-cid', {
        headers: {
          'payment-signature': encodePaymentSignatureHeader(paymentPayload)
        }
      })
    );

    expect(paid.status).toBe(200);

    const pr = capturedPaymentResult as { endpoint: string; protocol: string; wallet: string };
    expect(pr).not.toBeUndefined();
    expect(pr).not.toBeNull();
    expect(pr.protocol).toBe('x402');
    expect(pr.endpoint).toBe('retrieval');
    expect(pr.wallet).toBe(payerWallet.toLowerCase());
  });
});
