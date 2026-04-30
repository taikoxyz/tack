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
    expect(summary.byEndpoint.pin).toEqual({ totalUsd: 4, count: 2 });
    expect(summary.byEndpoint.retrieval).toEqual({ totalUsd: 0, count: 0 });
    expect(summary.byEndpoint.private_object).toEqual({ totalUsd: 0, count: 0 });
    expect(summary.byEndpoint.private_object_renewal).toEqual({ totalUsd: 0, count: 0 });
    expect(summary.uniquePayers).toBe(2);
  });

  it('summarizes private storage endpoint buckets', () => {
    repo.insert(baseRecord({
      id: 'private-create',
      amount_usd: 1.25,
      endpoint: 'private_object',
      occurred_at: '2026-04-21T10:00:00.000Z',
    }));
    repo.insert(baseRecord({
      id: 'private-renew',
      amount_usd: 0.75,
      endpoint: 'private_object_renewal',
      occurred_at: '2026-04-21T11:00:00.000Z',
    }));

    const summary = repo.summarizeWindow({
      start: '2026-04-21T00:00:00.000Z',
      end: '2026-04-22T00:00:00.000Z',
    });

    expect(summary.byEndpoint.private_object).toEqual({ totalUsd: 1.25, count: 1 });
    expect(summary.byEndpoint.private_object_renewal).toEqual({ totalUsd: 0.75, count: 1 });
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

  it('returns "inserted" on first insert and "duplicate" on retry with same tx_hash', () => {
    expect(repo.insert(baseRecord({ id: 'p1', protocol: 'mpp', tx_hash: '0xabc' }))).toBe('inserted');
    expect(repo.insert(baseRecord({ id: 'p2', protocol: 'mpp', tx_hash: '0xabc' }))).toBe('duplicate');
  });

  it('returns null for findById on a missing id', () => {
    expect(repo.findById('does-not-exist')).toBeNull();
  });

  it('summarizes an empty window as all zeros', () => {
    const summary = repo.summarizeWindow({
      start: '2026-04-01T00:00:00.000Z',
      end: '2026-04-02T00:00:00.000Z',
    });
    expect(summary).toEqual({
      totalUsd: 0,
      count: 0,
      uniquePayers: 0,
      byProtocol: {
        x402: { totalUsd: 0, count: 0 },
        mpp: { totalUsd: 0, count: 0 },
      },
      byEndpoint: {
        pin: { totalUsd: 0, count: 0 },
        retrieval: { totalUsd: 0, count: 0 },
        private_object: { totalUsd: 0, count: 0 },
        private_object_renewal: { totalUsd: 0, count: 0 },
      },
    });
  });

  it('window boundaries are half-open: start inclusive, end exclusive', () => {
    repo.insert(baseRecord({ id: 'p_at_start', occurred_at: '2026-04-21T00:00:00.000Z', amount_usd: 1.0 }));
    repo.insert(baseRecord({ id: 'p_at_end', occurred_at: '2026-04-22T00:00:00.000Z', amount_usd: 100.0 }));
    const summary = repo.summarizeWindow({
      start: '2026-04-21T00:00:00.000Z',
      end: '2026-04-22T00:00:00.000Z',
    });
    expect(summary.totalUsd).toBe(1.0);
    expect(summary.count).toBe(1);
  });

  it('firstTimePayers returns wallets in chronological order of their first payment', () => {
    repo.insert(baseRecord({ id: 'p1', payer_wallet: '0xbbb', occurred_at: '2026-04-21T12:00:00.000Z' }));
    repo.insert(baseRecord({ id: 'p2', payer_wallet: '0xaaa', occurred_at: '2026-04-21T08:00:00.000Z' }));
    repo.insert(baseRecord({ id: 'p3', payer_wallet: '0xccc', occurred_at: '2026-04-21T20:00:00.000Z' }));

    const firstTime = repo.firstTimePayers({
      start: '2026-04-21T00:00:00.000Z',
      end: '2026-04-22T00:00:00.000Z',
    });

    expect(firstTime).toEqual(['0xaaa', '0xbbb', '0xccc']);
  });
});
