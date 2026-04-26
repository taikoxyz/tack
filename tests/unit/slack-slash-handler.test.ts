import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSlackSlashHandler } from '../../src/services/reporting/slack-slash-handler';
import type { DigestBuilder, DigestBuildInput } from '../../src/services/reporting/digest-builder';
import type { SlackPublisher } from '../../src/services/reporting/slack-publisher';
import type { Report } from '../../src/services/reporting/types';

/** Local typed mock shape: a vi.fn with tracked calls of DigestBuildInput. */
interface BuildMock {
  (input: DigestBuildInput): Report;
  mock: { calls: [DigestBuildInput][] };
  mockReturnValue(v: Report): this;
  mockImplementation(fn: () => never): this;
}

const SECRET = 'test-signing-secret-32-bytes-min!!!!';
const FIXED_NOW = new Date('2026-04-22T12:00:00.000Z');

function signedRequest(body: string, ts?: string): Request {
  const timestamp = ts ?? String(Math.floor(FIXED_NOW.getTime() / 1000));
  const baseString = `v0:${timestamp}:${body}`;
  const sig = `v0=${createHmac('sha256', SECRET).update(baseString).digest('hex')}`;
  return new Request('http://test/slack/commands/stats', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Slack-Request-Timestamp': timestamp,
      'X-Slack-Signature': sig,
    },
    body,
  });
}

describe('createSlackSlashHandler', () => {
  let mockReport: Report;
  let builder: { build: BuildMock };
  let publisher: { formatInline: ReturnType<typeof vi.fn> };
  let now: () => Date;

  beforeEach(() => {
    mockReport = { window: { start: '', end: '' } } as unknown as Report;
    builder = { build: vi.fn().mockReturnValue(mockReport) as unknown as BuildMock };
    publisher = { formatInline: vi.fn().mockReturnValue({ response_type: 'ephemeral', blocks: [] }) };
    now = () => FIXED_NOW;
  });

  describe('signature verification', () => {
    it('rejects requests with missing signature with 401', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      const req = new Request('http://test/slack/commands/stats', { method: 'POST', body: 'text=week' });
      const res = await handler(req);
      expect(res.status).toBe(401);
    });

    it('rejects requests with stale timestamp (>5 min) with 401', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      const stale = String(Math.floor(FIXED_NOW.getTime() / 1000) - 600);
      const res = await handler(signedRequest('text=week', stale));
      expect(res.status).toBe(401);
    });

    it('rejects requests with bad signature with 401', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      const ts = String(Math.floor(FIXED_NOW.getTime() / 1000));
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
  });

  describe('window parsing', () => {
    it('parses "week" as last 7 days, midnight-aligned', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      const res = await handler(signedRequest('text=week'));
      expect(res.status).toBe(200);
      expect(builder.build).toHaveBeenCalledOnce();
      const arg = builder.build.mock.calls[0][0];
      // FIXED_NOW = 2026-04-22T12:00:00Z; today_midnight = 2026-04-22T00:00:00Z
      expect(arg.window.end).toBe('2026-04-22T00:00:00.000Z');
      expect(arg.window.start).toBe('2026-04-15T00:00:00.000Z');
    });

    it('parses "today" as today_midnight to tomorrow_midnight UTC', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      await handler(signedRequest('text=today'));
      const arg = builder.build.mock.calls[0][0];
      expect(arg.window.start).toBe('2026-04-22T00:00:00.000Z');
      expect(arg.window.end).toBe('2026-04-23T00:00:00.000Z');
    });

    it('parses "month" as last 30 days, midnight-aligned', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      await handler(signedRequest('text=month'));
      const arg = builder.build.mock.calls[0][0];
      expect(arg.window.end).toBe('2026-04-22T00:00:00.000Z');
      expect(arg.window.start).toBe('2026-03-23T00:00:00.000Z');
    });

    it('parses "wtd" as current ISO Monday midnight UTC to today midnight', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      // 2026-04-22 is a Wednesday. ISO Monday of that week is 2026-04-20.
      await handler(signedRequest('text=wtd'));
      const arg = builder.build.mock.calls[0][0];
      expect(arg.window.start).toBe('2026-04-20T00:00:00.000Z');
      expect(arg.window.end).toBe('2026-04-22T00:00:00.000Z');
    });

    it('defaults empty text to last 7 days', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      await handler(signedRequest('text='));
      const arg = builder.build.mock.calls[0][0];
      expect(arg.window.start).toBe('2026-04-15T00:00:00.000Z');
    });

    it('returns 200 with friendly error for unknown text', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      const res = await handler(signedRequest('text=banana'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { response_type: string; text: string };
      expect(body.response_type).toBe('ephemeral');
      expect(body.text).toMatch(/banana|unknown|valid/i);
      expect(builder.build).not.toHaveBeenCalled();
    });
  });

  describe('builder + publisher integration', () => {
    it('passes the report through formatInline and returns the result as JSON', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      publisher.formatInline.mockReturnValue({ response_type: 'ephemeral', blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'TEST_BLOCK' } }] });

      const res = await handler(signedRequest('text=week'));

      expect(res.status).toBe(200);
      const body = (await res.json()) as { blocks: Array<{ text: { text: string } }> };
      expect(body.blocks[0]?.text.text).toBe('TEST_BLOCK');
      expect(publisher.formatInline).toHaveBeenCalledWith(mockReport);
    });

    it('returns 200 with friendly error if builder throws', async () => {
      builder.build.mockImplementation(() => { throw new Error('disk full'); });
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      const res = await handler(signedRequest('text=week'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { response_type: string; text: string };
      expect(body.response_type).toBe('ephemeral');
      expect(body.text).toMatch(/temporarily|unavailable|error/i);
    });
  });

  describe('body size cap', () => {
    it('rejects bodies larger than 64KB with 413 (before signature check)', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      const ts = String(Math.floor(FIXED_NOW.getTime() / 1000));
      const req = new Request('http://test/slack/commands/stats', {
        method: 'POST',
        headers: {
          'X-Slack-Request-Timestamp': ts,
          'X-Slack-Signature': 'v0=fake',
          'content-length': String(100 * 1024),  // 100KB declared
        },
        body: 'text=week',  // actual small body — content-length is what we check
      });
      const res = await handler(req);
      expect(res.status).toBe(413);
    });
  });

  describe('timestamp validation', () => {
    it('rejects future-timestamps more than 5 min ahead with 401', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      const future = String(Math.floor(FIXED_NOW.getTime() / 1000) + 600);
      const res = await handler(signedRequest('text=week', future));
      expect(res.status).toBe(401);
    });
  });

  describe('wtd edge cases', () => {
    it('parses "wtd" on Sunday as 6 days back to today midnight', async () => {
      // 2026-04-26 is a Sunday
      const sunday = new Date('2026-04-26T12:00:00.000Z');
      const handler = createSlackSlashHandler({
        signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher,
        now: () => sunday,
      });

      const sundayTs = String(Math.floor(sunday.getTime() / 1000));
      const body = 'text=wtd';
      const baseString = `v0:${sundayTs}:${body}`;
      const sig = `v0=${createHmac('sha256', SECRET).update(baseString).digest('hex')}`;
      const req = new Request('http://test/slack/commands/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Slack-Request-Timestamp': sundayTs,
          'X-Slack-Signature': sig,
        },
        body,
      });

      await handler(req);
      const arg = builder.build.mock.calls[0][0];
      expect(arg.window.start).toBe('2026-04-20T00:00:00.000Z');  // Mon 6 days back
      expect(arg.window.end).toBe('2026-04-26T00:00:00.000Z');
    });

    it('parses "wtd" on Monday as today midnight to today midnight (single-day window)', async () => {
      const monday = new Date('2026-04-20T12:00:00.000Z');  // confirmed Monday
      const handler = createSlackSlashHandler({
        signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher,
        now: () => monday,
      });

      const mondayTs = String(Math.floor(monday.getTime() / 1000));
      const body = 'text=wtd';
      const baseString = `v0:${mondayTs}:${body}`;
      const sig = `v0=${createHmac('sha256', SECRET).update(baseString).digest('hex')}`;
      const req = new Request('http://test/slack/commands/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Slack-Request-Timestamp': mondayTs,
          'X-Slack-Signature': sig,
        },
        body,
      });

      await handler(req);
      const arg = builder.build.mock.calls[0][0];
      expect(arg.window.start).toBe('2026-04-20T00:00:00.000Z');
      expect(arg.window.end).toBe('2026-04-20T00:00:00.000Z');
    });
  });

  describe('help and missing text', () => {
    it('handles "help" with the same message as an unknown arg', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      const res = await handler(signedRequest('text=help'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { response_type: string; text: string };
      expect(body.text).toMatch(/week|today|month|wtd/);
      expect(builder.build).not.toHaveBeenCalled();
    });

    it('handles missing text field by defaulting to week', async () => {
      const handler = createSlackSlashHandler({ signingSecret: SECRET, builder: builder as unknown as DigestBuilder, publisher: publisher as unknown as SlackPublisher, now });
      await handler(signedRequest('command=/tack-stats'));  // no text param
      const arg = builder.build.mock.calls[0][0];
      expect(arg.window.start).toBe('2026-04-15T00:00:00.000Z');
    });
  });
});
