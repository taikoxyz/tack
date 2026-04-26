import type { Context, Next, MiddlewareHandler } from 'hono';
import { extractPaymentAuthorizationCredential } from './http.js';
import type { PaymentResult } from './types.js';

export interface MppChainContext {
  chainId: number;
  assetAddress: string;
  assetDecimals: number;
  /** Convert atomic amount string to USD. */
  atomicToUsd: (amountAtomic: string) => number;
  /** Decide endpoint from request path. */
  endpointFor: (path: string) => 'pin' | 'retrieval';
}

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

/**
 * Resolves the verified payer wallet address AFTER mppx has settled
 * a charge. The resolver MUST derive the address from on-chain
 * evidence (e.g. the Tempo Transfer event), never from client-supplied
 * credential metadata such as `source`.
 */
export type ResolveVerifiedPayer = (
  request: Request,
  withReceipt: (response: Response) => Response
) => Promise<string>;

interface MppPaymentMiddlewareConfig {
  mppx: MppxChargeHandler;
  requirementFn: (c: Context) => MppPaymentRequirement | null | Promise<MppPaymentRequirement | null>;
  resolveVerifiedPayer: ResolveVerifiedPayer;
  chainContext: MppChainContext;
  /** Optional logger hook for payer-resolution failures. */
  onPayerResolutionFailure?: (error: unknown, request: Request) => void;
}

const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';

function payerResolutionFailedResponse(): Response {
  const body = {
    type: 'https://mpp.dev/errors/payer-resolution-failed',
    title: 'Payer resolution failed',
    status: 500,
    detail:
      'Payment settled on-chain, but the server could not verify the payer address ' +
      'from the on-chain Transfer event. Contact the service operator if the charge ' +
      'was deducted.',
  };
  return new Response(JSON.stringify(body), {
    status: 500,
    headers: { 'Content-Type': PROBLEM_JSON_CONTENT_TYPE },
  });
}

export function createMppPaymentMiddleware(config: MppPaymentMiddlewareConfig): MiddlewareHandler {
  const { mppx, requirementFn, resolveVerifiedPayer, chainContext, onPayerResolutionFailure } = config;

  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const credential = extractPaymentAuthorizationCredential(authHeader);

    // Not an MPP request — let x402 global middleware handle it.
    if (credential === null) {
      return next();
    }

    const requirement = await requirementFn(c);

    // Route does not charge (free content or non-chargeable method) — skip.
    if (requirement === null) {
      return next();
    }

    // Verify + settle via mppx on the real request. mppx validates the
    // credential, broadcasts / confirms the Tempo transaction, and returns
    // either a challenge (402) or a receipt-decorating success (200).
    const result = await mppx.charge(requirement)(c.req.raw);

    if (result.status === 402) {
      return result.challenge;
    }

    // mppx has confirmed a successful on-chain charge. The payer address
    // MUST come from verified on-chain data, not from the optional
    // `credential.source` metadata (which is client-controlled and not
    // bound to the signed payment payload).
    let wallet: string;
    try {
      wallet = await resolveVerifiedPayer(c.req.raw, result.withReceipt);
    } catch (error) {
      onPayerResolutionFailure?.(error, c.req.raw);
      return payerResolutionFailedResponse();
    }

    // requirement.amount is a decimal USD string (e.g. "0.001"). Convert
    // to atomic units using the configured asset decimals so the column
    // holds atomic-integer strings consistently across protocols.
    const usdAmount = Number(requirement.amount);
    const atomicAmount = Number.isFinite(usdAmount)
      ? String(Math.round(usdAmount * 10 ** chainContext.assetDecimals))
      : '0';

    c.set('paymentResult' as any, {
      wallet,
      protocol: 'mpp',
      chainName: 'tempo',
      chainId: chainContext.chainId,
      assetAddress: chainContext.assetAddress,
      assetDecimals: chainContext.assetDecimals,
      amountAtomic: atomicAmount,
      amountUsd: Number.isFinite(usdAmount) ? usdAmount : 0,
      endpoint: chainContext.endpointFor(c.req.path),
    } satisfies PaymentResult);

    await next();
    c.res = result.withReceipt(c.res);
  };
}
