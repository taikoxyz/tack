import Database from 'better-sqlite3';
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

  it('is idempotent (re-running migrations does not error)', () => {
    const path = ':memory:';
    const db = createDb(path);
    expect(() => createDb(path)).not.toThrow();
    db.close();
  });
});
