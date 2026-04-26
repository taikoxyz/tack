import type { Logger } from 'pino';
import type { Report } from './types';

export interface SlackPublisherConfig {
  /**
   * Slack incoming-webhook URL. May be empty string; in that case
   * post() info-logs and returns without firing a request — useful
   * for environments where the slash command is enabled but the
   * digest webhook isn't.
   */
  webhookUrl: string;
  logger: Pick<Logger, 'warn' | 'error' | 'info'>;
}

export interface SlackInlineResponse {
  response_type: 'ephemeral' | 'in_channel';
  blocks: unknown[];
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  return `${(n / 1024 ** 4).toFixed(2)} TB`;
}

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUsd(n: number): string {
  return usdFormatter.format(n);
}

function truncateWallet(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function buildBlocks(report: Report): unknown[] {
  const r = report;
  const dateRange = `${r.window.start.slice(0, 10)} → ${r.window.end.slice(0, 10)}`;
  const newPayers = r.wallets.firstTimePayersInWindow.length;

  // Slack section blocks accept at most 10 fields. We use 8.
  // Adding more without splitting into a second section block will
  // cause Slack to reject the message with HTTP 400.
  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: `Tack — ${dateRange}` } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Revenue*\n${formatUsd(r.revenue.totalUsd)} USD` },
        { type: 'mrkdwn', text: `*Paying wallets*\n${r.wallets.payersInWindow} (${r.wallets.cumulativePayers} all-time)` },
        { type: 'mrkdwn', text: `*x402 / Taiko*\n${formatUsd(r.revenue.byProtocol.x402.totalUsd)} (${r.revenue.byProtocol.x402.count})` },
        { type: 'mrkdwn', text: `*MPP / Tempo*\n${formatUsd(r.revenue.byProtocol.mpp.totalUsd)} (${r.revenue.byProtocol.mpp.count})` },
        { type: 'mrkdwn', text: `*New pins*\n${r.pins.newInWindow.count} • ${formatBytes(r.pins.newInWindow.totalBytes)}` },
        { type: 'mrkdwn', text: `*Active pins*\n${r.pins.active.count} • ${formatBytes(r.pins.active.totalBytes)}` },
        { type: 'mrkdwn', text: `*Requests*\n${r.requests.total} total / ${r.requests.paid} paid / ${r.requests.rejected_402} 402s` },
        { type: 'mrkdwn', text: `*New payers*\n${newPayers}` },
      ],
    },
  ];

  if (r.revenue.totalUsd === 0 && r.requests.total === 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '_No paid activity in this window. Note: payment recording started on deploy date — earlier history is not recoverable._',
        },
      ],
    });
  }

  if (newPayers > 0) {
    const shown = r.wallets.firstTimePayersInWindow.slice(0, 5).map(truncateWallet);
    const more = r.wallets.firstTimePayersInWindow.length > 5
      ? ` (+${r.wallets.firstTimePayersInWindow.length - 5} more)`
      : '';
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*New payers:* ${shown.join(', ')}${more}`,
        },
      ],
    });
  }

  return blocks;
}

export class SlackPublisher {
  constructor(private readonly config: SlackPublisherConfig) {}

  async post(report: Report): Promise<void> {
    if (!this.config.webhookUrl) {
      this.config.logger.info(
        { reportWindow: report.window },
        'slack post skipped: webhookUrl is empty'
      );
      return;
    }

    const body = JSON.stringify({ blocks: buildBlocks(report) });
    try {
      const res = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '<unreadable>');
        this.config.logger.warn(
          { status: res.status, body: text },
          'slack webhook returned non-2xx'
        );
      }
    } catch (err) {
      this.config.logger.warn({ err }, 'slack webhook POST failed');
    }
  }

  formatInline(report: Report): SlackInlineResponse {
    return { response_type: 'ephemeral', blocks: buildBlocks(report) };
  }
}
