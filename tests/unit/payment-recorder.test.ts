import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb } from '../../src/db';
import { PaymentRepository } from '../../src/repositories/payment-repository';
import { PaymentRecorder } from '../../src/services/reporting/payment-recorder';
import type { PaymentResult } from '../../src/services/payment/types';

const fullResult: PaymentResult = {
  wallet: '0xAAA',
  protocol: 'mpp',
  chainName: 'tempo',
  chainId: 4217,
  amountAtomic: '1000000',
  amountUsd: 1.0,
  assetAddress: '0xToken',
  assetDecimals: 6,
  endpoint: 'pin',
  txHash: '0xtx',
};

describe('PaymentRecorder', () => {
  let db: Database.Database;
  let repo: PaymentRepository;
  let recorder: PaymentRecorder;
  let logger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    db = createDb(':memory:');
    repo = new PaymentRepository(db);
    logger = { error: vi.fn(), warn: vi.fn() };
    recorder = new PaymentRecorder(repo, logger as any, () => '2026-04-21T12:00:00.000Z');
  });

  it('records a complete payment result and lowercases addresses', () => {
    recorder.record(fullResult, { requestId: 'req_1', pinRequestId: 'pin_1' });

    const rows = db.prepare('SELECT * FROM payments').all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurred_at: '2026-04-21T12:00:00.000Z',
      protocol: 'mpp',
      chain_id: 4217,
      payer_wallet: '0xaaa',         // lowercased
      asset_address: '0xtoken',      // lowercased
      amount_atomic: '1000000',
      amount_usd: 1.0,
      endpoint: 'pin',
      tx_hash: '0xtx',
      pin_request_id: 'pin_1',
      request_id: 'req_1',
    });
  });

  it('skips and warns when chainId is missing', () => {
    recorder.record({ ...fullResult, chainId: undefined }, { requestId: 'req_2' });
    const count = (db.prepare('SELECT COUNT(*) AS n FROM payments').get() as { n: number }).n;
    expect(count).toBe(0);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('skips and warns when amountUsd is missing', () => {
    recorder.record({ ...fullResult, amountUsd: undefined }, { requestId: 'req_3' });
    const count = (db.prepare('SELECT COUNT(*) AS n FROM payments').get() as { n: number }).n;
    expect(count).toBe(0);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('skips and warns when endpoint is missing', () => {
    recorder.record({ ...fullResult, endpoint: undefined }, { requestId: 'req_4' });
    const count = (db.prepare('SELECT COUNT(*) AS n FROM payments').get() as { n: number }).n;
    expect(count).toBe(0);
  });

  it('records null for tx_hash and pin_request_id when not provided', () => {
    const noTx: PaymentResult = { ...fullResult, txHash: undefined };
    recorder.record(noTx, { requestId: 'req_5' });

    const row = db.prepare('SELECT tx_hash, pin_request_id FROM payments').get() as any;
    expect(row.tx_hash).toBeNull();
    expect(row.pin_request_id).toBeNull();
  });

  it('logs error and swallows DB exceptions (does not throw)', () => {
    const failingRepo = { insert: vi.fn().mockImplementation(() => { throw new Error('disk full'); }) } as any;
    const r = new PaymentRecorder(failingRepo, logger as any, () => '2026-04-21T12:00:00.000Z');
    expect(() => r.record(fullResult, { requestId: 'req_6' })).not.toThrow();
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('uses the injected clock for occurred_at', () => {
    const clock = vi.fn().mockReturnValue('2030-01-01T00:00:00.000Z');
    const r = new PaymentRecorder(repo, logger as any, clock);
    r.record(fullResult, { requestId: 'req_7' });
    const row = db.prepare('SELECT occurred_at FROM payments').get() as any;
    expect(row.occurred_at).toBe('2030-01-01T00:00:00.000Z');
    expect(clock).toHaveBeenCalledOnce();
  });

  it('treats duplicate signal as success (does not log error)', () => {
    // First record succeeds; second with same tx_hash should be silently deduped by the repo
    recorder.record(fullResult, { requestId: 'req_a' });
    recorder.record({ ...fullResult }, { requestId: 'req_b' });

    const count = (db.prepare('SELECT COUNT(*) AS n FROM payments').get() as { n: number }).n;
    expect(count).toBe(1);
    // The second record returned 'duplicate' from the repo — that's not an error
    expect(logger.error).not.toHaveBeenCalled();
  });
});
