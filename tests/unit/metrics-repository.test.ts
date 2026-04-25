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
