/**
 * NotionPublisher — appends a row to the operator-configured Notion
 * database for the weekly digest, idempotent by ISO week key.
 *
 * Property keys (`Window Start`, `Revenue USD`, `402s`, etc.) MUST match
 * the Notion DB schema EXACTLY — case- and space-sensitive. Notion is
 * configured by the operator per .env.example (NOTION_DATABASE_ID). If
 * a column is renamed in Notion without updating this file, the API
 * returns `validation_error`, which we now log at error level (not
 * warn) so on-call sees it.
 */

import type { Logger } from 'pino';
import type { Report } from './types';

const NOTION_CONFIG_ERROR_CODES = new Set([
  'object_not_found', // wrong databaseId or DB unshared from integration
  'validation_error', // schema mismatch (missing/renamed column, wrong type)
  'unauthorized', // bad token
  'restricted_resource', // permission issue
]);

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

/**
 * Maps a Report into Notion property values. The property keys
 * (`Week`, `Window Start`, etc.) MUST match the operator-configured
 * Notion DB schema exactly. Any change here MUST also update the
 * Notion schema documentation in .env.example, otherwise operators
 * will silently get validation_error 400s on the next digest fire.
 */
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
      const code = (err as { code?: string }).code;
      const isConfigBug = typeof code === 'string' && NOTION_CONFIG_ERROR_CODES.has(code);
      const log = isConfigBug ? this.config.logger.error : this.config.logger.warn;
      log(
        { err, code, weekKey, databaseId: this.config.databaseId },
        isConfigBug ? 'notion append failed (config bug)' : 'notion append failed (transient)',
      );
    }
  }
}
