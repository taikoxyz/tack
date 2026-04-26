import type { Logger } from 'pino';
import type { Report } from './types';

/**
 * The subset of the Notion SDK we use. Tests inject a stub.
 */
export interface NotionClientLike {
  databases: { query: (args: any) => Promise<any> };
  pages: { create: (args: any) => Promise<any> };
}

export interface NotionPublisherConfig {
  client: NotionClientLike;
  databaseId: string;
  logger: Pick<Logger, 'warn' | 'error'>;
}

/**
 * Computes ISO week key (`YYYY-Www`) for a date. Algorithm: shift to
 * the Thursday of the same ISO week, then count weeks from Jan 4 of
 * that Thursday's year.
 */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO weeks: Monday=1 ... Sunday=7. Adjust JS getUTCDay (Sun=0..Sat=6).
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  // Move to the Thursday of the same ISO week.
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function buildProperties(report: Report): Record<string, unknown> {
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
