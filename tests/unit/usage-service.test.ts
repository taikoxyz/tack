import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db';
import { MetricsRepository } from '../../src/repositories/metrics-repository';
import { PaymentRepository, type PaymentRecord } from '../../src/repositories/payment-repository';
import { PinRepository } from '../../src/repositories/pin-repository';
import { UsageMetricsService } from '../../src/services/usage/usage-service';

const basePayment = (overrides: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: 'pay_01',
  occurred_at: '2026-04-21T12:00:00.000Z',
  protocol: 'x402',
  chain_id: 167000,
  payer_wallet: '0x1111111111111111111111111111111111111111',
  asset_address: '0x2222222222222222222222222222222222222222',
  asset_decimals: 6,
  amount_atomic: '1000000',
  amount_usd: 1,
  endpoint: 'pin',
  request_id: 'req_1',
  tx_hash: null,
  pin_request_id: 'pin_1',
  ...overrides,
});

const seedPin = (repo: PinRepository, overrides: Partial<{
  requestid: string;
  cid: string;
  status: 'pinned' | 'failed' | 'queued' | 'pinning';
  created: string;
  size_bytes: number | null;
  expires_at: string | null;
}> = {}) => {
  repo.create({
    requestid: overrides.requestid ?? 'pin_1',
    cid: overrides.cid ?? 'bafy',
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

describe('UsageMetricsService', () => {
  let db: Database.Database;
  let payments: PaymentRepository;
  let metrics: MetricsRepository;
  let pins: PinRepository;
  let service: UsageMetricsService;

  beforeEach(() => {
    db = createDb(':memory:');
    payments = new PaymentRepository(db);
    metrics = new MetricsRepository(db);
    pins = new PinRepository(db);
    service = new UsageMetricsService({ payments, metrics, pins }, () => new Date('2026-04-28T15:30:00.000Z'));
  });

  it('builds a complete usage summary for a half-open UTC day window', () => {
    payments.insert(basePayment({
      id: 'p1',
      protocol: 'x402',
      amount_usd: 1.5,
      payer_wallet: '0xaaa',
      endpoint: 'pin',
      occurred_at: '2026-04-21T10:00:00.000Z',
    }));
    payments.insert(basePayment({
      id: 'p2',
      protocol: 'mpp',
      amount_usd: 2.5,
      payer_wallet: '0xbbb',
      endpoint: 'retrieval',
      tx_hash: '0xtx2',
      occurred_at: '2026-04-22T15:00:00.000Z',
    }));
    payments.insert(basePayment({
      id: 'p3',
      protocol: 'x402',
      amount_usd: 0.75,
      payer_wallet: '0xddd',
      endpoint: 'private_object',
      occurred_at: '2026-04-22T16:00:00.000Z',
    }));
    payments.insert(basePayment({
      id: 'outside',
      amount_usd: 100,
      payer_wallet: '0xccc',
      occurred_at: '2026-04-30T10:00:00.000Z',
    }));

    metrics.increment('2026-04-21', 'total');
    metrics.increment('2026-04-21', 'paid');
    metrics.increment('2026-04-22', 'total');
    metrics.increment('2026-04-22', 'rejected_402');
    metrics.increment('2026-04-30', 'total');

    seedPin(pins, { requestid: 'r1', cid: 'bafyA', size_bytes: 1024, created: '2026-04-21T00:00:00.000Z' });
    seedPin(pins, { requestid: 'r2', cid: 'bafyB', size_bytes: 2048, created: '2026-04-22T00:00:00.000Z' });
    seedPin(pins, {
      requestid: 'expired',
      cid: 'bafyExpired',
      size_bytes: 999,
      created: '2026-04-22T00:00:00.000Z',
      expires_at: '2026-04-25T00:00:00.000Z',
    });

    const summary = service.summary({ startDay: '2026-04-21', endDayExclusive: '2026-04-23' });

    expect(summary.window).toEqual({
      start: '2026-04-21T00:00:00.000Z',
      end: '2026-04-23T00:00:00.000Z',
      startDay: '2026-04-21',
      endDayExclusive: '2026-04-23',
    });
    expect(summary.generatedAt).toBe('2026-04-28T15:30:00.000Z');
    expect(summary.revenue).toEqual({
      totalUsd: 4.75,
      paymentCount: 3,
      uniquePayers: 3,
      byProtocol: {
        x402: { totalUsd: 2.25, count: 2 },
        mpp: { totalUsd: 2.5, count: 1 },
      },
      byEndpoint: {
        pin: { totalUsd: 1.5, count: 1 },
        retrieval: { totalUsd: 2.5, count: 1 },
        private_object: { totalUsd: 0.75, count: 1 },
        private_object_renewal: { totalUsd: 0, count: 0 },
      },
    });
    expect(summary.requests).toEqual({ total: 2, paid: 1, rejected_402: 1, free: 0 });
    expect(summary.pins.created).toEqual({ count: 3, totalBytes: 4071 });
    expect(summary.pins.active).toEqual({ count: 2, totalBytes: 3072 });
    expect(summary.wallets).toEqual({
      payersInWindow: 3,
      cumulativePayers: 4,
      firstTimePayersInWindow: ['0xaaa', '0xbbb', '0xddd'],
    });
  });

  it('defaults to the last seven UTC days including today when no window is provided', () => {
    const summary = service.summary();
    expect(summary.window.startDay).toBe('2026-04-22');
    expect(summary.window.endDayExclusive).toBe('2026-04-29');
  });

  it('rejects invalid or reversed day windows', () => {
    expect(() => service.summary({ startDay: '2026-04-21T00:00:00Z', endDayExclusive: '2026-04-22' }))
      .toThrow(/YYYY-MM-DD/);
    expect(() => service.summary({ startDay: '2026-04-22', endDayExclusive: '2026-04-22' }))
      .toThrow(/before/);
  });
});
