# Usage & Revenue Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship usage + revenue reporting for Tack — weekly Slack digest + Notion ledger row, plus an on-demand `/tack stats` Slack slash command. No HTTP admin surface, no wallet auth ceremony.

**Architecture:** Three additive schema changes (`payments` table, `request_metrics_daily` table, `pins.size_bytes` column). A synchronous `payment-recorder` writes a row after each 2xx with a verified payment. The existing per-request middleware increments daily counters. A pure `digest-builder` aggregates a `[start, end]` window into a `Report`. Two thin publishers (Slack webhook, Notion SDK) emit the report. A weekly cron drives publication; a Slack slash command serves the same `Report` shape on demand.

**Tech Stack:** TypeScript, Hono, better-sqlite3, Vitest, `@notionhq/client`, `node-cron`, `ulid`. Existing: `@x402/core/hono`, `mppx`, `pino`.

**Spec:** `docs/superpowers/specs/2026-04-25-usage-revenue-reporting-design.md`

---

## File Structure

**New files:**

```
src/
  repositories/
    payment-repository.ts            # CRUD + window aggregation on `payments`
    metrics-repository.ts            # upsert + summary on `request_metrics_daily`
  services/
    reporting/
      types.ts                       # Report, ReportWindow, RecordedPayment
      payment-recorder.ts            # records a payment row from PaymentResult
      digest-builder.ts              # pure: builds a Report from window
      slack-publisher.ts             # post(report) + formatInline(report)
      slack-slash-handler.ts         # verify Slack signature, build, reply
      notion-publisher.ts            # append(report) with week-key idempotency
      weekly-digest-job.ts           # cron: build → publish to Slack + Notion
tests/unit/
  payment-repository.test.ts
  metrics-repository.test.ts
  digest-builder.test.ts
  payment-recorder.test.ts
  slack-publisher.test.ts
  slack-slash-handler.test.ts
  notion-publisher.test.ts
  weekly-digest-job.test.ts
tests/integration/
  reporting.test.ts                  # end-to-end recording + counters + digest
```

**Modified files:**

- `src/db.ts` — schema migrations
- `src/types.ts` — add `size_bytes` to `StoredPinRecord`
- `src/repositories/pin-repository.ts` — persist + read `size_bytes`; add `summarize` method
- `src/services/payment/types.ts` — extend `PaymentResult` with amount/asset/endpoint fields
- `src/services/payment/middleware.ts` — populate new `PaymentResult` fields (MPP)
- `src/services/x402.ts` — populate `PaymentResult` after successful settlement (x402)
- `src/services/ipfs-rpc-client.ts` — `addContent` returns `{ hash, size }`
- `src/services/pinning-service.ts` — accept and persist size on upload
- `src/app.ts` — wire payment-recorder + counters into existing log middleware; register slash route
- `src/config.ts` — new env-driven config + production validation
- `src/index.ts` — boot weekly job, register slash handler, wire dependencies
- `package.json` — add `@notionhq/client`, `node-cron`, `ulid`
- `.env.example` — document new env vars

---

## Conventions used in this plan

- All ISO timestamps are UTC (`new Date().toISOString()`).
- Wallets are stored lowercased.
- Tests use `createDb(':memory:')` per the existing pattern in `tests/unit/pinning-service.test.ts:30`.
- Commits use Conventional Commits (`feat:`, `chore:`, `test:`).
- The plan is TDD throughout: write a failing test, run it, implement, run again, commit.

---

## Task 1: Add dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime + dev deps**

Run:
```bash
pnpm add @notionhq/client node-cron ulid
```

> Note: do not install `@types/node-cron`. `node-cron@4` ships its own bundled type declarations; the DefinitelyTyped package (`@types/node-cron@3.x`) targets the v3 runtime and has materially incompatible types (`ScheduleOptions` vs `TaskOptions`, different callback signature, different `ScheduledTask` shape).

Expected: `package.json` and `pnpm-lock.yaml` updated.

- [ ] **Step 2: Verify build still passes**

Run: `pnpm typecheck && pnpm test`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add notion, node-cron, ulid for reporting feature"
```

---

## Task 2: Schema migrations

Add the three additive changes to `createDb()` following the existing `expires_at` migration pattern.

**Files:**
- Modify: `src/db.ts`
- Test: `tests/unit/db.test.ts` (new file)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/db.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/db.test.ts`
Expected: FAIL — payments table doesn't exist.

- [ ] **Step 3: Add migrations to `createDb()`**

In `src/db.ts`, after the existing `expires_at` migration block (after `db.exec('CREATE INDEX IF NOT EXISTS idx_pins_expires_at ON pins(expires_at)');`), add:

```typescript
  // Reporting feature: payments raw event log
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id              TEXT PRIMARY KEY,
      occurred_at     TEXT NOT NULL,
      protocol        TEXT NOT NULL CHECK(protocol IN ('x402', 'mpp')),
      chain_id        INTEGER NOT NULL,
      payer_wallet    TEXT NOT NULL,
      asset_address   TEXT NOT NULL,
      asset_decimals  INTEGER NOT NULL,
      amount_atomic   TEXT NOT NULL,
      amount_usd      REAL NOT NULL,
      endpoint        TEXT NOT NULL CHECK(endpoint IN ('pin', 'retrieval')),
      request_id      TEXT,
      tx_hash         TEXT,
      pin_request_id  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_payments_occurred_at ON payments(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_payments_payer_wallet ON payments(payer_wallet);
    CREATE INDEX IF NOT EXISTS idx_payments_protocol ON payments(protocol);

    CREATE TABLE IF NOT EXISTS request_metrics_daily (
      day     TEXT NOT NULL,
      bucket  TEXT NOT NULL,
      count   INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, bucket)
    );
  `);

  // Reporting feature: pin size column
  if (!columns.some((col) => col.name === 'size_bytes')) {
    db.exec('ALTER TABLE pins ADD COLUMN size_bytes INTEGER');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_pins_size_bytes ON pins(size_bytes)');
```

Note: the `columns` variable is already declared earlier in the function for the `expires_at` check. Reuse it.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/db.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full test suite to verify no regressions**

Run: `pnpm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/db.ts tests/unit/db.test.ts
git commit -m "feat(db): add payments, request_metrics_daily, pins.size_bytes"
```

---

## Task 3: Payment repository

**Files:**
- Create: `src/repositories/payment-repository.ts`
- Test: `tests/unit/payment-repository.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/payment-repository.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/payment-repository.test.ts`
Expected: FAIL — `PaymentRepository` not found.

- [ ] **Step 3: Implement the repository**

Create `src/repositories/payment-repository.ts`:

```typescript
import type Database from 'better-sqlite3';

export interface PaymentRecord {
  id: string;
  occurred_at: string;
  protocol: 'x402' | 'mpp';
  chain_id: number;
  payer_wallet: string;
  asset_address: string;
  asset_decimals: number;
  amount_atomic: string;
  amount_usd: number;
  endpoint: 'pin' | 'retrieval';
  request_id: string | null;
  tx_hash: string | null;
  pin_request_id: string | null;
}

export interface PaymentWindow {
  start: string;
  end: string;
}

export interface PaymentSummary {
  totalUsd: number;
  count: number;
  uniquePayers: number;
  byProtocol: {
    x402: { totalUsd: number; count: number };
    mpp: { totalUsd: number; count: number };
  };
}

export class PaymentRepository {
  constructor(private readonly db: Database.Database) {}

  insert(record: PaymentRecord): void {
    if (record.tx_hash) {
      const existing = this.db
        .prepare('SELECT id FROM payments WHERE protocol = ? AND tx_hash = ?')
        .get(record.protocol, record.tx_hash);
      if (existing) {
        return;
      }
    }

    this.db
      .prepare(
        `INSERT INTO payments (
          id, occurred_at, protocol, chain_id, payer_wallet,
          asset_address, asset_decimals, amount_atomic, amount_usd,
          endpoint, request_id, tx_hash, pin_request_id
        ) VALUES (
          @id, @occurred_at, @protocol, @chain_id, @payer_wallet,
          @asset_address, @asset_decimals, @amount_atomic, @amount_usd,
          @endpoint, @request_id, @tx_hash, @pin_request_id
        )`
      )
      .run(record);
  }

  findById(id: string): PaymentRecord | null {
    const row = this.db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as PaymentRecord | undefined;
    return row ?? null;
  }

  summarizeWindow(window: PaymentWindow): PaymentSummary {
    const rows = this.db
      .prepare(
        `SELECT protocol, amount_usd, payer_wallet
         FROM payments
         WHERE occurred_at >= ? AND occurred_at < ?`
      )
      .all(window.start, window.end) as Array<{ protocol: 'x402' | 'mpp'; amount_usd: number; payer_wallet: string }>;

    const summary: PaymentSummary = {
      totalUsd: 0,
      count: rows.length,
      uniquePayers: new Set(rows.map((r) => r.payer_wallet)).size,
      byProtocol: {
        x402: { totalUsd: 0, count: 0 },
        mpp: { totalUsd: 0, count: 0 },
      },
    };

    for (const row of rows) {
      summary.totalUsd += row.amount_usd;
      summary.byProtocol[row.protocol].totalUsd += row.amount_usd;
      summary.byProtocol[row.protocol].count += 1;
    }

    return summary;
  }

  firstTimePayers(window: PaymentWindow): string[] {
    const rows = this.db
      .prepare(
        `SELECT payer_wallet
         FROM payments
         GROUP BY payer_wallet
         HAVING MIN(occurred_at) >= ? AND MIN(occurred_at) < ?
         ORDER BY MIN(occurred_at) ASC`
      )
      .all(window.start, window.end) as Array<{ payer_wallet: string }>;

    return rows.map((r) => r.payer_wallet);
  }

  cumulativeUniquePayers(): number {
    const row = this.db.prepare('SELECT COUNT(DISTINCT payer_wallet) AS n FROM payments').get() as { n: number };
    return row.n;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/payment-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/payment-repository.ts tests/unit/payment-repository.test.ts
git commit -m "feat(reporting): add PaymentRepository with window aggregation"
```

---

## Task 4: Metrics repository

**Files:**
- Create: `src/repositories/metrics-repository.ts`
- Test: `tests/unit/metrics-repository.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/metrics-repository.test.ts`:

```typescript
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db';
import { MetricsRepository } from '../../src/repositories/metrics-repository';

describe('MetricsRepository', () => {
  let db: Database.Database;
  let repo: MetricsRepository;

  beforeEach(() => {
    db = createDb(':memory:');
    repo = new MetricsRepository(db);
  });

  it('increments a new bucket from zero', () => {
    repo.increment('2026-04-21', 'total');
    const row = db.prepare('SELECT count FROM request_metrics_daily WHERE day = ? AND bucket = ?')
      .get('2026-04-21', 'total') as { count: number };
    expect(row.count).toBe(1);
  });

  it('upserts incrementally', () => {
    repo.increment('2026-04-21', 'paid');
    repo.increment('2026-04-21', 'paid');
    repo.increment('2026-04-21', 'paid');
    const row = db.prepare('SELECT count FROM request_metrics_daily WHERE day = ? AND bucket = ?')
      .get('2026-04-21', 'paid') as { count: number };
    expect(row.count).toBe(3);
  });

  it('summarizes a window across day boundaries', () => {
    repo.increment('2026-04-20', 'total');
    repo.increment('2026-04-20', 'total');
    repo.increment('2026-04-21', 'total');
    repo.increment('2026-04-21', 'paid');
    repo.increment('2026-04-21', 'rejected_402');
    repo.increment('2026-04-22', 'total');  // outside window

    const summary = repo.summarizeWindow({
      startDay: '2026-04-20',
      endDayExclusive: '2026-04-22',
    });

    expect(summary).toEqual({
      total: 3,
      paid: 1,
      rejected_402: 1,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/metrics-repository.test.ts`
Expected: FAIL — `MetricsRepository` not found.

- [ ] **Step 3: Implement the repository**

Create `src/repositories/metrics-repository.ts`:

```typescript
/**
 * Per-day request counters. All `day` strings are UTC `YYYY-MM-DD` —
 * callers must compute them in UTC (`new Date().toISOString().slice(0, 10)`)
 * to match the weekly digest window boundaries. Mixing UTC and local-time
 * day strings would skew counts during DST transitions.
 */
import type Database from 'better-sqlite3';

/**
 * Counter buckets recorded for every request. The schema has no CHECK
 * constraint on `bucket` (db.ts), so this list is the only thing
 * keeping unexpected labels out of the typed result. Defense-in-depth:
 * `summarizeWindow` ignores any row whose bucket isn't in this list.
 */
export const METRICS_BUCKETS = ['total', 'paid', 'rejected_402'] as const;
export type MetricsBucket = typeof METRICS_BUCKETS[number];

function isMetricsBucket(value: string): value is MetricsBucket {
  return (METRICS_BUCKETS as readonly string[]).includes(value);
}

export interface MetricsWindow {
  /** UTC day, format `YYYY-MM-DD`, inclusive. */
  startDay: string;
  /** UTC day, format `YYYY-MM-DD`, exclusive. */
  endDayExclusive: string;
}

export interface MetricsSummary {
  total: number;
  paid: number;
  rejected_402: number;
}

export class MetricsRepository {
  constructor(private readonly db: Database.Database) {}

  /**
   * Increments the counter for `(day, bucket)`, creating the row if absent.
   *
   * @param day UTC day, format `YYYY-MM-DD`. Must match the format used by
   *   the digest window boundaries. Other formats will create parallel rows
   *   that the digest will silently miss.
   * @param bucket One of `METRICS_BUCKETS`.
   */
  increment(day: string, bucket: MetricsBucket): void {
    this.db
      .prepare(
        `INSERT INTO request_metrics_daily (day, bucket, count)
         VALUES (?, ?, 1)
         ON CONFLICT(day, bucket) DO UPDATE SET count = count + 1`
      )
      .run(day, bucket);
  }

  summarizeWindow(window: MetricsWindow): MetricsSummary {
    const rows = this.db
      .prepare(
        `SELECT bucket, SUM(count) AS total
         FROM request_metrics_daily
         WHERE day >= ? AND day < ?
         GROUP BY bucket`
      )
      .all(window.startDay, window.endDayExclusive) as Array<{ bucket: string; total: number }>;

    const summary: MetricsSummary = { total: 0, paid: 0, rejected_402: 0 };
    for (const row of rows) {
      if (isMetricsBucket(row.bucket)) {
        summary[row.bucket] = row.total;
      }
    }
    return summary;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/metrics-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/metrics-repository.ts tests/unit/metrics-repository.test.ts
git commit -m "feat(reporting): add MetricsRepository for daily request counters"
```

---

## Task 5: Pin repository — add `summarize` and `size_bytes` support

**Files:**
- Modify: `src/types.ts`
- Modify: `src/repositories/pin-repository.ts`
- Test: existing `tests/unit/pinning-service.test.ts` (no breakage); new method test inline below.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/pinning-service.test.ts` a new describe block, OR (simpler) add a new file `tests/unit/pin-repository-summarize.test.ts`:

```typescript
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db';
import { PinRepository } from '../../src/repositories/pin-repository';

describe('PinRepository.summarize', () => {
  let db: Database.Database;
  let repo: PinRepository;

  const baseRow = (overrides: Partial<{
    requestid: string;
    cid: string;
    owner: string;
    status: 'pinned' | 'failed' | 'queued' | 'pinning';
    created: string;
    size_bytes: number | null;
    expires_at: string | null;
  }>) => ({
    requestid: overrides.requestid ?? 'req',
    cid: overrides.cid ?? 'bafy',
    name: null,
    status: (overrides.status ?? 'pinned') as 'pinned' | 'failed' | 'queued' | 'pinning',
    origins: [],
    meta: {},
    delegates: [],
    info: {},
    owner: overrides.owner ?? '0xaaa',
    created: overrides.created ?? '2026-04-21T00:00:00.000Z',
    updated: '2026-04-21T00:00:00.000Z',
    expires_at: overrides.expires_at ?? null,
    size_bytes: overrides.size_bytes ?? null,
  });

  beforeEach(() => {
    db = createDb(':memory:');
    repo = new PinRepository(db);
  });

  it('counts new pins and bytes in window, ignoring NULL sizes for byte total', () => {
    repo.create(baseRow({ requestid: 'a', cid: 'b1', size_bytes: 1000, created: '2026-04-21T00:00:00.000Z' }));
    repo.create(baseRow({ requestid: 'b', cid: 'b2', size_bytes: 2000, created: '2026-04-22T00:00:00.000Z' }));
    repo.create(baseRow({ requestid: 'c', cid: 'b3', size_bytes: null, created: '2026-04-22T00:00:00.000Z' }));
    repo.create(baseRow({ requestid: 'd', cid: 'b4', size_bytes: 999999, created: '2026-04-30T00:00:00.000Z' })); // outside

    const summary = repo.summarize({
      start: '2026-04-20T00:00:00.000Z',
      end: '2026-04-23T00:00:00.000Z',
      now: '2026-04-23T00:00:00.000Z',
    });

    expect(summary.newPinsInWindow.count).toBe(3);
    expect(summary.newPinsInWindow.totalBytes).toBe(3000);
  });

  it('counts active pins and total bytes under management', () => {
    repo.create(baseRow({ requestid: 'a', cid: 'b1', status: 'pinned', size_bytes: 1000 }));
    repo.create(baseRow({ requestid: 'b', cid: 'b2', status: 'pinned', size_bytes: 2000, expires_at: '2026-05-01T00:00:00.000Z' }));
    repo.create(baseRow({ requestid: 'c', cid: 'b3', status: 'pinned', size_bytes: 5000, expires_at: '2026-04-01T00:00:00.000Z' })); // expired
    repo.create(baseRow({ requestid: 'd', cid: 'b4', status: 'failed', size_bytes: 7000 }));

    const summary = repo.summarize({
      start: '2026-04-20T00:00:00.000Z',
      end: '2026-04-23T00:00:00.000Z',
      now: '2026-04-23T00:00:00.000Z',
    });

    expect(summary.activePins.count).toBe(2);
    expect(summary.activePins.totalBytes).toBe(3000);
  });
});
```

- [ ] **Step 2: Add `size_bytes` to `StoredPinRecord` in `src/types.ts`**

Find the `StoredPinRecord` interface and add:

```typescript
export interface StoredPinRecord {
  // ... existing fields
  size_bytes: number | null;
}
```

- [ ] **Step 3: Update `PinRepository` to read/write `size_bytes` and add `summarize`**

In `src/repositories/pin-repository.ts`:

(a) Add `size_bytes` to `DbPinRow`:

```typescript
interface DbPinRow {
  // ... existing fields
  size_bytes: number | null;
}
```

(b) Update `create` to include `size_bytes`:

```typescript
const statement = this.db.prepare(`
  INSERT INTO pins (
    requestid, cid, name, status, origins, meta, delegates, info, owner, created, updated, expires_at, size_bytes
  ) VALUES (
    @requestid, @cid, @name, @status, @origins, @meta, @delegates, @info, @owner, @created, @updated, @expires_at, @size_bytes
  )
`);
```

(c) Update `update` to include `size_bytes` in the `SET` clause.

(d) Update every `SELECT ...` query that returns pin columns to include `size_bytes`.

(e) Update `mapRow` to include `size_bytes: row.size_bytes`.

(f) Add `summarize` method at the end of the class:

```typescript
export interface PinSummaryWindow {
  start: string;
  end: string;
  now: string;
}

export interface PinSummary {
  newPinsInWindow: { count: number; totalBytes: number };
  activePins: { count: number; totalBytes: number };
}

// inside class PinRepository:
summarize(window: PinSummaryWindow): PinSummary {
  const newPins = this.db.prepare(
    `SELECT COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS bytes
     FROM pins
     WHERE created >= ? AND created < ?`
  ).get(window.start, window.end) as { count: number; bytes: number };

  const active = this.db.prepare(
    `SELECT COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS bytes
     FROM pins
     WHERE status = 'pinned' AND (expires_at IS NULL OR expires_at > ?)`
  ).get(window.now) as { count: number; bytes: number };

  return {
    newPinsInWindow: { count: newPins.count, totalBytes: newPins.bytes },
    activePins: { count: active.count, totalBytes: active.bytes },
  };
}
```

- [ ] **Step 4: Update `PinningService` and any callers that build `StoredPinRecord` to set `size_bytes: null`**

Search for `StoredPinRecord` usages in `src/services/pinning-service.ts`. For every place that creates a record, add `size_bytes: null` (the upload path will be enhanced in Task 7 to populate it).

- [ ] **Step 5: Run tests**

Run: `pnpm test`
Expected: PASS — including the new summarize tests, and no regression in existing pin/pinning-service tests.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/repositories/pin-repository.ts src/services/pinning-service.ts tests/unit/pin-repository-summarize.test.ts
git commit -m "feat(pins): persist size_bytes and add summarize for reporting"
```

---

## Task 6: Extend `IpfsRpcClient.addContent` to return size

**Files:**
- Modify: `src/services/ipfs-rpc-client.ts`
- Test: `tests/unit/ipfs-rpc-client.test.ts` (new file — there is no existing one)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ipfs-rpc-client.test.ts`:

```typescript
import { describe, expect, it, vi, afterEach } from 'vitest';
import { IpfsRpcClient } from '../../src/services/ipfs-rpc-client';

describe('IpfsRpcClient.addContent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns hash and size from Kubo response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ Name: 'f.txt', Hash: 'bafyhash', Size: '1234' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new IpfsRpcClient('http://ipfs:5001');
    const result = await client.addContent(new Blob(['hello']), 'f.txt');

    expect(result).toEqual({ hash: 'bafyhash', size: 1234 });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns size as 0 if Kubo omits the field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ Name: 'f.txt', Hash: 'bafyhash' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new IpfsRpcClient('http://ipfs:5001');
    const result = await client.addContent(new Blob(['hello']), 'f.txt');
    expect(result).toEqual({ hash: 'bafyhash', size: 0 });
  });
});
```

- [ ] **Step 2: Run the test — it will fail because `addContent` returns `string`, not an object**

Run: `pnpm test tests/unit/ipfs-rpc-client.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `IpfsClient` interface and implementation**

In `src/services/ipfs-rpc-client.ts`:

```typescript
export interface IpfsAddResult {
  hash: string;
  size: number;
}

export interface IpfsClient {
  pinAdd(cid: string): Promise<void>;
  pinRm(cid: string): Promise<void>;
  addContent(content: Blob, filename: string): Promise<IpfsAddResult>;
  cat(cid: string, options?: { maxBytes?: number }): Promise<ArrayBuffer>;
}
```

In `addContent`, replace the final two lines with:

```typescript
const data = (await response.json()) as IpfsAddResponse;
const size = Number.parseInt(data.Size ?? '0', 10);
return {
  hash: data.Hash,
  size: Number.isFinite(size) && size >= 0 ? size : 0,
};
```

- [ ] **Step 4: Update all callers of `addContent`**

Search the codebase: `grep -rn 'addContent(' src/ tests/`. Update:

- `src/services/pinning-service.ts` — wherever `addContent` is awaited and assigned to a variable, destructure `{ hash, size }`. If a caller previously did `const cid = await ipfsClient.addContent(...)`, change to `const { hash: cid, size } = await ipfsClient.addContent(...)`.
- `tests/unit/pinning-service.test.ts:35` — change `addContent: vi.fn().mockResolvedValue('bafy-upload')` to `addContent: vi.fn().mockResolvedValue({ hash: 'bafy-upload', size: 0 })`.
- Any other test that mocks `addContent`.

- [ ] **Step 5: Run all tests**

Run: `pnpm test`
Expected: PASS — both the new test and the updated existing tests.

- [ ] **Step 6: Commit**

```bash
git add src/services/ipfs-rpc-client.ts src/services/pinning-service.ts tests/unit/ipfs-rpc-client.test.ts tests/unit/pinning-service.test.ts
git commit -m "refactor(ipfs): addContent returns hash + size"
```

---

## Task 7: Persist `size_bytes` on POST /pins via existing size header

The `/upload` flow returns `{ cid, size }` but does NOT create a pin row — that's the IPFS Pinning Service spec. Pin records are created by `POST /pins`, which already extracts `x-content-size-bytes` for x402 pricing (`src/services/x402.ts:97`). This task threads that same size through to the pin record.

**Files:**
- Modify: `src/services/pinning-service.ts` — `createPin` accepts an optional `sizeBytes` parameter and persists it
- Modify: `src/app.ts` — the `POST /pins` handler reads the size from the request (header preferred, then JSON payload) and passes it to `createPin`
- Test: `tests/unit/pinning-service.test.ts` — assert `size_bytes` is persisted when supplied

- [ ] **Step 1: Write the failing test**

In `tests/unit/pinning-service.test.ts`, add inside the existing describe:

```typescript
it('persists size_bytes when supplied to createPin', async () => {
  const result = await service.createPin({ cid: 'bafy-sized', owner: wallet, sizeBytes: 4242 });

  const stored = repository.findByRequestId(result.requestid);
  expect(stored?.size_bytes).toBe(4242);
});

it('persists size_bytes as null when not supplied to createPin', async () => {
  const result = await service.createPin({ cid: 'bafy-no-size', owner: wallet });

  const stored = repository.findByRequestId(result.requestid);
  expect(stored?.size_bytes).toBeNull();
});
```

- [ ] **Step 2: Run the test**

`pnpm test tests/unit/pinning-service.test.ts` — expected: FAIL (createPin doesn't accept sizeBytes).

- [ ] **Step 3: Update `createPin` signature and implementation**

In `src/services/pinning-service.ts`, find `createPin`. Add an optional `sizeBytes?: number` to the input type. In the body where the StoredPinRecord is constructed (currently has `size_bytes: null`), change to:

```typescript
size_bytes: typeof input.sizeBytes === 'number' && input.sizeBytes > 0 ? input.sizeBytes : null,
```

(Treat 0 as "unknown" — same convention as the digest excludes 0/NULL.)

- [ ] **Step 4: Wire `POST /pins` to extract and pass size**

In `src/app.ts`, find the `POST /pins` handler. Before calling `createPin`, extract the size:

```typescript
// Read raw JSON ONCE so both the typed parse AND the size extraction see the
// same unstripped object. parsePinPayload strips top-level sizeBytes; if we
// passed the *parsed* output to parseSizeBytesFromPinPayload, top-level
// sizeBytes would be silently dropped.
const rawJson = await parseJsonBody(c);
const payload = parsePinPayload(rawJson);

const sizeFromHeader = parseNonNegativeInteger(c.req.header('x-content-size-bytes'));
const sizeFromBody = sizeFromHeader === undefined
  ? parseSizeBytesFromPinPayload(rawJson)
  : undefined;
const sizeBytes = sizeFromHeader ?? sizeFromBody;
```

**Important**: pass `rawJson` (the unstripped JSON object) to `parseSizeBytesFromPinPayload`, not the output of `parsePinPayload`. The typed parse strips top-level `sizeBytes`; passing the parsed output silently drops clients that post `{ cid, sizeBytes }` without an `x-content-size-bytes` header.

Reuse `parseNonNegativeInteger` and `parseSizeBytesFromPinPayload` from `src/services/payment/pricing.ts`. Pass `sizeBytes` into `createPin`.

- [ ] **Step 5: Run all tests**

`pnpm test && pnpm typecheck` — expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/services/pinning-service.ts src/app.ts tests/unit/pinning-service.test.ts
git commit -m "$(cat <<'EOF'
feat(pins): persist size_bytes from x-content-size-bytes on POST /pins

Reuses the same size signal x402 already consumes for pricing —
header `x-content-size-bytes` preferred, then JSON-payload parse via
parseSizeBytesFromPinPayload — and threads it through createPin to
the pin record. Clients that uploaded via /upload now have the size
to feed back via this header.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Extend `PaymentResult` with amount/asset/endpoint fields

**Files:**
- Modify: `src/services/payment/types.ts`
- Test: covered by recorder tests in Task 9 (this is purely a type change)

- [ ] **Step 1: Edit the type**

Replace `src/services/payment/types.ts` with:

```typescript
export type PaymentProtocol = 'x402' | 'mpp';
export type PaymentEndpoint = 'pin' | 'retrieval';

export interface PaymentResult {
  wallet: string;
  protocol: PaymentProtocol;
  chainName: string;
  receipt?: string;

  /**
   * Reporting fields. Optional during transition: existing call sites
   * that don't yet populate them keep working until Tasks 10 + 11 wire
   * them up. Once those tasks land, the recorder skips a row when any
   * field is missing rather than rejecting the request.
   */
  chainId?: number;
  amountAtomic?: string;
  amountUsd?: number;
  assetAddress?: string;
  assetDecimals?: number;
  endpoint?: PaymentEndpoint;
  txHash?: string;
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: clean (no callers were depending on the absence of these fields).

- [ ] **Step 3: Commit**

```bash
git add src/services/payment/types.ts
git commit -m "feat(payment): extend PaymentResult with reporting fields"
```

---

## Task 9: Payment recorder

**Files:**
- Create: `src/services/reporting/types.ts`
- Create: `src/services/reporting/payment-recorder.ts`
- Test: `tests/unit/payment-recorder.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/payment-recorder.test.ts`:

```typescript
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb } from '../../src/db';
import { PaymentRepository } from '../../src/repositories/payment-repository';
import { PaymentRecorder } from '../../src/services/reporting/payment-recorder';
import type { PaymentResult } from '../../src/services/payment/types';

const fullResult: PaymentResult = {
  wallet: '0xaaa',
  protocol: 'mpp',
  chainName: 'tempo',
  chainId: 4217,
  amountAtomic: '1000000',
  amountUsd: 1.0,
  assetAddress: '0xtoken',
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

  it('records a complete payment result', () => {
    recorder.record(fullResult, { requestId: 'req_1', pinRequestId: 'pin_1' });

    const rows = db.prepare('SELECT * FROM payments').all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurred_at: '2026-04-21T12:00:00.000Z',
      protocol: 'mpp',
      chain_id: 4217,
      payer_wallet: '0xaaa',
      amount_atomic: '1000000',
      amount_usd: 1.0,
      endpoint: 'pin',
      tx_hash: '0xtx',
      pin_request_id: 'pin_1',
    });
  });

  it('skips and warns when required fields are missing', () => {
    const partial: PaymentResult = { ...fullResult, amountUsd: undefined };
    recorder.record(partial, { requestId: 'req_2' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM payments').get()).toEqual({ n: 0 });
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('logs and swallows DB errors (does not throw)', () => {
    const failingRepo = { insert: vi.fn().mockImplementation(() => { throw new Error('boom'); }) } as any;
    const r = new PaymentRecorder(failingRepo, logger as any, () => '2026-04-21T12:00:00.000Z');
    expect(() => r.record(fullResult, { requestId: 'req_3' })).not.toThrow();
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm test tests/unit/payment-recorder.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/services/reporting/types.ts`**

```typescript
export interface ReportWindow {
  start: string;
  end: string;
}

export interface Report {
  window: ReportWindow;
  generatedAt: string;
  revenue: {
    totalUsd: number;
    byProtocol: {
      x402: { totalUsd: number; count: number };
      mpp: { totalUsd: number; count: number };
    };
  };
  pins: {
    newInWindow: { count: number; totalBytes: number };
    active: { count: number; totalBytes: number };
  };
  wallets: {
    payersInWindow: number;
    cumulativePayers: number;
    firstTimePayersInWindow: string[];
  };
  requests: {
    total: number;
    paid: number;
    rejected_402: number;
  };
}
```

- [ ] **Step 4: Implement the recorder**

Create `src/services/reporting/payment-recorder.ts`:

```typescript
import { ulid } from 'ulid';
import type { Logger } from 'pino';
import type { PaymentRepository } from '../../repositories/payment-repository';
import type { PaymentResult } from '../payment/types';

export interface PaymentRecorderContext {
  requestId?: string;
  pinRequestId?: string;
}

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
        'payment recorder skipped: missing required fields'
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
        'payment recorder insert failed; chain receipt is source of truth'
      );
    }
  }
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/unit/payment-recorder.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/reporting/types.ts src/services/reporting/payment-recorder.ts tests/unit/payment-recorder.test.ts
git commit -m "feat(reporting): PaymentRecorder writes payment rows from PaymentResult"
```

---

## Task 10: Wire MPP middleware to populate new PaymentResult fields

**Files:**
- Modify: `src/services/payment/middleware.ts`

The MPP path receives the requirement (which has `amount`, `recipient`) and the protocol always settles on Tempo. We populate the new fields from the requirement and the configured chain.

- [ ] **Step 1: Update `MppPaymentMiddlewareConfig`**

Add a `chainContext` field that supplies the static fields for Tempo:

```typescript
interface MppPaymentMiddlewareConfig {
  mppx: MppxChargeHandler;
  requirementFn: (c: Context) => MppPaymentRequirement | null | Promise<MppPaymentRequirement | null>;
  resolveVerifiedPayer: ResolveVerifiedPayer;
  chainContext: {
    chainId: number;
    assetAddress: string;
    assetDecimals: number;
    /** Convert atomic amount string to USD. */
    atomicToUsd: (amountAtomic: string) => number;
    /** Decide endpoint from request path. */
    endpointFor: (path: string) => 'pin' | 'retrieval';
  };
  onPayerResolutionFailure?: (error: unknown, request: Request) => void;
}
```

- [ ] **Step 2: Populate `paymentResult`**

Replace the `c.set('paymentResult'...)` call with:

```typescript
c.set('paymentResult' as any, {
  wallet,
  protocol: 'mpp',
  chainName: 'tempo',
  chainId: chainContext.chainId,
  assetAddress: chainContext.assetAddress,
  assetDecimals: chainContext.assetDecimals,
  amountAtomic: requirement.amount,
  amountUsd: chainContext.atomicToUsd(requirement.amount),
  endpoint: chainContext.endpointFor(c.req.path),
  // tx_hash extraction from result.withReceipt is best-effort; see Task 11 note.
} satisfies PaymentResult);
```

- [ ] **Step 3: Update the MPP middleware bootstrapping in `src/index.ts` (will be wired in Task 14)**

For now, the change is just type-level. The integration point will be filled in when the index wiring happens. Add a TODO **only as a placeholder in the imports list** if needed — but better: leave `chainContext` as a required arg in the type so the compiler forces the wiring in Task 14.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: errors at `src/index.ts` where `createMppPaymentMiddleware` is called without `chainContext`. Note these errors — Task 14 will fix them. **Do not commit yet.**

If you want to commit incrementally, fix the index.ts call site by passing a stub `chainContext` that derives from existing config. The simplest stub:

```typescript
chainContext: {
  chainId: 4217,
  assetAddress: '0xUSDCEonTempo'.toLowerCase(),  // resolved from mppx config
  assetDecimals: 6,
  atomicToUsd: (atomic) => Number(atomic) / 1_000_000,
  endpointFor: (path) => path.startsWith('/ipfs/') ? 'retrieval' : 'pin',
},
```

(Use the actual USDC.e address — search `src/services/payment/chains` for the existing constant.)

- [ ] **Step 5: Run all tests**

Run: `pnpm test`
Expected: PASS (existing MPP integration tests should still work — `paymentResult` gains fields but doesn't lose any).

- [ ] **Step 6: Commit**

```bash
git add src/services/payment/middleware.ts src/index.ts
git commit -m "feat(mpp): populate amount/asset/endpoint on PaymentResult"
```

---

## Task 11: Wire x402 middleware to set PaymentResult on settle

The x402 path currently doesn't set `paymentResult` at all — only MPP does. We need to set it after a successful settlement so the recorder has data.

**Files:**
- Modify: `src/services/x402.ts`

- [ ] **Step 1: Locate the verified-success branch**

In `src/services/x402.ts`, find the case `'payment-verified'` (around line 401). The flow:
1. `await next()` runs the handler
2. `processSettlement` is called
3. On success, settlement headers are merged onto the response

We add `c.set('paymentResult', ...)` immediately after a successful `processSettlement`.

- [ ] **Step 2: Extract chain + asset metadata**

The `paymentRequirements` object contains `network` (e.g., `eip155:167000`), `payTo`, and the asset details inside `extra`. The atomic amount paid is in `paymentPayload.payload.authorization.value` (EIP-3009) — but we know the *required* amount from `paymentRequirements.maxAmountRequired`. We use that as the canonical amount.

In x402.ts, just before `c.res = res;` in the verified-success path, add:

```typescript
if (settleResult.success) {
  const wallet = (() => {
    const payload = (paymentPayload as any)?.payload;
    return (
      payload?.authorization?.from ??
      payload?.permit2Authorization?.from ??
      payload?.from ??
      ''
    ).toString().toLowerCase();
  })();

  const network = String(paymentRequirements.network ?? '');
  const chainId = network.startsWith('eip155:') ? Number(network.slice('eip155:'.length)) : 0;
  const assetAddress = String((paymentRequirements as any).asset ?? '').toLowerCase();
  const assetDecimals = config.chains.find((c) => c.network === network)?.usdcAssetDecimals ?? 6;
  const amountAtomic = String((paymentRequirements as any).maxAmountRequired ?? '0');
  const amountUsd = Number(amountAtomic) / 10 ** assetDecimals;
  const endpoint: 'pin' | 'retrieval' = c.req.path.startsWith('/ipfs/') ? 'retrieval' : 'pin';
  const txHash = (() => {
    const headerValue = settleResult.headers['x-payment-response'] ?? settleResult.headers['X-Payment-Response'];
    if (!headerValue) return undefined;
    try {
      const decoded = JSON.parse(Buffer.from(headerValue, 'base64').toString('utf8'));
      return typeof decoded?.transaction === 'string' ? decoded.transaction : undefined;
    } catch {
      return undefined;
    }
  })();

  c.set('paymentResult' as any, {
    wallet,
    protocol: 'x402',
    chainName: network,
    chainId,
    assetAddress,
    assetDecimals,
    amountAtomic,
    amountUsd,
    endpoint,
    txHash,
  });
}
```

**Important closure detail:** the existing code structures the middleware as `createPaymentMiddleware(httpServer)` (around line 354, returned from `createX402PaymentMiddleware`). That inner function does NOT close over `config`. To make `config` accessible:

1. Change the inner factory signature to `function createPaymentMiddleware(httpServer: x402HTTPResourceServer, config: X402PaymentConfig)`.
2. Update the single call site at the bottom of `createX402PaymentMiddleware` from `createPaymentMiddleware(httpServer)` to `createPaymentMiddleware(httpServer, config)`.

Now `config.chains` is in scope inside the verified-success case.

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: PASS — existing x402 tests should not regress; we're adding a `c.set` that nothing else reads yet.

- [ ] **Step 4: Add a focused x402 unit test**

Append to `tests/unit/x402.test.ts` (existing file) a test asserting that after a verified-and-settled flow, `c.get('paymentResult')` is populated with the expected fields. Use the same harness the existing tests use; copy their pattern.

(If the harness doesn't easily expose `c.get`, instead add a minimal `app.get('/probe', ...)` route in the test that reads the value and returns it as JSON, then assert against the response body.)

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/unit/x402.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/x402.ts tests/unit/x402.test.ts
git commit -m "feat(x402): set PaymentResult on settle for reporting"
```

---

## Task 12: Wire payment-recorder + counters into request middleware

**Files:**
- Modify: `src/app.ts`

- [ ] **Step 1: Extend `AppServices` (or equivalent)**

Find the type/object that bundles services passed into `createApp` (search `src/app.ts` for where `services` is typed). Add:

```typescript
paymentRecorder?: PaymentRecorder;
metricsRepository?: MetricsRepository;
```

Optional so the app remains usable without the reporting wiring (e.g., during early dev / tests not exercising it).

- [ ] **Step 2: Update the per-request middleware (around `app.ts:435`)**

Replace the existing block:

```typescript
await next();
logger.info({ ... }, 'request handled');
```

With the augmented version that also writes counters and records payments:

```typescript
await next();

const status = c.res.status;
const day = new Date().toISOString().slice(0, 10);

if (services.metricsRepository) {
  services.metricsRepository.increment(day, 'total');
  if (status === 402) {
    services.metricsRepository.increment(day, 'rejected_402');
  }
}

const paymentResult = c.get('paymentResult') as PaymentResult | undefined;
if (paymentResult && status >= 200 && status < 300) {
  if (services.metricsRepository) {
    services.metricsRepository.increment(day, 'paid');
  }
  if (services.paymentRecorder) {
    const pinRequestId = c.get('pinRequestIdForReporting') as string | undefined;
    services.paymentRecorder.record(paymentResult, {
      requestId,
      pinRequestId,
    });
  }
}

logger.info({
  requestId,
  method: c.req.method,
  path: requestPath,
  status,
  durationMs: Date.now() - requestStartedAt,
  walletAddress: identity.wallet,
}, 'request handled');
```

The `pinRequestIdForReporting` Hono context key is set by handlers that create a pin (Task 13). Optional — if absent the recorder writes `null`.

- [ ] **Step 3: In the `catch (error)` branch, also increment `total` and `rejected_402` if status was 402**

Same pattern as above — the existing branch already computes `statusFromError(error)`. Mirror the increment logic.

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: existing tests still pass; new behavior is opt-in via `services.metricsRepository` / `services.paymentRecorder` (both unset in current tests).

- [ ] **Step 5: Commit**

```bash
git add src/app.ts
git commit -m "feat(app): wire payment recorder + request counters into middleware"
```

---

## Task 13: Set `pinRequestIdForReporting` in pin handlers

**Files:**
- Modify: `src/app.ts`

- [ ] **Step 1: Find pin-creation handlers**

Search `app.ts` for `POST /pins` and `POST /upload` handler bodies. After the pin record is created and we have a `requestid`, add:

```typescript
c.set('pinRequestIdForReporting', pin.requestid);
```

This is a Hono context variable consumed by the request middleware in Task 12. It links the payment row to the pin row.

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: PASS (the new `c.set` is read-only; nothing in tests asserts against it yet).

- [ ] **Step 3: Commit**

```bash
git add src/app.ts
git commit -m "feat(app): expose pin requestId to reporting middleware"
```

---

## Task 14: Digest builder

**Files:**
- Create: `src/services/reporting/digest-builder.ts`
- Test: `tests/unit/digest-builder.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/digest-builder.test.ts`:

```typescript
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db';
import { PaymentRepository } from '../../src/repositories/payment-repository';
import { MetricsRepository } from '../../src/repositories/metrics-repository';
import { PinRepository } from '../../src/repositories/pin-repository';
import { DigestBuilder } from '../../src/services/reporting/digest-builder';

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

  it('returns a Report with all sections populated', () => {
    payments.insert({
      id: 'p1', occurred_at: '2026-04-21T10:00:00.000Z',
      protocol: 'x402', chain_id: 167000, payer_wallet: '0xaaa',
      asset_address: '0xusdc', asset_decimals: 6,
      amount_atomic: '1000000', amount_usd: 1.0,
      endpoint: 'pin', request_id: null, tx_hash: null, pin_request_id: null,
    });
    metrics.increment('2026-04-21', 'total');
    metrics.increment('2026-04-21', 'paid');
    pins.create({
      requestid: 'r1', cid: 'b1', name: null, status: 'pinned',
      origins: [], meta: {}, delegates: [], info: {},
      owner: '0xaaa', created: '2026-04-21T09:00:00.000Z',
      updated: '2026-04-21T09:00:00.000Z', expires_at: null, size_bytes: 1024,
    });

    const report = builder.build({
      window: { start: '2026-04-20T00:00:00.000Z', end: '2026-04-22T00:00:00.000Z' },
      now: '2026-04-22T00:00:00.000Z',
      generatedAt: '2026-04-22T00:00:00.000Z',
    });

    expect(report.window).toEqual({ start: '2026-04-20T00:00:00.000Z', end: '2026-04-22T00:00:00.000Z' });
    expect(report.revenue.totalUsd).toBe(1.0);
    expect(report.revenue.byProtocol.x402.totalUsd).toBe(1.0);
    expect(report.pins.newInWindow.count).toBe(1);
    expect(report.pins.newInWindow.totalBytes).toBe(1024);
    expect(report.requests.total).toBe(1);
    expect(report.requests.paid).toBe(1);
    expect(report.wallets.firstTimePayersInWindow).toEqual(['0xaaa']);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm test tests/unit/digest-builder.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/services/reporting/digest-builder.ts`:

```typescript
import type { PaymentRepository } from '../../repositories/payment-repository';
import type { MetricsRepository } from '../../repositories/metrics-repository';
import type { PinRepository } from '../../repositories/pin-repository';
import type { Report, ReportWindow } from './types';

export interface DigestBuilderDeps {
  payments: PaymentRepository;
  metrics: MetricsRepository;
  pins: PinRepository;
}

export interface DigestBuildInput {
  window: ReportWindow;
  now: string;
  generatedAt: string;
}

export class DigestBuilder {
  constructor(private readonly deps: DigestBuilderDeps) {}

  build(input: DigestBuildInput): Report {
    const { payments, metrics, pins } = this.deps;
    const { window, now, generatedAt } = input;

    const paymentSummary = payments.summarizeWindow(window);
    const firstTimePayers = payments.firstTimePayers(window);
    const cumulativePayers = payments.cumulativeUniquePayers();
    const pinSummary = pins.summarize({ start: window.start, end: window.end, now });
    const metricsSummary = metrics.summarizeWindow({
      startDay: window.start.slice(0, 10),
      endDayExclusive: window.end.slice(0, 10),
    });

    return {
      window,
      generatedAt,
      revenue: {
        totalUsd: paymentSummary.totalUsd,
        byProtocol: paymentSummary.byProtocol,
      },
      pins: {
        newInWindow: pinSummary.newPinsInWindow,
        active: pinSummary.activePins,
      },
      wallets: {
        payersInWindow: paymentSummary.uniquePayers,
        cumulativePayers,
        firstTimePayersInWindow: firstTimePayers,
      },
      requests: metricsSummary,
    };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/unit/digest-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/reporting/digest-builder.ts tests/unit/digest-builder.test.ts
git commit -m "feat(reporting): pure DigestBuilder aggregates window into Report"
```

---

## Task 15: Slack publisher

**Files:**
- Create: `src/services/reporting/slack-publisher.ts`
- Test: `tests/unit/slack-publisher.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/slack-publisher.test.ts`:

```typescript
import { describe, expect, it, vi, afterEach } from 'vitest';
import { SlackPublisher } from '../../src/services/reporting/slack-publisher';
import type { Report } from '../../src/services/reporting/types';

const sampleReport: Report = {
  window: { start: '2026-04-20T00:00:00.000Z', end: '2026-04-22T00:00:00.000Z' },
  generatedAt: '2026-04-22T00:00:00.000Z',
  revenue: { totalUsd: 12.34, byProtocol: { x402: { totalUsd: 10, count: 5 }, mpp: { totalUsd: 2.34, count: 1 } } },
  pins: { newInWindow: { count: 3, totalBytes: 5_000_000 }, active: { count: 100, totalBytes: 1_000_000_000 } },
  wallets: { payersInWindow: 4, cumulativePayers: 27, firstTimePayersInWindow: ['0xnew'] },
  requests: { total: 200, paid: 6, rejected_402: 4 },
};

describe('SlackPublisher', () => {
  afterEach(() => vi.restoreAllMocks());

  it('post() POSTs Block Kit JSON to the webhook URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    const logger = { warn: vi.fn(), error: vi.fn() };
    const publisher = new SlackPublisher({ webhookUrl: 'https://hooks.slack.com/x', logger: logger as any });

    await publisher.post(sampleReport);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://hooks.slack.com/x');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.blocks).toBeInstanceOf(Array);
    expect(body.blocks.length).toBeGreaterThan(0);
  });

  it('formatInline() returns a Slack response shape', () => {
    const publisher = new SlackPublisher({ webhookUrl: 'https://hooks.slack.com/x', logger: console });
    const inline = publisher.formatInline(sampleReport);
    expect(inline.response_type).toBe('ephemeral');
    expect(inline.blocks).toBeInstanceOf(Array);
  });

  it('post() warns and does not throw on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));
    const logger = { warn: vi.fn(), error: vi.fn() };
    const publisher = new SlackPublisher({ webhookUrl: 'https://hooks.slack.com/x', logger: logger as any });

    await expect(publisher.post(sampleReport)).resolves.not.toThrow();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('post() warns on non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('rate limited', { status: 429 }));
    const logger = { warn: vi.fn(), error: vi.fn() };
    const publisher = new SlackPublisher({ webhookUrl: 'https://hooks.slack.com/x', logger: logger as any });
    await publisher.post(sampleReport);
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm test tests/unit/slack-publisher.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/services/reporting/slack-publisher.ts`:

```typescript
import type { Logger } from 'pino';
import type { Report } from './types';

export interface SlackPublisherConfig {
  webhookUrl: string;
  logger: Pick<Logger, 'warn' | 'error'>;
}

export interface SlackInlineResponse {
  response_type: 'ephemeral' | 'in_channel';
  blocks: unknown[];
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function buildBlocks(report: Report): unknown[] {
  const r = report;
  const dateRange = `${r.window.start.slice(0, 10)} → ${r.window.end.slice(0, 10)}`;
  const newPayers = r.wallets.firstTimePayersInWindow.length;
  return [
    { type: 'header', text: { type: 'plain_text', text: `Tack — ${dateRange}` } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Revenue*\n$${r.revenue.totalUsd.toFixed(2)} USD` },
        { type: 'mrkdwn', text: `*Paying wallets*\n${r.wallets.payersInWindow} (${r.wallets.cumulativePayers} all-time)` },
        { type: 'mrkdwn', text: `*x402 / Taiko*\n$${r.revenue.byProtocol.x402.totalUsd.toFixed(2)} (${r.revenue.byProtocol.x402.count})` },
        { type: 'mrkdwn', text: `*MPP / Tempo*\n$${r.revenue.byProtocol.mpp.totalUsd.toFixed(2)} (${r.revenue.byProtocol.mpp.count})` },
        { type: 'mrkdwn', text: `*New pins*\n${r.pins.newInWindow.count} • ${formatBytes(r.pins.newInWindow.totalBytes)}` },
        { type: 'mrkdwn', text: `*Active pins*\n${r.pins.active.count} • ${formatBytes(r.pins.active.totalBytes)}` },
        { type: 'mrkdwn', text: `*Requests*\n${r.requests.total} total / ${r.requests.paid} paid / ${r.requests.rejected_402} 402s` },
        { type: 'mrkdwn', text: `*New payers*\n${newPayers}` },
      ],
    },
  ];
}

export class SlackPublisher {
  constructor(private readonly config: SlackPublisherConfig) {}

  async post(report: Report): Promise<void> {
    const body = JSON.stringify({ blocks: buildBlocks(report) });
    try {
      const res = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) {
        this.config.logger.warn({ status: res.status }, 'slack webhook returned non-2xx');
      }
    } catch (err) {
      this.config.logger.warn({ err }, 'slack webhook POST failed');
    }
  }

  formatInline(report: Report): SlackInlineResponse {
    return { response_type: 'ephemeral', blocks: buildBlocks(report) };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/unit/slack-publisher.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/reporting/slack-publisher.ts tests/unit/slack-publisher.test.ts
git commit -m "feat(reporting): SlackPublisher posts digest + formats slash replies"
```

---

## Task 16: Slack slash-command handler

**Files:**
- Create: `src/services/reporting/slack-slash-handler.ts`
- Test: `tests/unit/slack-slash-handler.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/slack-slash-handler.test.ts`:

```typescript
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSlackSlashHandler } from '../../src/services/reporting/slack-slash-handler';
import type { Report } from '../../src/services/reporting/types';

const SECRET = 'test-signing-secret-32bytes-min!!';

function signedRequest(body: string, ts = String(Math.floor(Date.now() / 1000))): Request {
  const baseString = `v0:${ts}:${body}`;
  const sig = `v0=${createHmac('sha256', SECRET).update(baseString).digest('hex')}`;
  return new Request('http://test/slack/commands/stats', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Slack-Request-Timestamp': ts,
      'X-Slack-Signature': sig,
    },
    body,
  });
}

describe('createSlackSlashHandler', () => {
  let mockReport: Report;
  let builder: { build: ReturnType<typeof vi.fn> };
  let publisher: { formatInline: ReturnType<typeof vi.fn> };
  let now: () => Date;

  beforeEach(() => {
    mockReport = { /* minimal stub */ } as Report;
    builder = { build: vi.fn().mockReturnValue(mockReport) };
    publisher = { formatInline: vi.fn().mockReturnValue({ response_type: 'ephemeral', blocks: [] }) };
    now = () => new Date('2026-04-22T12:00:00.000Z');
  });

  it('rejects requests with missing signature with 401', async () => {
    const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as any, publisher: publisher as any, now });
    const req = new Request('http://test/slack/commands/stats', { method: 'POST', body: 'text=week' });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('rejects requests with stale timestamp (>5 min) with 401', async () => {
    const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as any, publisher: publisher as any, now });
    const stale = String(Math.floor(Date.now() / 1000) - 600);
    const res = await handler(signedRequest('text=week', stale));
    expect(res.status).toBe(401);
  });

  it('rejects requests with bad signature with 401', async () => {
    const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as any, publisher: publisher as any, now });
    const ts = String(Math.floor(Date.now() / 1000));
    const req = new Request('http://test/slack/commands/stats', {
      method: 'POST',
      headers: {
        'X-Slack-Request-Timestamp': ts,
        'X-Slack-Signature': 'v0=deadbeef',
      },
      body: 'text=week',
    });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('parses "week" as last 7 days and returns formatted reply', async () => {
    const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as any, publisher: publisher as any, now });
    const res = await handler(signedRequest('text=week'));
    expect(res.status).toBe(200);
    expect(builder.build).toHaveBeenCalledOnce();
    const arg = builder.build.mock.calls[0][0];
    expect(new Date(arg.window.end).toISOString()).toBe('2026-04-22T12:00:00.000Z');
    expect(new Date(arg.window.start).toISOString()).toBe('2026-04-15T12:00:00.000Z');
    expect(publisher.formatInline).toHaveBeenCalledWith(mockReport);
  });

  it('parses "today" as since UTC midnight', async () => {
    const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as any, publisher: publisher as any, now });
    await handler(signedRequest('text=today'));
    const arg = builder.build.mock.calls[0][0];
    expect(arg.window.start).toBe('2026-04-22T00:00:00.000Z');
  });

  it('parses "month" as last 30 days', async () => {
    const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as any, publisher: publisher as any, now });
    await handler(signedRequest('text=month'));
    const arg = builder.build.mock.calls[0][0];
    expect(new Date(arg.window.start).toISOString()).toBe('2026-03-23T12:00:00.000Z');
  });

  it('defaults empty text to last 7 days', async () => {
    const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as any, publisher: publisher as any, now });
    await handler(signedRequest('text='));
    const arg = builder.build.mock.calls[0][0];
    expect(new Date(arg.window.start).toISOString()).toBe('2026-04-15T12:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm test tests/unit/slack-slash-handler.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/services/reporting/slack-slash-handler.ts`:

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DigestBuilder } from './digest-builder';
import type { SlackPublisher } from './slack-publisher';
import type { ReportWindow } from './types';

export interface SlackSlashHandlerConfig {
  signingSecret: string;
  builder: DigestBuilder;
  publisher: SlackPublisher;
  now?: () => Date;
}

const FIVE_MIN = 5 * 60;

function verifySignature(secret: string, body: string, ts: string, sig: string): boolean {
  const baseString = `v0:${ts}:${body}`;
  const expected = `v0=${createHmac('sha256', secret).update(baseString).digest('hex')}`;
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

function resolveWindow(text: string, now: Date): ReportWindow {
  const end = now.toISOString();
  const ms = 1000 * 60 * 60 * 24;
  switch (text.trim().toLowerCase()) {
    case 'today': {
      const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      return { start: startOfDay.toISOString(), end };
    }
    case 'month':
      return { start: new Date(now.getTime() - 30 * ms).toISOString(), end };
    case 'wtd': {
      // ISO weeks start Monday
      const day = now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1;
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
      return { start: start.toISOString(), end };
    }
    case '':
    case 'week':
    default:
      return { start: new Date(now.getTime() - 7 * ms).toISOString(), end };
  }
}

export function createSlackSlashHandler(config: SlackSlashHandlerConfig): (req: Request) => Promise<Response> {
  const { signingSecret, builder, publisher } = config;
  const now = config.now ?? (() => new Date());

  return async (req: Request): Promise<Response> => {
    const ts = req.headers.get('x-slack-request-timestamp');
    const sig = req.headers.get('x-slack-signature');
    if (!ts || !sig) {
      return new Response('unauthorized', { status: 401 });
    }
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum) || Math.abs(Math.floor(now().getTime() / 1000) - tsNum) > FIVE_MIN) {
      return new Response('unauthorized', { status: 401 });
    }
    const body = await req.text();
    if (!verifySignature(signingSecret, body, ts, sig)) {
      return new Response('unauthorized', { status: 401 });
    }

    const params = new URLSearchParams(body);
    const text = params.get('text') ?? '';

    const today = now();
    const window = resolveWindow(text, today);
    const report = builder.build({
      window,
      now: today.toISOString(),
      generatedAt: today.toISOString(),
    });
    const inline = publisher.formatInline(report);

    return new Response(JSON.stringify(inline), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/unit/slack-slash-handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/reporting/slack-slash-handler.ts tests/unit/slack-slash-handler.test.ts
git commit -m "feat(reporting): Slack slash command handler with HMAC verification"
```

---

## Task 17: Notion publisher

**Files:**
- Create: `src/services/reporting/notion-publisher.ts`
- Test: `tests/unit/notion-publisher.test.ts`

The Notion DB schema (configured in Notion UI) needs these properties — document in `.env.example` (Task 19):
- `Week` (Title) — ISO week, e.g., `2026-W17`
- `Window Start` (Date)
- `Window End` (Date)
- `Revenue USD` (Number)
- `x402 USD` (Number)
- `MPP USD` (Number)
- `New Pins` (Number)
- `New Bytes` (Number)
- `Active Pins` (Number)
- `Active Bytes` (Number)
- `Paying Wallets` (Number)
- `Cumulative Wallets` (Number)
- `New Payers` (Number)
- `Total Requests` (Number)
- `Paid Requests` (Number)
- `402s` (Number)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/notion-publisher.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { NotionPublisher, isoWeekKey } from '../../src/services/reporting/notion-publisher';
import type { Report } from '../../src/services/reporting/types';

const sample: Report = {
  window: { start: '2026-04-20T00:00:00.000Z', end: '2026-04-27T00:00:00.000Z' },
  generatedAt: '2026-04-27T00:00:00.000Z',
  revenue: { totalUsd: 12.34, byProtocol: { x402: { totalUsd: 10, count: 5 }, mpp: { totalUsd: 2.34, count: 1 } } },
  pins: { newInWindow: { count: 3, totalBytes: 500_000 }, active: { count: 10, totalBytes: 1_000_000 } },
  wallets: { payersInWindow: 4, cumulativePayers: 27, firstTimePayersInWindow: ['0xnew'] },
  requests: { total: 100, paid: 6, rejected_402: 4 },
};

describe('isoWeekKey', () => {
  it('formats ISO week from a date', () => {
    expect(isoWeekKey(new Date('2026-04-20T00:00:00.000Z'))).toBe('2026-W17');
  });
});

describe('NotionPublisher', () => {
  function makeClient() {
    return {
      databases: { query: vi.fn().mockResolvedValue({ results: [] }) },
      pages: { create: vi.fn().mockResolvedValue({ id: 'page' }) },
    };
  }

  it('appends a page when no row exists for the week', async () => {
    const client = makeClient();
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'db', logger: logger as any });

    await pub.append(sample);

    expect(client.databases.query).toHaveBeenCalledOnce();
    expect(client.pages.create).toHaveBeenCalledOnce();
    const arg = client.pages.create.mock.calls[0][0];
    expect(arg.parent.database_id).toBe('db');
    expect(arg.properties.Week.title[0].text.content).toBe('2026-W17');
    expect(arg.properties['Revenue USD'].number).toBe(12.34);
  });

  it('skips when a row already exists for the week', async () => {
    const client = makeClient();
    client.databases.query.mockResolvedValueOnce({ results: [{ id: 'existing' }] });
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'db', logger: logger as any });

    await pub.append(sample);

    expect(client.pages.create).not.toHaveBeenCalled();
  });

  it('warns and does not throw on Notion error', async () => {
    const client = makeClient();
    client.databases.query.mockRejectedValue(new Error('boom'));
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'db', logger: logger as any });

    await expect(pub.append(sample)).resolves.not.toThrow();
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm test tests/unit/notion-publisher.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/services/reporting/notion-publisher.ts`:

```typescript
import type { Logger } from 'pino';
import type { Report } from './types';

export interface NotionClientLike {
  databases: { query: (args: any) => Promise<any> };
  pages: { create: (args: any) => Promise<any> };
}

export interface NotionPublisherConfig {
  client: NotionClientLike;
  databaseId: string;
  logger: Pick<Logger, 'warn' | 'error'>;
}

export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function buildProperties(report: Report) {
  const weekKey = isoWeekKey(new Date(report.window.start));
  return {
    Week: { title: [{ text: { content: weekKey } }] },
    'Window Start': { date: { start: report.window.start } },
    'Window End': { date: { start: report.window.end } },
    'Revenue USD': { number: report.revenue.totalUsd },
    'x402 USD': { number: report.revenue.byProtocol.x402.totalUsd },
    'MPP USD': { number: report.revenue.byProtocol.mpp.totalUsd },
    'New Pins': { number: report.pins.newInWindow.count },
    'New Bytes': { number: report.pins.newInWindow.totalBytes },
    'Active Pins': { number: report.pins.active.count },
    'Active Bytes': { number: report.pins.active.totalBytes },
    'Paying Wallets': { number: report.wallets.payersInWindow },
    'Cumulative Wallets': { number: report.wallets.cumulativePayers },
    'New Payers': { number: report.wallets.firstTimePayersInWindow.length },
    'Total Requests': { number: report.requests.total },
    'Paid Requests': { number: report.requests.paid },
    '402s': { number: report.requests.rejected_402 },
  };
}

export class NotionPublisher {
  constructor(private readonly config: NotionPublisherConfig) {}

  async append(report: Report): Promise<void> {
    const weekKey = isoWeekKey(new Date(report.window.start));
    try {
      const existing = await this.config.client.databases.query({
        database_id: this.config.databaseId,
        filter: { property: 'Week', title: { equals: weekKey } },
        page_size: 1,
      });

      if (existing.results.length > 0) {
        return;
      }

      await this.config.client.pages.create({
        parent: { database_id: this.config.databaseId },
        properties: buildProperties(report),
      });
    } catch (err) {
      this.config.logger.warn({ err, weekKey }, 'notion append failed');
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/unit/notion-publisher.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/reporting/notion-publisher.ts tests/unit/notion-publisher.test.ts
git commit -m "feat(reporting): NotionPublisher appends weekly row with idempotency"
```

---

## Task 18: Weekly digest job

**Files:**
- Create: `src/services/reporting/weekly-digest-job.ts`
- Test: `tests/unit/weekly-digest-job.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/weekly-digest-job.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { runWeeklyDigest } from '../../src/services/reporting/weekly-digest-job';
import type { Report } from '../../src/services/reporting/types';

const fakeReport = {} as Report;

describe('runWeeklyDigest', () => {
  it('builds the report and publishes to both Slack and Notion', async () => {
    const builder = { build: vi.fn().mockReturnValue(fakeReport) };
    const slack = { post: vi.fn().mockResolvedValue(undefined) };
    const notion = { append: vi.fn().mockResolvedValue(undefined) };
    const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };

    await runWeeklyDigest({
      builder: builder as any,
      slack: slack as any,
      notion: notion as any,
      logger: logger as any,
      now: () => new Date('2026-04-27T09:00:00.000Z'),
    });

    expect(builder.build).toHaveBeenCalledOnce();
    const arg = builder.build.mock.calls[0][0];
    // last 7 days
    expect(new Date(arg.window.start).toISOString()).toBe('2026-04-20T09:00:00.000Z');
    expect(new Date(arg.window.end).toISOString()).toBe('2026-04-27T09:00:00.000Z');

    expect(slack.post).toHaveBeenCalledWith(fakeReport);
    expect(notion.append).toHaveBeenCalledWith(fakeReport);
  });

  it('continues when slack throws', async () => {
    const builder = { build: vi.fn().mockReturnValue(fakeReport) };
    const slack = { post: vi.fn().mockRejectedValue(new Error('slack down')) };
    const notion = { append: vi.fn().mockResolvedValue(undefined) };
    const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };

    await expect(runWeeklyDigest({
      builder: builder as any, slack: slack as any, notion: notion as any,
      logger: logger as any, now: () => new Date(),
    })).resolves.not.toThrow();

    expect(notion.append).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm test tests/unit/weekly-digest-job.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/services/reporting/weekly-digest-job.ts`:

```typescript
import type { Logger } from 'pino';
import cron from 'node-cron';
import type { DigestBuilder } from './digest-builder';
import type { SlackPublisher } from './slack-publisher';
import type { NotionPublisher } from './notion-publisher';

export interface WeeklyDigestDeps {
  builder: DigestBuilder;
  slack: SlackPublisher;
  notion: NotionPublisher;
  logger: Pick<Logger, 'info' | 'warn' | 'error'>;
  now?: () => Date;
}

export async function runWeeklyDigest(deps: WeeklyDigestDeps): Promise<void> {
  const { builder, slack, notion, logger } = deps;
  const now = (deps.now ?? (() => new Date()))();

  const ms = 1000 * 60 * 60 * 24;
  const window = {
    start: new Date(now.getTime() - 7 * ms).toISOString(),
    end: now.toISOString(),
  };

  logger.info({ window }, 'weekly digest: building report');

  const report = builder.build({
    window,
    now: now.toISOString(),
    generatedAt: now.toISOString(),
  });

  await Promise.allSettled([
    slack.post(report).catch((err) => logger.warn({ err }, 'weekly digest: slack post failed')),
    notion.append(report).catch((err) => logger.warn({ err }, 'weekly digest: notion append failed')),
  ]);

  logger.info('weekly digest: complete');
}

export interface ScheduleWeeklyDigestOptions extends WeeklyDigestDeps {
  cronExpression: string;
}

export function scheduleWeeklyDigest(opts: ScheduleWeeklyDigestOptions): { stop: () => void } {
  const task = cron.schedule(opts.cronExpression, () => {
    runWeeklyDigest(opts).catch((err) => opts.logger.error({ err }, 'weekly digest: unexpected error'));
  }, { timezone: 'UTC' });

  return {
    stop: () => task.stop(),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/unit/weekly-digest-job.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/reporting/weekly-digest-job.ts tests/unit/weekly-digest-job.test.ts
git commit -m "feat(reporting): weekly digest job + node-cron scheduler"
```

---

## Task 19: Config additions

**Files:**
- Modify: `src/config.ts`
- Modify: `.env.example`
- Test: `tests/unit/config.test.ts`

- [ ] **Step 1: Write failing tests**

In `tests/unit/config.test.ts`, add:

```typescript
describe('reporting config', () => {
  beforeEach(() => {
    // ensure required minimum env (mirror existing pattern from this file)
    process.env.WALLET_AUTH_TOKEN_SECRET = 'a'.repeat(40);
  });

  it('defaults reporting features to disabled', () => {
    delete process.env.WEEKLY_DIGEST_ENABLED;
    delete process.env.SLACK_SLASH_COMMAND_ENABLED;
    const cfg = getConfig();
    expect(cfg.weeklyDigestEnabled).toBe(false);
    expect(cfg.slackSlashCommandEnabled).toBe(false);
  });

  it('rejects WEEKLY_DIGEST_ENABLED=true without slack + notion creds', () => {
    process.env.WEEKLY_DIGEST_ENABLED = 'true';
    delete process.env.SLACK_WEBHOOK_URL;
    expect(() => getConfig()).toThrow(/SLACK_WEBHOOK_URL/);
  });

  it('rejects SLACK_SLASH_COMMAND_ENABLED=true without signing secret', () => {
    process.env.SLACK_SLASH_COMMAND_ENABLED = 'true';
    delete process.env.SLACK_SIGNING_SECRET;
    expect(() => getConfig()).toThrow(/SLACK_SIGNING_SECRET/);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test tests/unit/config.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `src/config.ts`, extend `AppConfig`:

```typescript
export interface AppConfig {
  // ... existing
  weeklyDigestEnabled: boolean;
  weeklyDigestCron: string;
  slackWebhookUrl?: string;
  slackSlashCommandEnabled: boolean;
  slackSigningSecret?: string;
  notionApiKey?: string;
  notionDatabaseId?: string;
}
```

In `getConfig()`, set the values:

```typescript
weeklyDigestEnabled: parseBoolean(process.env.WEEKLY_DIGEST_ENABLED, false),
weeklyDigestCron: process.env.WEEKLY_DIGEST_CRON ?? '0 9 * * 1',
slackWebhookUrl: process.env.SLACK_WEBHOOK_URL?.trim() || undefined,
slackSlashCommandEnabled: parseBoolean(process.env.SLACK_SLASH_COMMAND_ENABLED, false),
slackSigningSecret: process.env.SLACK_SIGNING_SECRET?.trim() || undefined,
notionApiKey: process.env.NOTION_API_KEY?.trim() || undefined,
notionDatabaseId: process.env.NOTION_DATABASE_ID?.trim() || undefined,
```

In `validateProductionConfig` (or as standalone validation just before returning the config), add:

```typescript
if (config.weeklyDigestEnabled) {
  if (!config.slackWebhookUrl) throw new Error('WEEKLY_DIGEST_ENABLED=true requires SLACK_WEBHOOK_URL');
  if (!config.notionApiKey) throw new Error('WEEKLY_DIGEST_ENABLED=true requires NOTION_API_KEY');
  if (!config.notionDatabaseId) throw new Error('WEEKLY_DIGEST_ENABLED=true requires NOTION_DATABASE_ID');
}
if (config.slackSlashCommandEnabled && !config.slackSigningSecret) {
  throw new Error('SLACK_SLASH_COMMAND_ENABLED=true requires SLACK_SIGNING_SECRET');
}
```

- [ ] **Step 4: Update `.env.example`**

Append:

```
# Reporting (Slack + Notion)
WEEKLY_DIGEST_ENABLED=false
WEEKLY_DIGEST_CRON="0 9 * * 1"
SLACK_WEBHOOK_URL=
SLACK_SLASH_COMMAND_ENABLED=false
SLACK_SIGNING_SECRET=
NOTION_API_KEY=
NOTION_DATABASE_ID=
# Notion DB columns required:
#   Week (Title), Window Start (Date), Window End (Date),
#   Revenue USD, x402 USD, MPP USD, New Pins, New Bytes,
#   Active Pins, Active Bytes, Paying Wallets, Cumulative Wallets,
#   New Payers, Total Requests, Paid Requests, 402s (all Number)
```

- [ ] **Step 5: Run tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/config.ts tests/unit/config.test.ts .env.example
git commit -m "feat(config): add reporting env vars + production validation"
```

---

## Task 20: Wire everything in `src/index.ts` and `app.ts`

**Files:**
- Modify: `src/index.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Add imports + construction in `index.ts`**

At the top of `src/index.ts` (with the other imports):

```typescript
import { Client as NotionClient } from '@notionhq/client';
import { PaymentRepository } from './repositories/payment-repository';
import { MetricsRepository } from './repositories/metrics-repository';
import { PaymentRecorder } from './services/reporting/payment-recorder';
import { DigestBuilder } from './services/reporting/digest-builder';
import { SlackPublisher } from './services/reporting/slack-publisher';
import { NotionPublisher } from './services/reporting/notion-publisher';
import { scheduleWeeklyDigest } from './services/reporting/weekly-digest-job';
import { createSlackSlashHandler } from './services/reporting/slack-slash-handler';
```

After the existing repository/service construction (find where `pinRepository` is created), add:

```typescript
const paymentRepository = new PaymentRepository(db);
const metricsRepository = new MetricsRepository(db);
const paymentRecorder = new PaymentRecorder(paymentRepository, logger);
const digestBuilder = new DigestBuilder({
  payments: paymentRepository,
  metrics: metricsRepository,
  pins: pinRepository,
});

const slackPublisher = config.slackWebhookUrl
  ? new SlackPublisher({ webhookUrl: config.slackWebhookUrl, logger })
  : null;

const notionPublisher = (config.notionApiKey && config.notionDatabaseId)
  ? new NotionPublisher({
      client: new NotionClient({ auth: config.notionApiKey }),
      databaseId: config.notionDatabaseId,
      logger,
    })
  : null;

const slackSlashHandler = (config.slackSlashCommandEnabled && config.slackSigningSecret)
  ? createSlackSlashHandler({
      signingSecret: config.slackSigningSecret,
      builder: digestBuilder,
      publisher: slackPublisher!,  // production validation guarantees both set together if digest enabled; relax here: if slash enabled but webhook unset, slash still works because formatInline is local
    })
  : null;
```

If slash is enabled but webhookUrl unset, instantiate a local-only publisher just for `formatInline`:

```typescript
const slashPublisher = slackPublisher ?? new SlackPublisher({ webhookUrl: '', logger });
```

(Then pass `slashPublisher` instead.)

- [ ] **Step 2: Pass new services into `createApp`**

Update the `services` object passed to `createApp` to include:

```typescript
paymentRecorder,
metricsRepository,
slackSlashHandler,
```

- [ ] **Step 3: Schedule the cron**

After `createApp` (or before `serve`), if both publishers exist and `config.weeklyDigestEnabled`:

```typescript
if (config.weeklyDigestEnabled && slackPublisher && notionPublisher) {
  scheduleWeeklyDigest({
    builder: digestBuilder,
    slack: slackPublisher,
    notion: notionPublisher,
    logger,
    cronExpression: config.weeklyDigestCron,
  });
  logger.info({ cron: config.weeklyDigestCron }, 'weekly digest scheduled');
}
```

- [ ] **Step 4: Register the slash route in `app.ts`**

In `createApp` services accept `slackSlashHandler`. After the existing route registrations, before the catch-all/error handlers, add:

```typescript
if (services.slackSlashHandler) {
  app.post('/slack/commands/stats', async (c) => {
    const res = await services.slackSlashHandler!(c.req.raw);
    return res;
  });
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm typecheck && pnpm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/app.ts
git commit -m "feat(reporting): wire recorder, counters, scheduler, and slash route"
```

---

## Task 21: Integration test — recording + counters

**Files:**
- Create: `tests/integration/reporting.test.ts`

- [ ] **Step 1: Write the integration test**

Create `tests/integration/reporting.test.ts`:

```typescript
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { createDb } from '../../src/db';
import { PinRepository } from '../../src/repositories/pin-repository';
import { PaymentRepository } from '../../src/repositories/payment-repository';
import { MetricsRepository } from '../../src/repositories/metrics-repository';
import { PaymentRecorder } from '../../src/services/reporting/payment-recorder';
// ... other imports modeled on tests/integration/app.test.ts

describe('reporting integration', () => {
  let db: Database.Database;
  let app: ReturnType<typeof createApp>;
  let paymentRepo: PaymentRepository;
  let metricsRepo: MetricsRepository;

  beforeEach(() => {
    db = createDb(':memory:');
    paymentRepo = new PaymentRepository(db);
    metricsRepo = new MetricsRepository(db);
    // Build app with paymentRecorder + metricsRepository wired
    // Mirror the harness in tests/integration/app.test.ts:266 — copy the
    // service-construction block and add:
    //   paymentRecorder: new PaymentRecorder(paymentRepo, logger),
    //   metricsRepository: metricsRepo,
  });

  it('records a payment row when a paid request succeeds', async () => {
    // Use the existing test harness for a paid x402 request to POST /pins.
    // After response, assert paymentRepo has 1 row with the right protocol/amount.
  });

  it('increments total + paid + rejected_402 counters appropriately', async () => {
    // Hit a free endpoint → total++
    // Hit /pins with no payment → 402, total++ + rejected_402++
    // Hit /pins with payment → 200, total++ + paid++
    const today = new Date().toISOString().slice(0, 10);
    const summary = metricsRepo.summarizeWindow({ startDay: today, endDayExclusive: '9999-12-31' });
    expect(summary.total).toBeGreaterThan(0);
  });
});
```

(Most of this leans on the existing app.test.ts harness — copy its setup blocks rather than reinvent. If the harness is intricate, refactor it into a shared `tests/integration/_helpers.ts` and import from there.)

- [ ] **Step 2: Run the test**

Run: `pnpm test tests/integration/reporting.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/reporting.test.ts
git commit -m "test(reporting): integration coverage for recording + counters"
```

---

## Task 22: End-to-end digest test

**Files:**
- Modify: `tests/integration/reporting.test.ts`

- [ ] **Step 1: Add the test**

Append to `tests/integration/reporting.test.ts`:

```typescript
it('runs an end-to-end digest and calls Slack + Notion mocks once', async () => {
  // Seed data:
  //   - Insert 2 payment rows (1 x402, 1 mpp) within the window
  //   - Insert 1 pin row with size_bytes within the window
  //   - Increment metrics buckets
  //
  // Build mocks for SlackPublisher and NotionPublisher (vi.fn for post/append).
  // Construct DigestBuilder with the real repos.
  // Call runWeeklyDigest with mocked publishers.
  //
  // Assert slack.post called once with a Report containing totalUsd === expected.
  // Assert notion.append called once with the same Report.
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm test tests/integration/reporting.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/reporting.test.ts
git commit -m "test(reporting): end-to-end weekly digest integration"
```

---

## Task 23: Documentation update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the project structure block**

In `CLAUDE.md`, under `## Project Structure`, add the new files under `src/services/reporting/` and the new repositories.

- [ ] **Step 2: Add a section under `## Non-Obvious Things`**

```markdown
- **Reporting is opt-in**: `WEEKLY_DIGEST_ENABLED` and `SLACK_SLASH_COMMAND_ENABLED` default to false. Even when off, the recorder + counters still run so payments accumulate from deploy date. Metrics start from the first deploy that includes this feature — historical payments cannot be recovered.
- **Slash command auth is Slack signing secret**: `/tack stats` works for anyone in a channel where the slash command is installed. Channel membership is the access boundary. There is no admin allowlist.
- **Notion week-key idempotency**: `NotionPublisher.append` queries by ISO week (e.g. `2026-W17`) before inserting. Re-running the digest in the same week is safe.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note reporting feature in project structure + caveats"
```

---

## Final verification

- [ ] **Run the full check suite**

Run: `pnpm check`
Expected: lint + typecheck + tests + build all pass.

- [ ] **Manual sanity checks before enabling in prod**

(These belong in the rollout PR description, not as part of the plan steps.)

1. Confirm `paymentResult` carries the new fields end-to-end through both x402 and MPP paths in a local stack (`docker compose up`).
2. Confirm `pins.size_bytes` populates for `POST /upload` flows (sample upload, query DB, check non-null).
3. Confirm `request_metrics_daily` rows accumulate as expected.
4. Provision the Notion DB with the listed columns and verify `NotionPublisher.append` writes correctly with a one-shot manual invocation against a staging DB.
5. Provision Slack webhook + signing secret, install the slash command at the workspace level (`/tack stats` → `https://tack.taiko.xyz/slack/commands/stats`).
6. Enable `SLACK_SLASH_COMMAND_ENABLED=true` first, verify response in actual Slack.
7. Enable `WEEKLY_DIGEST_ENABLED=true` last; first Monday tick may produce a partial-window row — expected, not a bug.
