import type { Context, Next, MiddlewareHandler } from 'hono';
import { extractPaymentAuthorizationCredential } from './http.js';
import type { PaymentResult } from './types.js';

export interface MppPaymentRequirement {
  amount: string;
  recipient?: string;
}

export interface MppChargeChallengeResult {
  status: 402;
  challenge: Response;
}

export interface MppChargeSuccessResult {
  status: 200;
  withReceipt: (response: Response) => Response;
}

export type MppChargeResult = MppChargeChallengeResult | MppChargeSuccessResult;

export interface MppxChargeHandler {
  charge: (options: MppPaymentRequirement) => (req: Request) => Promise<MppChargeResult>;
}

interface MppPaymentMiddlewareConfig {
  mppx: MppxChargeHandler;
  requirementFn: (c: Context) => MppPaymentRequirement | null | Promise<MppPaymentRequirement | null>;
  extractWallet: (credential: string) => string;
}

export function createMppPaymentMiddleware(config: MppPaymentMiddlewareConfig): MiddlewareHandler {
  const { mppx, requirementFn, extractWallet } = config;

  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const credential = extractPaymentAuthorizationCredential(authHeader);

    // Not an MPP request — let x402 global middleware handle it
    if (credential === null) {
      return next();
    }

    const requirement = await requirementFn(c);

    // Free content — no payment required
    if (requirement === null) {
      return next();
    }

    const { amount, recipient } = requirement;

    let wallet: string;
    try {
      wallet = extractWallet(credential);
    } catch {
      const challengeReq = new Request(c.req.url, {
        method: c.req.method,
        headers: {},
      });
      const challengeResult = await mppx.charge({ amount, recipient })(challengeReq);
      if (challengeResult.status === 402) {
        return challengeResult.challenge;
      }
      return c.body(null, 402);
    }

    // MPP credential present — verify and settle via mppx
    const result = await mppx.charge({ amount, recipient })(c.req.raw);

    if (result.status === 402) {
      // Credential was present but invalid — return MPP-specific 402
      return result.challenge;
    }

    c.set('paymentResult' as any, {
      wallet,
      protocol: 'mpp',
      chainName: 'tempo',
    } satisfies PaymentResult);

    await next();
    c.res = result.withReceipt(c.res);
  };
}
