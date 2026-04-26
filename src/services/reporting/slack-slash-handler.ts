import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DigestBuilder } from './digest-builder';
import type { SlackPublisher } from './slack-publisher';
import type { ReportWindow } from './types';
import type { Logger } from 'pino';

export interface SlackSlashHandlerConfig {
  signingSecret: string;
  builder: DigestBuilder;
  publisher: SlackPublisher;
  /** Injected for tests. Defaults to `() => new Date()`. */
  now?: () => Date;
  /** Optional logger for builder failures. */
  logger?: Pick<Logger, 'warn' | 'error'>;
}

const FIVE_MIN_SECONDS = 5 * 60;
const MAX_BODY_BYTES = 64 * 1024;

function verifySignature(secret: string, body: string, ts: string, sig: string): boolean {
  const baseString = `v0:${ts}:${body}`;
  const expected = `v0=${createHmac('sha256', secret).update(baseString).digest('hex')}`;
  if (expected.length !== sig.length) return false;
  // Length is verified above, so timingSafeEqual cannot throw.
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(sig, 'utf8'));
}

function midnightUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function resolveWindow(text: string, now: Date): ReportWindow | null {
  const todayMidnight = midnightUtc(now);

  switch (text.trim().toLowerCase()) {
    case '':
    case 'week':
      // [today_midnight - 7d, today_midnight)
      return {
        start: addDays(todayMidnight, -7).toISOString(),
        end: todayMidnight.toISOString(),
      };
    case 'today':
      return {
        start: todayMidnight.toISOString(),
        end: addDays(todayMidnight, 1).toISOString(),
      };
    case 'month':
      return {
        start: addDays(todayMidnight, -30).toISOString(),
        end: todayMidnight.toISOString(),
      };
    case 'wtd': {
      // ISO weeks start Monday. JS getUTCDay: 0=Sun ... 6=Sat. ISO Monday offset = (day === 0 ? 6 : day - 1).
      const dayOfWeek = todayMidnight.getUTCDay();
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      return {
        start: addDays(todayMidnight, -daysSinceMonday).toISOString(),
        end: todayMidnight.toISOString(),
      };
    }
    case 'help':
      return null;  // falls through to ephemeral help message
    default:
      return null;
  }
}

function ephemeralText(text: string): Response {
  return new Response(JSON.stringify({ response_type: 'ephemeral', text }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createSlackSlashHandler(config: SlackSlashHandlerConfig): (req: Request) => Promise<Response> {
  const { signingSecret, builder, publisher, logger } = config;
  const now = config.now ?? (() => new Date());

  return async (req: Request): Promise<Response> => {
    const ts = req.headers.get('x-slack-request-timestamp');
    const sig = req.headers.get('x-slack-signature');
    if (!ts || !sig) {
      return new Response('unauthorized', { status: 401 });
    }
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum)) {
      return new Response('unauthorized', { status: 401 });
    }
    const today = now();
    const ageSeconds = Math.abs(Math.floor(today.getTime() / 1000) - tsNum);
    if (ageSeconds > FIVE_MIN_SECONDS) {
      return new Response('unauthorized', { status: 401 });
    }
    const declaredLen = Number(req.headers.get('content-length') ?? 0);
    if (Number.isFinite(declaredLen) && declaredLen > MAX_BODY_BYTES) {
      return new Response('payload too large', { status: 413 });
    }
    const body = await req.text();
    if (!verifySignature(signingSecret, body, ts, sig)) {
      return new Response('unauthorized', { status: 401 });
    }

    const params = new URLSearchParams(body);
    const text = params.get('text') ?? '';

    const window = resolveWindow(text, today);
    if (!window) {
      return ephemeralText(
        `Unknown window \`${text}\`. Valid options: \`week\`, \`today\`, \`month\`, \`wtd\` (week-to-date).`
      );
    }

    let report;
    try {
      report = builder.build({
        window,
        now: today.toISOString(),
        generatedAt: today.toISOString(),
      });
    } catch (err) {
      logger?.error({ err, window }, 'slash-command builder.build threw');
      return ephemeralText('Stats temporarily unavailable. Please try again in a few minutes.');
    }

    const inline = publisher.formatInline(report);

    return new Response(JSON.stringify(inline), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
