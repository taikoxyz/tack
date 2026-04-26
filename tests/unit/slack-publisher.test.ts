import { describe, expect, it, vi, afterEach } from 'vitest';
import { SlackPublisher } from '../../src/services/reporting/slack-publisher';
import type { Report } from '../../src/services/reporting/types';

const sampleReport: Report = {
  window: { start: '2026-04-20T00:00:00.000Z', end: '2026-04-22T00:00:00.000Z' },
  generatedAt: '2026-04-22T00:00:00.000Z',
  revenue: {
    totalUsd: 12.34,
    byProtocol: {
      x402: { totalUsd: 10, count: 5 },
      mpp: { totalUsd: 2.34, count: 1 },
    },
  },
  pins: {
    newInWindow: { count: 3, totalBytes: 5_000_000 },
    active: { count: 100, totalBytes: 1_000_000_000 },
  },
  wallets: { payersInWindow: 4, cumulativePayers: 27, firstTimePayersInWindow: ['0xnew'] },
  requests: { total: 200, paid: 6, rejected_402: 4 },
};

describe('SlackPublisher', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('post', () => {
    it('POSTs Block Kit JSON to the webhook URL', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
      const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
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

    it('warns and does not throw on fetch failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));
      const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
      const publisher = new SlackPublisher({ webhookUrl: 'https://hooks.slack.com/x', logger: logger as any });

      await expect(publisher.post(sampleReport)).resolves.not.toThrow();
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('warns on non-2xx response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('rate limited', { status: 429 }));
      const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
      const publisher = new SlackPublisher({ webhookUrl: 'https://hooks.slack.com/x', logger: logger as any });
      await publisher.post(sampleReport);
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('logs info when called with empty webhookUrl rather than fetching', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
      const publisher = new SlackPublisher({ webhookUrl: '', logger: logger as any });
      await publisher.post(sampleReport);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledOnce();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('formatInline', () => {
    it('returns a Slack ephemeral response shape', () => {
      const publisher = new SlackPublisher({ webhookUrl: 'https://hooks.slack.com/x', logger: console as any });
      const inline = publisher.formatInline(sampleReport);
      expect(inline.response_type).toBe('ephemeral');
      expect(inline.blocks).toBeInstanceOf(Array);
      expect(inline.blocks.length).toBeGreaterThan(0);
    });

    it('post and formatInline produce identical block structure', async () => {
      const publisher = new SlackPublisher({ webhookUrl: 'https://hooks.slack.com/x', logger: console as any });
      const inline = publisher.formatInline(sampleReport);

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
      await publisher.post(sampleReport);
      const postBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);

      expect(postBody.blocks).toEqual(inline.blocks);
    });
  });

  describe('formatting', () => {
    it('formats bytes in a human-readable unit', () => {
      const publisher = new SlackPublisher({ webhookUrl: '', logger: console as any });
      const inline = publisher.formatInline(sampleReport);
      const text = JSON.stringify(inline.blocks);
      // 5_000_000 bytes ≈ 4.8 MB; 1_000_000_000 ≈ 953.7 MB
      expect(text).toMatch(/MB/);
    });

    it('shows USD with 2 decimals', () => {
      const publisher = new SlackPublisher({ webhookUrl: '', logger: console as any });
      const inline = publisher.formatInline(sampleReport);
      const text = JSON.stringify(inline.blocks);
      expect(text).toContain('$12.34');
    });

    it('formats date range as YYYY-MM-DD → YYYY-MM-DD', () => {
      const publisher = new SlackPublisher({ webhookUrl: '', logger: console as any });
      const inline = publisher.formatInline(sampleReport);
      const text = JSON.stringify(inline.blocks);
      expect(text).toContain('2026-04-20');
      expect(text).toContain('2026-04-22');
    });

    it('renders zero counts and empty firstTimePayersInWindow without crashing', () => {
      const empty: Report = {
        window: { start: '2026-04-20T00:00:00.000Z', end: '2026-04-21T00:00:00.000Z' },
        generatedAt: '2026-04-21T00:00:00.000Z',
        revenue: { totalUsd: 0, byProtocol: { x402: { totalUsd: 0, count: 0 }, mpp: { totalUsd: 0, count: 0 } } },
        pins: { newInWindow: { count: 0, totalBytes: 0 }, active: { count: 0, totalBytes: 0 } },
        wallets: { payersInWindow: 0, cumulativePayers: 0, firstTimePayersInWindow: [] },
        requests: { total: 0, paid: 0, rejected_402: 0 },
      };
      const publisher = new SlackPublisher({ webhookUrl: '', logger: console as any });
      const inline = publisher.formatInline(empty);
      expect(inline.blocks).toBeInstanceOf(Array);
      expect(inline.blocks.length).toBeGreaterThan(0);
    });

    it('renders truncated addresses for firstTimePayersInWindow', () => {
      const publisher = new SlackPublisher({ webhookUrl: '', logger: console as any });
      const report: Report = {
        ...sampleReport,
        wallets: { payersInWindow: 4, cumulativePayers: 27, firstTimePayersInWindow: ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222'] },
      };
      const inline = publisher.formatInline(report);
      const text = JSON.stringify(inline.blocks);
      expect(text).toContain('0x1111…1111');
      expect(text).toContain('0x2222…2222');
    });

    it('shows "+N more" when more than 5 first-time payers', () => {
      const publisher = new SlackPublisher({ webhookUrl: '', logger: console as any });
      const wallets = Array.from({ length: 7 }, (_, i) =>
        `0x${String(i).repeat(40).slice(0, 40)}`
      );
      const report: Report = {
        ...sampleReport,
        wallets: { payersInWindow: 7, cumulativePayers: 27, firstTimePayersInWindow: wallets },
      };
      const inline = publisher.formatInline(report);
      const text = JSON.stringify(inline.blocks);
      expect(text).toContain('+2 more');
    });

    it('omits the new-payers context block when there are zero first-time payers', () => {
      const publisher = new SlackPublisher({ webhookUrl: '', logger: console as any });
      const report: Report = {
        ...sampleReport,
        wallets: { payersInWindow: 1, cumulativePayers: 27, firstTimePayersInWindow: [] },
      };
      const inline = publisher.formatInline(report);
      const hasContext = inline.blocks.some((b: any) => b.type === 'context');
      expect(hasContext).toBe(false);
    });

    it('shows the "no activity" disclaimer when revenue and requests are both zero', () => {
      const empty: Report = {
        window: { start: '2026-04-20T00:00:00.000Z', end: '2026-04-21T00:00:00.000Z' },
        generatedAt: '2026-04-21T00:00:00.000Z',
        revenue: { totalUsd: 0, byProtocol: { x402: { totalUsd: 0, count: 0 }, mpp: { totalUsd: 0, count: 0 } } },
        pins: { newInWindow: { count: 0, totalBytes: 0 }, active: { count: 0, totalBytes: 0 } },
        wallets: { payersInWindow: 0, cumulativePayers: 0, firstTimePayersInWindow: [] },
        requests: { total: 0, paid: 0, rejected_402: 0 },
      };
      const publisher = new SlackPublisher({ webhookUrl: '', logger: console as any });
      const inline = publisher.formatInline(empty);
      const text = JSON.stringify(inline.blocks);
      expect(text).toContain('No paid activity');
    });
  });
});
