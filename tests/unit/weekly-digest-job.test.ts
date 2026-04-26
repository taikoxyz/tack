import { describe, expect, it, vi } from 'vitest';
import { runWeeklyDigest, scheduleWeeklyDigest } from '../../src/services/reporting/weekly-digest-job';
import type { Report } from '../../src/services/reporting/types';

const fakeReport = { window: { start: '', end: '' } } as unknown as Report;

describe('runWeeklyDigest', () => {
  it('builds a Report for [today_midnight - 7d, today_midnight)', async () => {
    const builder = { build: vi.fn().mockReturnValue(fakeReport) };
    const slack = { post: vi.fn().mockResolvedValue(undefined) };
    const notion = { append: vi.fn().mockResolvedValue(undefined) };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await runWeeklyDigest({
      builder: builder as any,
      slack: slack as any,
      notion: notion as any,
      logger: logger as any,
      now: () => new Date('2026-04-27T09:00:00.000Z'),
    });

    expect(builder.build).toHaveBeenCalledOnce();
    const arg = builder.build.mock.calls[0][0];
    expect(arg.window.end).toBe('2026-04-27T00:00:00.000Z');     // midnight of fire-day
    expect(arg.window.start).toBe('2026-04-20T00:00:00.000Z');   // 7 days back
  });

  it('publishes to Slack and Notion in parallel', async () => {
    const builder = { build: vi.fn().mockReturnValue(fakeReport) };
    const slack = { post: vi.fn().mockResolvedValue(undefined) };
    const notion = { append: vi.fn().mockResolvedValue(undefined) };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await runWeeklyDigest({
      builder: builder as any, slack: slack as any, notion: notion as any,
      logger: logger as any, now: () => new Date('2026-04-27T09:00:00.000Z'),
    });

    expect(slack.post).toHaveBeenCalledWith(fakeReport);
    expect(notion.append).toHaveBeenCalledWith(fakeReport);
  });

  it('continues to Notion even if Slack throws', async () => {
    const builder = { build: vi.fn().mockReturnValue(fakeReport) };
    const slack = { post: vi.fn().mockRejectedValue(new Error('slack down')) };
    const notion = { append: vi.fn().mockResolvedValue(undefined) };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await expect(runWeeklyDigest({
      builder: builder as any, slack: slack as any, notion: notion as any,
      logger: logger as any, now: () => new Date('2026-04-27T09:00:00.000Z'),
    })).resolves.not.toThrow();

    expect(notion.append).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('logs error and does not throw if both Slack and Notion fail', async () => {
    const builder = { build: vi.fn().mockReturnValue(fakeReport) };
    const slack = { post: vi.fn().mockRejectedValue(new Error('slack')) };
    const notion = { append: vi.fn().mockRejectedValue(new Error('notion')) };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await expect(runWeeklyDigest({
      builder: builder as any, slack: slack as any, notion: notion as any,
      logger: logger as any, now: () => new Date('2026-04-27T09:00:00.000Z'),
    })).resolves.not.toThrow();

    // Both publishers' failures should be warn-logged (or at minimum, no throw)
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('logs error and does not throw if builder.build throws', async () => {
    const builder = { build: vi.fn().mockImplementation(() => { throw new Error('build broke'); }) };
    const slack = { post: vi.fn().mockResolvedValue(undefined) };
    const notion = { append: vi.fn().mockResolvedValue(undefined) };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await expect(runWeeklyDigest({
      builder: builder as any, slack: slack as any, notion: notion as any,
      logger: logger as any, now: () => new Date('2026-04-27T09:00:00.000Z'),
    })).resolves.not.toThrow();

    expect(logger.error).toHaveBeenCalledOnce();
    expect(slack.post).not.toHaveBeenCalled();
    expect(notion.append).not.toHaveBeenCalled();
  });

  it('window end is always midnight even when fire time is 09:00 UTC', async () => {
    const builder = { build: vi.fn().mockReturnValue(fakeReport) };
    const slack = { post: vi.fn().mockResolvedValue(undefined) };
    const notion = { append: vi.fn().mockResolvedValue(undefined) };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await runWeeklyDigest({
      builder: builder as any, slack: slack as any, notion: notion as any,
      logger: logger as any, now: () => new Date('2026-04-27T09:00:00.000Z'),
    });

    const arg = builder.build.mock.calls[0][0];
    expect(arg.window.end).toBe('2026-04-27T00:00:00.000Z');
  });
});

describe('scheduleWeeklyDigest', () => {
  function makeDeps(logger?: any) {
    return {
      builder: {} as any,
      slack: {} as any,
      notion: {} as any,
      logger: logger ?? { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };
  }

  it('returns a stop handle that stops the scheduled task', () => {
    const stop = vi.fn();
    const fakeCronLib = {
      validate: vi.fn().mockReturnValue(true),
      schedule: vi.fn().mockReturnValue({ stop }),
    };

    const handle = scheduleWeeklyDigest({
      ...makeDeps(),
      cronExpression: '0 9 * * 1',
      cronLib: fakeCronLib,
    });

    expect(fakeCronLib.schedule).toHaveBeenCalledWith('0 9 * * 1', expect.any(Function), { timezone: 'UTC' });
    handle.stop();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('returns a no-op handle and error-logs when cron expression is invalid', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const fakeCronLib = {
      validate: vi.fn().mockReturnValue(false),
      schedule: vi.fn(),
    };

    const handle = scheduleWeeklyDigest({
      ...makeDeps(logger),
      cronExpression: 'not a cron expression',
      cronLib: fakeCronLib,
    });

    expect(fakeCronLib.schedule).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledOnce();
    expect(() => handle.stop()).not.toThrow();
  });

  it('returns a no-op handle and error-logs when cron.schedule throws', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const fakeCronLib = {
      validate: vi.fn().mockReturnValue(true),
      schedule: vi.fn().mockImplementation(() => { throw new Error('cron broke'); }),
    };

    const handle = scheduleWeeklyDigest({
      ...makeDeps(logger),
      cronExpression: '0 9 * * 1',
      cronLib: fakeCronLib,
    });

    expect(logger.error).toHaveBeenCalledOnce();
    expect(() => handle.stop()).not.toThrow();
  });
});
