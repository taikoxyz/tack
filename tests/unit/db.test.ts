import Database from 'better-sqlite3';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createDb } from '../../src/db';

describe('createDb', () => {
  it('creates payments table with required columns', () => {
    const db = createDb(':memory:');
    const cols = db.pragma('table_info(payments)') as Array<{ name: string }>;
    const names = cols.map((c) => c.name).sort();
    expect(names).toEqual([
      'amount_atomic',
      'amount_usd',
      'asset_address',
      'asset_decimals',
      'chain_id',
      'endpoint',
      'id',
      'occurred_at',
      'payer_wallet',
      'pin_request_id',
      'protocol',
      'request_id',
      'tx_hash',
    ]);
  });

  it('creates request_metrics_daily with composite primary key', () => {
    const db = createDb(':memory:');
    const cols = db.pragma('table_info(request_metrics_daily)') as Array<{ name: string; pk: number }>;
    const pkCols = cols.filter((c) => c.pk > 0).map((c) => c.name).sort();
    expect(pkCols).toEqual(['bucket', 'day']);
  });

  it('adds size_bytes column to pins', () => {
    const db = createDb(':memory:');
    const cols = db.pragma('table_info(pins)') as Array<{ name: string }>;
    expect(cols.some((c) => c.name === 'size_bytes')).toBe(true);
  });

  it('migrations are idempotent and preserve existing data on re-run', async () => {
    const tmpPath = `${tmpdir()}/tack-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
    try {
      const first = createDb(tmpPath);
      first.prepare(`INSERT INTO pins (
        requestid, cid, name, status, origins, meta, delegates, info, owner, created, updated
      ) VALUES (?, ?, ?, 'pinned', '[]', '{}', '[]', '{}', ?, ?, ?)`).run(
        'r1', 'bafy1', null, '0xowner', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
      );
      first.prepare(`INSERT INTO payments (
        id, occurred_at, protocol, chain_id, payer_wallet, asset_address, asset_decimals,
        amount_atomic, amount_usd, endpoint
      ) VALUES (?, ?, 'mpp', 4217, ?, ?, 6, '1000000', 1.0, 'pin')`).run(
        'pay_1', '2026-01-01T00:00:00.000Z', '0xpayer', '0xusdc'
      );
      first.close();

      // Re-run migrations on the same file
      const second = createDb(tmpPath);
      const pinCount = (second.prepare('SELECT COUNT(*) as n FROM pins').get() as { n: number }).n;
      const payCount = (second.prepare('SELECT COUNT(*) as n FROM payments').get() as { n: number }).n;
      expect(pinCount).toBe(1);
      expect(payCount).toBe(1);
      second.close();
    } finally {
      rmSync(tmpPath, { force: true });
    }
  });

  it('rejects invalid protocol values via CHECK constraint', () => {
    const db = createDb(':memory:');
    expect(() => {
      db.prepare(`INSERT INTO payments (
        id, occurred_at, protocol, chain_id, payer_wallet, asset_address, asset_decimals,
        amount_atomic, amount_usd, endpoint
      ) VALUES (?, ?, ?, 1, ?, ?, 6, '1', 1.0, 'pin')`).run(
        'p1', '2026-04-21T00:00:00.000Z', 'bogus', '0xa', '0xb'
      );
    }).toThrow();
  });

  it('rejects invalid endpoint values via CHECK constraint', () => {
    const db = createDb(':memory:');
    expect(() => {
      db.prepare(`INSERT INTO payments (
        id, occurred_at, protocol, chain_id, payer_wallet, asset_address, asset_decimals,
        amount_atomic, amount_usd, endpoint
      ) VALUES (?, ?, 'mpp', 1, ?, ?, 6, '1', 1.0, ?)`).run(
        'p1', '2026-04-21T00:00:00.000Z', '0xa', '0xb', 'bogus'
      );
    }).toThrow();
  });

  it('uniq_payments_protocol_txhash partial-unique index dedups when tx_hash present', () => {
    const db = createDb(':memory:');
    const insert = db.prepare(`INSERT INTO payments (
      id, occurred_at, protocol, chain_id, payer_wallet, asset_address, asset_decimals,
      amount_atomic, amount_usd, endpoint, tx_hash
    ) VALUES (?, ?, 'mpp', 4217, ?, ?, 6, '1', 1.0, 'pin', ?)`);

    insert.run('p1', '2026-04-21T00:00:00.000Z', '0xa', '0xb', '0xtx1');

    expect(() => insert.run('p2', '2026-04-21T00:00:00.000Z', '0xa', '0xb', '0xtx1')).toThrow();
  });

  it('uniq_payments_protocol_txhash allows multiple rows with NULL tx_hash', () => {
    const db = createDb(':memory:');
    const insert = db.prepare(`INSERT INTO payments (
      id, occurred_at, protocol, chain_id, payer_wallet, asset_address, asset_decimals,
      amount_atomic, amount_usd, endpoint, tx_hash
    ) VALUES (?, ?, 'x402', 167000, ?, ?, 6, '1', 1.0, 'pin', NULL)`);

    insert.run('p1', '2026-04-21T00:00:00.000Z', '0xa', '0xb');
    expect(() => insert.run('p2', '2026-04-21T00:00:00.000Z', '0xa', '0xb')).not.toThrow();
  });
});
