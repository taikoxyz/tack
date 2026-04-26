import { describe, expect, it, vi } from 'vitest';
import { NotionPublisher, isoWeekKey } from '../../src/services/reporting/notion-publisher';
import type { Report } from '../../src/services/reporting/types';

const sample: Report = {
  window: { start: '2026-04-20T00:00:00.000Z', end: '2026-04-27T00:00:00.000Z' },
  generatedAt: '2026-04-27T00:00:00.000Z',
  revenue: { totalUsd: 12.34, byProtocol: { x402: { totalUsd: 10, count: 5 }, mpp: { totalUsd: 2.34, count: 1 } } },
  pins: { newInWindow: { count: 3, totalBytes: 500_000 }, active: { count: 10, totalBytes: 1_000_000 } },
  wallets: { payersInWindow: 4, cumulativePayers: 27, firstTimePayersInWindow: ['0xnew'] },
  requests: { total: 100, paid: 6, rejected_402: 4 },
};

describe('isoWeekKey', () => {
  it('formats ISO week from a Mon-aligned date', () => {
    // 2026-04-20 is a Monday in ISO week 17
    expect(isoWeekKey(new Date('2026-04-20T00:00:00.000Z'))).toBe('2026-W17');
  });

  it('zero-pads single-digit weeks', () => {
    // 2026-01-05 is a Monday in ISO week 02
    expect(isoWeekKey(new Date('2026-01-05T00:00:00.000Z'))).toBe('2026-W02');
  });

  it('handles ISO weeks that cross a year boundary', () => {
    // 2025-12-29 is a Monday in ISO week 1 of 2026
    expect(isoWeekKey(new Date('2025-12-29T00:00:00.000Z'))).toBe('2026-W01');
  });
});

describe('NotionPublisher', () => {
  function makeClient() {
    return {
      databases: {
        retrieve: vi.fn().mockResolvedValue({ data_sources: [{ id: 'ds_default' }] }),
      },
      dataSources: {
        query: vi.fn().mockResolvedValue({ results: [] }),
      },
      pages: { create: vi.fn().mockResolvedValue({ id: 'page' }) },
    };
  }

  it('appends a page when no row exists for the week', async () => {
    const client = makeClient();
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'db', logger: logger as any });

    await pub.append(sample);

    expect(client.databases.retrieve).toHaveBeenCalledOnce();
    expect(client.dataSources.query).toHaveBeenCalledOnce();
    const queryArg = client.dataSources.query.mock.calls[0][0];
    expect(queryArg.data_source_id).toBe('ds_default');
    expect(queryArg.filter).toEqual({ property: 'Week', title: { equals: '2026-W17' } });
    expect(queryArg.page_size).toBe(1);

    expect(client.pages.create).toHaveBeenCalledOnce();
    const createArg = client.pages.create.mock.calls[0][0];
    expect(createArg.parent.database_id).toBe('db');
    expect(createArg.properties.Week.title[0].text.content).toBe('2026-W17');
    expect(createArg.properties['Window Start'].date.start).toBe('2026-04-20T00:00:00.000Z');
    expect(createArg.properties['Window End'].date.start).toBe('2026-04-27T00:00:00.000Z');
    expect(createArg.properties['Revenue USD'].number).toBe(12.34);
    expect(createArg.properties['x402 USD'].number).toBe(10);
    expect(createArg.properties['MPP USD'].number).toBe(2.34);
    expect(createArg.properties['New Pins'].number).toBe(3);
    expect(createArg.properties['New Bytes'].number).toBe(500_000);
    expect(createArg.properties['Active Pins'].number).toBe(10);
    expect(createArg.properties['Active Bytes'].number).toBe(1_000_000);
    expect(createArg.properties['Paying Wallets'].number).toBe(4);
    expect(createArg.properties['Cumulative Wallets'].number).toBe(27);
    expect(createArg.properties['New Payers'].number).toBe(1);
    expect(createArg.properties['Total Requests'].number).toBe(100);
    expect(createArg.properties['Paid Requests'].number).toBe(6);
    expect(createArg.properties['402s'].number).toBe(4);
  });

  it('skips when a row already exists for the week', async () => {
    const client = makeClient();
    client.dataSources.query.mockResolvedValueOnce({ results: [{ id: 'existing' }] });
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'db', logger: logger as any });

    await pub.append(sample);

    expect(client.pages.create).not.toHaveBeenCalled();
  });

  it('warns and does not throw on Notion query error', async () => {
    const client = makeClient();
    client.dataSources.query.mockRejectedValue(new Error('boom'));
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'db', logger: logger as any });

    await expect(pub.append(sample)).resolves.not.toThrow();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('warns and does not throw on Notion create error', async () => {
    const client = makeClient();
    client.pages.create.mockRejectedValue(new Error('quota'));
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'db', logger: logger as any });

    await expect(pub.append(sample)).resolves.not.toThrow();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('logs at error level when Notion returns object_not_found (config bug)', async () => {
    const client = makeClient();
    const err = Object.assign(new Error('database not found'), { code: 'object_not_found' });
    client.dataSources.query.mockRejectedValue(err);
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'bad', logger: logger as any });

    await pub.append(sample);

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs at error level for validation_error (column rename)', async () => {
    const client = makeClient();
    const err = Object.assign(new Error('validation failed'), { code: 'validation_error' });
    client.pages.create.mockRejectedValue(err);
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'db', logger: logger as any });

    await pub.append(sample);

    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('logs at warn level for unknown / transient errors', async () => {
    const client = makeClient();
    client.dataSources.query.mockRejectedValue(new Error('network blip'));
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'db', logger: logger as any });

    await pub.append(sample);

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs at warn level for rate_limited (transient)', async () => {
    const client = makeClient();
    const err = Object.assign(new Error('rate limited'), { code: 'rate_limited' });
    client.dataSources.query.mockRejectedValue(err);
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'db', logger: logger as any });

    await pub.append(sample);

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('uses report.window.start for ISO week key, not the current time', async () => {
    const client = makeClient();
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'db', logger: logger as any });

    // Report whose window.start is far from current time
    const oldReport: Report = {
      ...sample,
      window: { start: '2024-01-01T00:00:00.000Z', end: '2024-01-08T00:00:00.000Z' },
    };

    await pub.append(oldReport);

    expect(client.dataSources.query.mock.calls[0][0].filter).toEqual({
      property: 'Week',
      title: { equals: '2024-W01' },
    });
  });

  it('caches the data source id across multiple appends', async () => {
    const client = makeClient();
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'db', logger: logger as any });

    await pub.append(sample);
    await pub.append({ ...sample, window: { start: '2026-04-27T00:00:00.000Z', end: '2026-05-04T00:00:00.000Z' } });

    expect(client.databases.retrieve).toHaveBeenCalledOnce(); // cached
    expect(client.dataSources.query).toHaveBeenCalledTimes(2);
  });

  it('error-logs and skips when database has no data sources', async () => {
    const client = makeClient();
    client.databases.retrieve.mockResolvedValueOnce({ data_sources: [] });
    const logger = { warn: vi.fn(), error: vi.fn() };
    const pub = new NotionPublisher({ client: client as any, databaseId: 'db', logger: logger as any });

    await pub.append(sample);

    expect(logger.error).toHaveBeenCalledOnce();
    expect(client.dataSources.query).not.toHaveBeenCalled();
    expect(client.pages.create).not.toHaveBeenCalled();
  });
});
