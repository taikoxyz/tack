import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db';
import { PaymentRepository } from '../../src/repositories/payment-repository';
import { MetricsRepository } from '../../src/repositories/metrics-repository';
import { PinRepository } from '../../src/repositories/pin-repository';
import { DigestBuilder } from '../../src/services/reporting/digest-builder';

const seedPayment = (db: Database.Database, overrides: Partial<{
  id: string; occurred_at: string; protocol: 'x402' | 'mpp'; amount_usd: number;
  payer_wallet: string; tx_hash: string | null; endpoint: 'pin' | 'retrieval';
}>) => {
  db.prepare(`INSERT INTO payments (
    id, occurred_at, protocol, chain_id, payer_wallet, asset_address,
    asset_decimals, amount_atomic, amount_usd, endpoint, request_id,
    tx_hash, pin_request_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    overrides.id ?? 'p1',
    overrides.occurred_at ?? '2026-04-21T12:00:00.000Z',
    overrides.protocol ?? 'x402',
    167000,
    overrides.payer_wallet ?? '0xaaa',
    '0xusdc',
    6,
    '1000000',
    overrides.amount_usd ?? 1.0,
    overrides.endpoint ?? 'pin',
    'req',
    overrides.tx_hash ?? null,
    null
  );
};

const seedPin = (repo: PinRepository, overrides: Partial<{
  requestid: string; cid: string; status: 'pinned' | 'failed' | 'queued' | 'pinning';
  created: string; size_bytes: number | null; expires_at: string | null;
}>) => {
  repo.create({
    requestid: overrides.requestid ?? 'r',
    cid: overrides.cid ?? 'b',
    name: null,
    status: overrides.status ?? 'pinned',
    origins: [],
    meta: {},
    delegates: [],
    info: {},
    owner: '0xaaa',
    created: overrides.created ?? '2026-04-21T00:00:00.000Z',
    updated: '2026-04-21T00:00:00.000Z',
    expires_at: overrides.expires_at ?? null,
    size_bytes: overrides.size_bytes ?? null,
  });
};

describe('DigestBuilder', () => {
  let db: Database.Database;
  let payments: PaymentRepository;
  let metrics: MetricsRepository;
  let pins: PinRepository;
  let builder: DigestBuilder;

  beforeEach(() => {
    db = createDb(':memory:');
    payments = new PaymentRepository(db);
    metrics = new MetricsRepository(db);
    pins = new PinRepository(db);
    builder = new DigestBuilder({ payments, metrics, pins });
  });

  it('builds a Report with all sections populated', () => {
    seedPayment(db, { id: 'p1', protocol: 'x402', amount_usd: 1.5, payer_wallet: '0xaaa' });
    seedPayment(db, { id: 'p2', protocol: 'mpp', amount_usd: 2.5, payer_wallet: '0xbbb', tx_hash: '0xtx', occurred_at: '2026-04-21T18:00:00.000Z' });
    metrics.increment('2026-04-21', 'total');
    metrics.increment('2026-04-21', 'total');
    metrics.increment('2026-04-21', 'paid');
    metrics.increment('2026-04-21', 'rejected_402');
    seedPin(pins, { requestid: 'r1', cid: 'b1', size_bytes: 1024 });

    const report = builder.build({
      window: { start: '2026-04-21T00:00:00.000Z', end: '2026-04-22T00:00:00.000Z' },
      now: '2026-04-22T00:00:00.000Z',
      generatedAt: '2026-04-22T00:00:00.000Z',
    });

    expect(report.window).toEqual({ start: '2026-04-21T00:00:00.000Z', end: '2026-04-22T00:00:00.000Z' });
    expect(report.generatedAt).toBe('2026-04-22T00:00:00.000Z');
    expect(report.revenue.totalUsd).toBe(4.0);
    expect(report.revenue.byProtocol.x402).toEqual({ totalUsd: 1.5, count: 1 });
    expect(report.revenue.byProtocol.mpp).toEqual({ totalUsd: 2.5, count: 1 });
    expect(report.pins.newInWindow).toEqual({ count: 1, totalBytes: 1024 });
    expect(report.pins.active.count).toBeGreaterThanOrEqual(1);
    expect(report.requests).toEqual({ total: 2, paid: 1, rejected_402: 1 });
    expect(report.wallets.payersInWindow).toBe(2);
    expect(report.wallets.cumulativePayers).toBe(2);
    expect(report.wallets.firstTimePayersInWindow).toEqual(['0xaaa', '0xbbb']);
  });

  it('returns zeros for an empty week', () => {
    const report = builder.build({
      window: { start: '2026-04-21T00:00:00.000Z', end: '2026-04-22T00:00:00.000Z' },
      now: '2026-04-22T00:00:00.000Z',
      generatedAt: '2026-04-22T00:00:00.000Z',
    });
    expect(report.revenue.totalUsd).toBe(0);
    expect(report.revenue.byProtocol.x402).toEqual({ totalUsd: 0, count: 0 });
    expect(report.revenue.byProtocol.mpp).toEqual({ totalUsd: 0, count: 0 });
    expect(report.pins.newInWindow).toEqual({ count: 0, totalBytes: 0 });
    expect(report.pins.active).toEqual({ count: 0, totalBytes: 0 });
    expect(report.requests).toEqual({ total: 0, paid: 0, rejected_402: 0 });
    expect(report.wallets).toEqual({
      payersInWindow: 0,
      cumulativePayers: 0,
      firstTimePayersInWindow: [],
    });
  });

  it('excludes pins with NULL size_bytes from totalBytes but counts them', () => {
    seedPin(pins, { requestid: 'r1', cid: 'b1', size_bytes: 1024 });
    seedPin(pins, { requestid: 'r2', cid: 'b2', size_bytes: null });
    seedPin(pins, { requestid: 'r3', cid: 'b3', size_bytes: 512 });

    const report = builder.build({
      window: { start: '2026-04-21T00:00:00.000Z', end: '2026-04-22T00:00:00.000Z' },
      now: '2026-04-22T00:00:00.000Z',
      generatedAt: '2026-04-22T00:00:00.000Z',
    });

    expect(report.pins.newInWindow.count).toBe(3);
    expect(report.pins.newInWindow.totalBytes).toBe(1536);
  });

  it('detects first-time payers correctly: only wallets whose first-ever payment is in window', () => {
    // 0xold paid before the window opens
    seedPayment(db, { id: 'p_old', payer_wallet: '0xold', occurred_at: '2026-04-15T00:00:00.000Z' });
    // 0xold also paid IN the window (not first-time)
    seedPayment(db, { id: 'p_old_again', payer_wallet: '0xold', occurred_at: '2026-04-21T12:00:00.000Z' });
    // 0xnew first paid in the window
    seedPayment(db, { id: 'p_new', payer_wallet: '0xnew', occurred_at: '2026-04-21T13:00:00.000Z' });

    const report = builder.build({
      window: { start: '2026-04-21T00:00:00.000Z', end: '2026-04-22T00:00:00.000Z' },
      now: '2026-04-22T00:00:00.000Z',
      generatedAt: '2026-04-22T00:00:00.000Z',
    });

    expect(report.wallets.firstTimePayersInWindow).toEqual(['0xnew']);
    expect(report.wallets.payersInWindow).toBe(2);  // both paid in window
    expect(report.wallets.cumulativePayers).toBe(2);
  });

  it('translates ISO window dates to YYYY-MM-DD for metrics summarize', () => {
    metrics.increment('2026-04-20', 'total');  // outside window
    metrics.increment('2026-04-21', 'total');
    metrics.increment('2026-04-21', 'paid');
    metrics.increment('2026-04-22', 'total');  // outside window (end exclusive)

    const report = builder.build({
      window: { start: '2026-04-21T00:00:00.000Z', end: '2026-04-22T00:00:00.000Z' },
      now: '2026-04-22T00:00:00.000Z',
      generatedAt: '2026-04-22T00:00:00.000Z',
    });

    expect(report.requests.total).toBe(1);
    expect(report.requests.paid).toBe(1);
  });

  it('throws when given a non-midnight-aligned window', () => {
    expect(() =>
      builder.build({
        window: { start: '2026-04-21T05:00:00.000Z', end: '2026-04-22T00:00:00.000Z' },
        now: '2026-04-22T00:00:00.000Z',
        generatedAt: '2026-04-22T00:00:00.000Z',
      })
    ).toThrow(/UTC-midnight/);
  });

  it('accepts both T00:00:00Z and T00:00:00.000Z formats', () => {
    expect(() =>
      builder.build({
        window: { start: '2026-04-21T00:00:00Z', end: '2026-04-22T00:00:00.000Z' },
        now: '2026-04-22T00:00:00.000Z',
        generatedAt: '2026-04-22T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('payment exactly at window.start is included; at window.end is excluded', () => {
    seedPayment(db, { id: 'p_at_start', occurred_at: '2026-04-21T00:00:00.000Z', amount_usd: 1, payer_wallet: '0xa' });
    seedPayment(db, { id: 'p_at_end', occurred_at: '2026-04-22T00:00:00.000Z', amount_usd: 100, payer_wallet: '0xb' });

    const report = builder.build({
      window: { start: '2026-04-21T00:00:00.000Z', end: '2026-04-22T00:00:00.000Z' },
      now: '2026-04-22T00:00:00.000Z',
      generatedAt: '2026-04-22T00:00:00.000Z',
    });

    expect(report.revenue.totalUsd).toBe(1);
    expect(report.wallets.payersInWindow).toBe(1);
  });

  it('firstTimePayersInWindow respects chronological order regardless of insertion order', () => {
    // Seed in REVERSE chronological order to ensure the SQL ORDER BY is what's working.
    seedPayment(db, { id: 'p3', payer_wallet: '0xccc', occurred_at: '2026-04-21T20:00:00.000Z' });
    seedPayment(db, { id: 'p1', payer_wallet: '0xaaa', occurred_at: '2026-04-21T08:00:00.000Z' });
    seedPayment(db, { id: 'p2', payer_wallet: '0xbbb', occurred_at: '2026-04-21T12:00:00.000Z' });

    const report = builder.build({
      window: { start: '2026-04-21T00:00:00.000Z', end: '2026-04-22T00:00:00.000Z' },
      now: '2026-04-22T00:00:00.000Z',
      generatedAt: '2026-04-22T00:00:00.000Z',
    });

    expect(report.wallets.firstTimePayersInWindow).toEqual(['0xaaa', '0xbbb', '0xccc']);
  });
});
