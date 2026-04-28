import { describe, expect, it } from 'vitest';
import { createDb } from '../../src/db';
import { hashUsageApiKey, UsageApiKeyRepository } from '../../src/repositories/usage-api-key-repository';

describe('UsageApiKeyRepository', () => {
  it('stores only the key hash and authenticates active keys', () => {
    const db = createDb(':memory:');
    const repo = new UsageApiKeyRepository(db);
    const rawKey = 'tack_test_key_0123456789abcdef';

    repo.create({
      id: 'uak_1',
      name: 'claude-code',
      keyHash: hashUsageApiKey(rawKey),
      createdAt: '2026-04-28T00:00:00.000Z',
    });

    const rows = db.prepare('SELECT key_hash, last_used_at FROM usage_api_keys').all() as Array<{
      key_hash: string;
      last_used_at: string | null;
    }>;
    expect(rows).toEqual([{ key_hash: hashUsageApiKey(rawKey), last_used_at: null }]);
    expect(rows[0].key_hash).not.toContain(rawKey);

    const record = repo.authenticate(rawKey, '2026-04-28T12:00:00.000Z');
    expect(record).toMatchObject({
      id: 'uak_1',
      name: 'claude-code',
      last_used_at: '2026-04-28T12:00:00.000Z',
      revoked_at: null,
    });

    expect(repo.authenticate('wrong-key')).toBeNull();
    expect(db.prepare('SELECT last_used_at FROM usage_api_keys WHERE id = ?').get('uak_1')).toEqual({
      last_used_at: '2026-04-28T12:00:00.000Z',
    });
  });

  it('rejects revoked keys', () => {
    const db = createDb(':memory:');
    const repo = new UsageApiKeyRepository(db);
    const rawKey = 'tack_revoked_key_0123456789abcdef';

    repo.create({
      id: 'uak_2',
      name: 'old-client',
      keyHash: hashUsageApiKey(rawKey),
      createdAt: '2026-04-28T00:00:00.000Z',
    });

    expect(repo.revokeByName('old-client', '2026-04-29T00:00:00.000Z')).toBe(true);
    expect(repo.authenticate(rawKey)).toBeNull();
  });
});
