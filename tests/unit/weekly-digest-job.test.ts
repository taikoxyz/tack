import { describe, expect, it, vi } from 'vitest';
import { runWeeklyDigest } from '../../src/services/reporting/weekly-digest-job';
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
