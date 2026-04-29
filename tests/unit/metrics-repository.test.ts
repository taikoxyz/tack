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

  it('summarizes an empty window as all zeros', () => {
    const summary = repo.summarizeWindow({
      startDay: '2026-04-20',
      endDayExclusive: '2026-04-21',
    });
    expect(summary).toEqual({ total: 0, paid: 0, rejected_402: 0 });
  });

  it('window boundaries are half-open: startDay inclusive', () => {
    repo.increment('2026-04-21', 'total');
    const summary = repo.summarizeWindow({
      startDay: '2026-04-21',
      endDayExclusive: '2026-04-22',
    });
    expect(summary.total).toBe(1);
  });

  it('window boundaries are half-open: endDayExclusive excluded', () => {
    repo.increment('2026-04-21', 'total');
    const summary = repo.summarizeWindow({
      startDay: '2026-04-20',
      endDayExclusive: '2026-04-21',
    });
    expect(summary.total).toBe(0);
  });

  it('ignores unknown bucket labels in summarizeWindow', () => {
    // Bypass the typed API to seed a stray bucket value
    db.prepare(
      `INSERT INTO request_metrics_daily (day, bucket, count) VALUES (?, ?, ?)`
    ).run('2026-04-21', 'unknown_label', 99);
    repo.increment('2026-04-21', 'total');

    const summary = repo.summarizeWindow({
      startDay: '2026-04-21',
      endDayExclusive: '2026-04-22',
    });

    expect(summary).toEqual({ total: 1, paid: 0, rejected_402: 0 });
  });

  it('buckets do not collide on the same day', () => {
    repo.increment('2026-04-21', 'total');
    repo.increment('2026-04-21', 'total');
    repo.increment('2026-04-21', 'paid');
    const summary = repo.summarizeWindow({
      startDay: '2026-04-21',
      endDayExclusive: '2026-04-22',
    });
    expect(summary).toEqual({ total: 2, paid: 1, rejected_402: 0 });
  });
});
