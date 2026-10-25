import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../src/db';
import { createSqliteMppStore, MPP_HASH_ALREADY_USED_MESSAGE } from '../../../src/services/payment/mpp-store';

const HASH_KEY = `mppx:charge:0x${'ab'.repeat(32)}` as const;
const OTHER_KEY = `mppx:charge:0x${'cd'.repeat(32)}` as const;

describe('createSqliteMppStore', () => {
  const dirs: string[] = [];

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'tack-mpp-store-'));
    dirs.push(dir);
    return join(dir, 'tack.db');
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for a hash that was never used', async () => {
    const store = createSqliteMppStore(createDb(tempDbPath()));
    expect(await store.get(HASH_KEY)).toBeNull();
  });

  it('round-trips a stored value', async () => {
    const store = createSqliteMppStore(createDb(tempDbPath()));
    await store.put(HASH_KEY, 1_700_000_000_000);
    expect(await store.get(HASH_KEY)).toBe(1_700_000_000_000);
  });

  it('refuses to record the same hash twice, so concurrent requests cannot both succeed', async () => {
    const store = createSqliteMppStore(createDb(tempDbPath()));
    const results = await Promise.allSettled([store.put(HASH_KEY, 1), store.put(HASH_KEY, 2)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((rejected.reason as Error).message).toBe(MPP_HASH_ALREADY_USED_MESSAGE);
  });

  it('keeps used hashes across a restart (new connection, same database file)', async () => {
    const path = tempDbPath();
    const first = createDb(path);
    await createSqliteMppStore(first).put(HASH_KEY, 42);
    first.close();

    const second = createSqliteMppStore(createDb(path));
    expect(await second.get(HASH_KEY)).toBe(42);
    await expect(second.put(HASH_KEY, 43)).rejects.toThrow(MPP_HASH_ALREADY_USED_MESSAGE);
  });

  it('deletes a key and leaves others untouched', async () => {
    const store = createSqliteMppStore(createDb(tempDbPath()));
    await store.put(HASH_KEY, 1);
    await store.put(OTHER_KEY, 2);
    await store.delete(HASH_KEY);

    expect(await store.get(HASH_KEY)).toBeNull();
    expect(await store.get(OTHER_KEY)).toBe(2);
  });
});
