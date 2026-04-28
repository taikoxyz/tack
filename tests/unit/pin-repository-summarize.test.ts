import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db';
import { PinRepository } from '../../src/repositories/pin-repository';

describe('PinRepository.summarize', () => {
  let db: Database.Database;
  let repo: PinRepository;

  const baseRow = (overrides: Partial<{
    requestid: string;
    cid: string;
    owner: string;
    status: 'pinned' | 'failed' | 'queued' | 'pinning';
    created: string;
    size_bytes: number | null;
    expires_at: string | null;
  }>) => ({
    requestid: overrides.requestid ?? 'req',
    cid: overrides.cid ?? 'bafy',
    name: null,
    status: overrides.status ?? 'pinned',
    origins: [],
    meta: {},
    delegates: [],
    info: {},
    owner: overrides.owner ?? '0xaaa',
    created: overrides.created ?? '2026-04-21T00:00:00.000Z',
    updated: '2026-04-21T00:00:00.000Z',
    expires_at: overrides.expires_at ?? null,
    size_bytes: overrides.size_bytes ?? null,
  });

  beforeEach(() => {
    db = createDb(':memory:');
    repo = new PinRepository(db);
  });

  it('counts new pins and bytes in window, ignoring NULL sizes for byte total', () => {
    repo.create(baseRow({ requestid: 'a', cid: 'b1', size_bytes: 1000, created: '2026-04-21T00:00:00.000Z' }));
    repo.create(baseRow({ requestid: 'b', cid: 'b2', size_bytes: 2000, created: '2026-04-22T00:00:00.000Z' }));
    repo.create(baseRow({ requestid: 'c', cid: 'b3', size_bytes: null, created: '2026-04-22T00:00:00.000Z' }));
    repo.create(baseRow({ requestid: 'd', cid: 'b4', size_bytes: 999999, created: '2026-04-30T00:00:00.000Z' })); // outside

    const summary = repo.summarize({
      start: '2026-04-20T00:00:00.000Z',
      end: '2026-04-23T00:00:00.000Z',
      now: '2026-04-23T00:00:00.000Z',
    });

    expect(summary.newPinsInWindow.count).toBe(3);
    expect(summary.newPinsInWindow.totalBytes).toBe(3000);
  });

  it('counts active pins and total bytes under management', () => {
    repo.create(baseRow({ requestid: 'a', cid: 'b1', status: 'pinned', size_bytes: 1000 }));
    repo.create(baseRow({ requestid: 'b', cid: 'b2', status: 'pinned', size_bytes: 2000, expires_at: '2026-05-01T00:00:00.000Z' }));
    repo.create(baseRow({ requestid: 'c', cid: 'b3', status: 'pinned', size_bytes: 5000, expires_at: '2026-04-01T00:00:00.000Z' })); // expired
    repo.create(baseRow({ requestid: 'd', cid: 'b4', status: 'failed', size_bytes: 7000 }));

    const summary = repo.summarize({
      start: '2026-04-20T00:00:00.000Z',
      end: '2026-04-23T00:00:00.000Z',
      now: '2026-04-23T00:00:00.000Z',
    });

    expect(summary.activePins.count).toBe(2);
    expect(summary.activePins.totalBytes).toBe(3000);
  });

  it('summarizes empty window/empty repo as zeros', () => {
    const summary = repo.summarize({
      start: '2026-04-20T00:00:00.000Z',
      end: '2026-04-23T00:00:00.000Z',
      now: '2026-04-23T00:00:00.000Z',
    });
    expect(summary).toEqual({
      newPinsInWindow: { count: 0, totalBytes: 0 },
      activePins: { count: 0, totalBytes: 0 },
    });
  });

  it('half-open window: created at start is included, created at end is excluded', () => {
    repo.create(baseRow({ requestid: 'a', cid: 'b1', size_bytes: 100, created: '2026-04-21T00:00:00.000Z' }));
    repo.create(baseRow({ requestid: 'b', cid: 'b2', size_bytes: 200, created: '2026-04-22T00:00:00.000Z' }));
    const summary = repo.summarize({
      start: '2026-04-21T00:00:00.000Z',
      end: '2026-04-22T00:00:00.000Z',
      now: '2026-04-22T00:00:00.000Z',
    });
    expect(summary.newPinsInWindow.count).toBe(1);
    expect(summary.newPinsInWindow.totalBytes).toBe(100);
  });

  it('persists and reads size_bytes round-trip via create + findByRequestId', () => {
    repo.create(baseRow({ requestid: 'rr', cid: 'b', size_bytes: 4242 }));
    const found = repo.findByRequestId('rr');
    expect(found?.size_bytes).toBe(4242);
  });

  it('persists null size_bytes correctly', () => {
    repo.create(baseRow({ requestid: 'rr', cid: 'b', size_bytes: null }));
    const found = repo.findByRequestId('rr');
    expect(found?.size_bytes).toBeNull();
  });
});
