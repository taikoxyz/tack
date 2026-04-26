import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb } from '../../src/db';
import { PaymentRepository } from '../../src/repositories/payment-repository';
import { MetricsRepository } from '../../src/repositories/metrics-repository';
import { PinRepository } from '../../src/repositories/pin-repository';
import { DigestBuilder } from '../../src/services/reporting/digest-builder';
import { runWeeklyDigest } from '../../src/services/reporting/weekly-digest-job';
import type { Report } from '../../src/services/reporting/types';

const seedPayment = (db: Database.Database, overrides: Partial<{
  id: string; occurred_at: string; protocol: 'x402' | 'mpp'; amount_usd: number;
  payer_wallet: string; tx_hash: string | null; pin_request_id: string | null;
  endpoint: 'pin' | 'retrieval'; request_id: string | null;
}> = {}) => {
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
    overrides.request_id ?? null,
    overrides.tx_hash ?? null,
    overrides.pin_request_id ?? null,
  );
};

const seedPin = (repo: PinRepository, overrides: Partial<{
  requestid: string; cid: string; status: 'pinned' | 'failed' | 'queued' | 'pinning';
  created: string; updated: string; size_bytes: number | null; expires_at: string | null;
  owner: string;
}> = {}) => {
  repo.create({
    requestid: overrides.requestid ?? 'r',
    cid: overrides.cid ?? 'b',
    name: null,
    status: overrides.status ?? 'pinned',
    origins: [],
    meta: {},
    delegates: [],
    info: {},
    owner: overrides.owner ?? '0xaaa',
    created: overrides.created ?? '2026-04-21T00:00:00.000Z',
    updated: overrides.updated ?? '2026-04-21T00:00:00.000Z',
    expires_at: overrides.expires_at ?? null,
    size_bytes: overrides.size_bytes ?? null,
  });
};

describe('weekly digest integration (T22): end-to-end', () => {
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

  it('builds and publishes a complete weekly digest from seeded data', async () => {
    // fakeNow = 2026-04-27T09:00:00Z
    // Window: 2026-04-20T00:00:00Z (inclusive) → 2026-04-27T00:00:00Z (exclusive)
    const fakeNow = new Date('2026-04-27T09:00:00.000Z');

    // Inside window
    seedPayment(db, { id: 'p1', protocol: 'x402', amount_usd: 1.5, payer_wallet: '0xaaa', occurred_at: '2026-04-21T10:00:00.000Z' });
    seedPayment(db, { id: 'p2', protocol: 'mpp', amount_usd: 2.5, payer_wallet: '0xbbb', tx_hash: '0xtx2', occurred_at: '2026-04-22T15:00:00.000Z' });
    // Outside window (after end)
    seedPayment(db, { id: 'p3', protocol: 'x402', amount_usd: 100, payer_wallet: '0xccc', occurred_at: '2026-04-30T10:00:00.000Z' });

    // Inside window
    metrics.increment('2026-04-21', 'total');
    metrics.increment('2026-04-21', 'total');
    metrics.increment('2026-04-21', 'paid');
    metrics.increment('2026-04-22', 'total');
    metrics.increment('2026-04-22', 'rejected_402');
    // Outside window (after end)
    metrics.increment('2026-04-30', 'total');

    // Inside window
    seedPin(pins, { requestid: 'r1', cid: 'bafyA', size_bytes: 1024, created: '2026-04-21T00:00:00.000Z' });
    seedPin(pins, { requestid: 'r2', cid: 'bafyB', size_bytes: 2048, created: '2026-04-22T00:00:00.000Z' });
    // In window but expired — counted in newInWindow, excluded from active
    seedPin(pins, { requestid: 'r3', cid: 'bafyExpired', size_bytes: 99999, created: '2026-04-23T00:00:00.000Z', expires_at: '2026-04-25T00:00:00.000Z' });

    const slack = { post: vi.fn().mockResolvedValue(undefined) };
    const notion = { append: vi.fn().mockResolvedValue(undefined) };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await runWeeklyDigest({
      builder,
      slack: slack as any,
      notion: notion as any,
      logger: logger as any,
      now: () => fakeNow,
    });

    expect(slack.post).toHaveBeenCalledOnce();
    expect(notion.append).toHaveBeenCalledOnce();

    const slackReport = slack.post.mock.calls[0][0] as Report;
    const notionReport = notion.append.mock.calls[0][0] as Report;

    // Both publishers receive equivalent data
    expect(notionReport).toEqual(slackReport);

    // Window is midnight-aligned, 7 days
    expect(slackReport.window.start).toBe('2026-04-20T00:00:00.000Z');
    expect(slackReport.window.end).toBe('2026-04-27T00:00:00.000Z');

    // Revenue: only p1 and p2 are in window
    expect(slackReport.revenue.totalUsd).toBe(4.0);
    expect(slackReport.revenue.byProtocol.x402.totalUsd).toBe(1.5);
    expect(slackReport.revenue.byProtocol.x402.count).toBe(1);
    expect(slackReport.revenue.byProtocol.mpp.totalUsd).toBe(2.5);
    expect(slackReport.revenue.byProtocol.mpp.count).toBe(1);

    // Wallets: p1=0xaaa, p2=0xbbb in window; p3=0xccc counts toward cumulative
    expect(slackReport.wallets.payersInWindow).toBe(2);
    expect(slackReport.wallets.cumulativePayers).toBe(3);
    expect(slackReport.wallets.firstTimePayersInWindow).toEqual(['0xaaa', '0xbbb']);

    // Pins: 3 in window (includes expired); active excludes expired pin
    expect(slackReport.pins.newInWindow.count).toBe(3);
    expect(slackReport.pins.newInWindow.totalBytes).toBe(103071);
    expect(slackReport.pins.active.count).toBe(2);
    expect(slackReport.pins.active.totalBytes).toBe(3072);

    // Requests: only days inside window (2026-04-21 and 2026-04-22)
    expect(slackReport.requests.total).toBe(3);
    expect(slackReport.requests.paid).toBe(1);
    expect(slackReport.requests.rejected_402).toBe(1);
  });

  it('publishes empty zeros to both publishers when nothing has happened', async () => {
    const slack = { post: vi.fn().mockResolvedValue(undefined) };
    const notion = { append: vi.fn().mockResolvedValue(undefined) };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await runWeeklyDigest({
      builder,
      slack: slack as any,
      notion: notion as any,
      logger: logger as any,
      now: () => new Date('2026-04-27T09:00:00.000Z'),
    });

    expect(slack.post).toHaveBeenCalledOnce();
    expect(notion.append).toHaveBeenCalledOnce();

    const report = slack.post.mock.calls[0][0] as Report;
    expect(report.revenue.totalUsd).toBe(0);
    expect(report.requests.total).toBe(0);
    expect(report.pins.newInWindow.count).toBe(0);
    expect(report.wallets.payersInWindow).toBe(0);
  });

  it('continues to Notion when Slack post throws', async () => {
    seedPayment(db, { id: 'p1', amount_usd: 1, occurred_at: '2026-04-21T10:00:00.000Z' });

    const slack = { post: vi.fn().mockRejectedValue(new Error('slack down')) };
    const notion = { append: vi.fn().mockResolvedValue(undefined) };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await runWeeklyDigest({
      builder,
      slack: slack as any,
      notion: notion as any,
      logger: logger as any,
      now: () => new Date('2026-04-27T09:00:00.000Z'),
    });

    expect(notion.append).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalled();
  });
});
