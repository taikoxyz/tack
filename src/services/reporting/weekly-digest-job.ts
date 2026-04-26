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
}

export interface WeeklyDigestHandle {
  stop: () => void;
}

/**
 * Schedules `runWeeklyDigest` on a cron cadence (UTC timezone).
 * Returns a handle with `stop()`. Failures inside `runWeeklyDigest`
 * are already absorbed; this wrapper only catches genuinely
 * unexpected scheduler-level errors.
 */
export function scheduleWeeklyDigest(opts: ScheduleWeeklyDigestOptions): WeeklyDigestHandle {
  const task = cron.schedule(
    opts.cronExpression,
    () => {
      runWeeklyDigest(opts).catch((err) => {
        opts.logger.error({ err }, 'weekly digest: unexpected error');
      });
    },
    { timezone: 'UTC' }
  );

  return {
    stop: () => task.stop(),
  };
}
