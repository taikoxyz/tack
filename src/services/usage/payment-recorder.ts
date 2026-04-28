import { ulid } from 'ulid';
import type { Logger } from 'pino';
import type { PaymentRepository } from '../../repositories/payment-repository';
import type { PaymentResult } from '../payment/types';

export interface PaymentRecorderContext {
  requestId?: string;
  pinRequestId?: string;
}

/** Returns an ISO 8601 UTC timestamp. Injectable for tests. */
export type Clock = () => string;

export class PaymentRecorder {
  constructor(
    private readonly repo: PaymentRepository,
    private readonly logger: Pick<Logger, 'error' | 'warn'>,
    private readonly clock: Clock = () => new Date().toISOString()
  ) {}

  record(result: PaymentResult, ctx: PaymentRecorderContext): void {
    const required = {
      chainId: result.chainId,
      amountAtomic: result.amountAtomic,
      amountUsd: result.amountUsd,
      assetAddress: result.assetAddress,
      assetDecimals: result.assetDecimals,
      endpoint: result.endpoint,
    };

    if (Object.values(required).some((v) => v === undefined)) {
      this.logger.warn(
        { requestId: ctx.requestId, paymentResult: result },
        'payment recorder skipped: missing required usage fields'
      );
      return;
    }

    try {
      this.repo.insert({
        id: ulid(),
        occurred_at: this.clock(),
        protocol: result.protocol,
        chain_id: required.chainId!,
        payer_wallet: result.wallet.toLowerCase(),
        asset_address: required.assetAddress!.toLowerCase(),
        asset_decimals: required.assetDecimals!,
        amount_atomic: required.amountAtomic!,
        amount_usd: required.amountUsd!,
        endpoint: required.endpoint!,
        request_id: ctx.requestId ?? null,
        tx_hash: result.txHash ?? null,
        pin_request_id: ctx.pinRequestId ?? null,
      });
    } catch (err) {
      this.logger.error(
        { err, requestId: ctx.requestId, paymentResult: result },
        'payment recorder insert failed; chain receipt is the source of truth'
      );
    }
  }
}
