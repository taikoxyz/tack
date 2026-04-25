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
