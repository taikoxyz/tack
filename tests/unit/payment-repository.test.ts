import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db';
import { PaymentRepository, type PaymentRecord } from '../../src/repositories/payment-repository';

const baseRecord = (overrides: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: 'pay_01',
  occurred_at: '2026-04-21T12:00:00.000Z',
  protocol: 'x402',
  chain_id: 167000,
  payer_wallet: '0x1111111111111111111111111111111111111111',
  asset_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  asset_decimals: 6,
  amount_atomic: '1000000',
  amount_usd: 1.0,
  endpoint: 'pin',
  request_id: 'req_1',
  tx_hash: null,
  pin_request_id: 'pin_1',
  ...overrides,
});

describe('PaymentRepository', () => {
  let db: Database.Database;
  let repo: PaymentRepository;

  beforeEach(() => {
    db = createDb(':memory:');
    repo = new PaymentRepository(db);
  });

  it('inserts and reads a payment', () => {
    repo.insert(baseRecord());
    const found = repo.findById('pay_01');
    expect(found).toEqual(baseRecord());
  });

  it('dedups on (protocol, tx_hash) when tx_hash present', () => {
    repo.insert(baseRecord({ id: 'pay_a', protocol: 'mpp', tx_hash: '0xabc' }));
    repo.insert(baseRecord({ id: 'pay_b', protocol: 'mpp', tx_hash: '0xabc' }));
    const all = db.prepare('SELECT id FROM payments').all() as Array<{ id: string }>;
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('pay_a');
  });

  it('does not dedup when tx_hash is null', () => {
    repo.insert(baseRecord({ id: 'pay_a', tx_hash: null }));
    repo.insert(baseRecord({ id: 'pay_b', tx_hash: null }));
    const all = db.prepare('SELECT id FROM payments').all();
    expect(all).toHaveLength(2);
  });

  it('summarizes a window with totals and protocol split', () => {
    repo.insert(baseRecord({ id: 'p1', protocol: 'x402', amount_usd: 1.5, occurred_at: '2026-04-20T10:00:00.000Z', payer_wallet: '0xaaa' }));
    repo.insert(baseRecord({ id: 'p2', protocol: 'mpp', amount_usd: 2.5, occurred_at: '2026-04-21T10:00:00.000Z', payer_wallet: '0xbbb' }));
    repo.insert(baseRecord({ id: 'p3', protocol: 'x402', amount_usd: 100, occurred_at: '2026-04-30T10:00:00.000Z', payer_wallet: '0xccc' }));

    const summary = repo.summarizeWindow({
      start: '2026-04-20T00:00:00.000Z',
      end: '2026-04-22T00:00:00.000Z',
    });

    expect(summary.totalUsd).toBe(4.0);
    expect(summary.byProtocol.x402.totalUsd).toBe(1.5);
    expect(summary.byProtocol.x402.count).toBe(1);
    expect(summary.byProtocol.mpp.totalUsd).toBe(2.5);
    expect(summary.byProtocol.mpp.count).toBe(1);
    expect(summary.uniquePayers).toBe(2);
  });

  it('detects first-time payers in the window', () => {
    repo.insert(baseRecord({ id: 'p1', payer_wallet: '0xaaa', occurred_at: '2026-04-01T00:00:00.000Z' }));
    repo.insert(baseRecord({ id: 'p2', payer_wallet: '0xaaa', occurred_at: '2026-04-21T00:00:00.000Z' }));
    repo.insert(baseRecord({ id: 'p3', payer_wallet: '0xbbb', occurred_at: '2026-04-21T12:00:00.000Z' }));

    const firstTime = repo.firstTimePayers({
      start: '2026-04-20T00:00:00.000Z',
      end: '2026-04-22T00:00:00.000Z',
    });

    expect(firstTime).toEqual(['0xbbb']);
  });

  it('counts cumulative unique payers', () => {
    repo.insert(baseRecord({ id: 'p1', payer_wallet: '0xaaa' }));
    repo.insert(baseRecord({ id: 'p2', payer_wallet: '0xaaa' }));
    repo.insert(baseRecord({ id: 'p3', payer_wallet: '0xbbb' }));
    expect(repo.cumulativeUniquePayers()).toBe(2);
  });
});
