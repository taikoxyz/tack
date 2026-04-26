import type { Logger } from 'pino';
import cron from 'node-cron';
import type { DigestBuilder } from './digest-builder';
import type { SlackPublisher } from './slack-publisher';
import type { NotionPublisher } from './notion-publisher';

export interface WeeklyDigestDeps {
  builder: DigestBuilder;
  slack: SlackPublisher;
  notion: NotionPublisher;
  logger: Pick<Logger, 'info' | 'warn' | 'error'>;
  /** Injected for tests. Defaults to `() => new Date()`. */
  now?: () => Date;
}

function midnightUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Builds a Report for the last 7 days (midnight-aligned UTC) and
 * publishes it to Slack and Notion in parallel.
 *
 * Never throws. Builder failures error-log; publisher failures
 * warn-log. Each publisher runs in its own try-catch so one's
 * failure doesn't prevent the other.
 */
export async function runWeeklyDigest(deps: WeeklyDigestDeps): Promise<void> {
  const { builder, slack, notion, logger } = deps;
  const now = (deps.now ?? (() => new Date()))();

  const todayMidnight = midnightUtc(now);
  // Window is anchored to the actual fire day, not a fixed weekday.
  // If the cron misses a day (e.g. pod restart), the next fire reports
  // the trailing 7 days from that fire's midnight — not the canonical
  // Mon-to-Mon week. Notion's per-week-key idempotency still works
  // because the row's week key derives from window.start.
  const window = {
    start: addDays(todayMidnight, -7).toISOString(),
    end: todayMidnight.toISOString(),
  };

  logger.info({ window }, 'weekly digest: building report');

  let report;
  try {
    report = builder.build({
      window,
      now: now.toISOString(),
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    logger.error({ err, window }, 'weekly digest: builder.build threw');
    return;
  }

  await Promise.allSettled([
    slack.post(report).catch((err) => logger.warn({ err }, 'weekly digest: slack post failed')),
    notion.append(report).catch((err) => logger.warn({ err }, 'weekly digest: notion append failed')),
  ]);

  logger.info({ window }, 'weekly digest: complete');
}

export interface ScheduleWeeklyDigestOptions extends WeeklyDigestDeps {
  /** Cron expression. e.g. `0 9 * * 1` = Mondays 09:00 UTC. */
  cronExpression: string;
  /** Injected for tests. Defaults to node-cron. */
  cronLib?: { schedule: (...args: any[]) => { stop: () => void }; validate: (expr: string) => boolean };
}

export interface WeeklyDigestHandle {
  stop: () => void;
}

/**
 * Schedules `runWeeklyDigest` on a cron cadence (UTC timezone).
 * Returns a handle with `stop()`. Failures inside `runWeeklyDigest`
 * are already absorbed; this wrapper only catches genuinely
 * unexpected scheduler-level errors.
 *
 * If `opts.cronExpression` is invalid or `cron.schedule` throws,
 * error-logs and returns a no-op handle so boot is not crashed.
 */
export function scheduleWeeklyDigest(opts: ScheduleWeeklyDigestOptions): WeeklyDigestHandle {
  const lib = opts.cronLib ?? cron;

  if (!lib.validate(opts.cronExpression)) {
    opts.logger.error(
      { cronExpression: opts.cronExpression },
      'weekly digest: invalid cron expression; scheduler not started'
    );
    return { stop: () => {} };
  }

  let task;
  try {
    task = lib.schedule(
      opts.cronExpression,
      () => {
        runWeeklyDigest(opts).catch((err) => {
          opts.logger.error({ err }, 'weekly digest: unexpected error');
        });
      },
      { timezone: 'UTC' }
    );
  } catch (err) {
    opts.logger.error(
      { err, cronExpression: opts.cronExpression },
      'weekly digest: cron.schedule threw; scheduler not started'
    );
    return { stop: () => {} };
  }

  return {
    stop: () => task.stop(),
  };
}
