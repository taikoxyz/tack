import type Database from 'better-sqlite3';

export type MetricsBucket = 'total' | 'paid' | 'rejected_402';

export interface MetricsWindow {
  startDay: string;          // 'YYYY-MM-DD' inclusive
  endDayExclusive: string;   // 'YYYY-MM-DD' exclusive
}

export interface MetricsSummary {
  total: number;
  paid: number;
  rejected_402: number;
}

export class MetricsRepository {
  constructor(private readonly db: Database.Database) {}

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
      .all(window.startDay, window.endDayExclusive) as Array<{ bucket: MetricsBucket; total: number }>;

    const summary: MetricsSummary = { total: 0, paid: 0, rejected_402: 0 };
    for (const row of rows) {
      if (row.bucket === 'total' || row.bucket === 'paid' || row.bucket === 'rejected_402') {
        summary[row.bucket] = row.total;
      }
    }
    return summary;
  }
}
