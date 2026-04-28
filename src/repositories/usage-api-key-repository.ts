import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';

export interface UsageApiKeyRecord {
  id: string;
  name: string;
  key_hash: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface CreateUsageApiKeyInput {
  id: string;
  name: string;
  keyHash: string;
  createdAt: string;
}

export function hashUsageApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

export class UsageApiKeyRepository {
  private readonly createStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly findActiveByHashStmt: Database.Statement;
  private readonly touchLastUsedStmt: Database.Statement;
  private readonly revokeByNameStmt: Database.Statement;
  private readonly listStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.createStmt = db.prepare(`
      INSERT INTO usage_api_keys (id, name, key_hash, created_at, last_used_at, revoked_at)
      VALUES (@id, @name, @keyHash, @createdAt, NULL, NULL)
    `);
    this.findByIdStmt = db.prepare(`
      SELECT id, name, key_hash, created_at, last_used_at, revoked_at
      FROM usage_api_keys
      WHERE id = ?
    `);
    this.findActiveByHashStmt = db.prepare(`
      SELECT id, name, key_hash, created_at, last_used_at, revoked_at
      FROM usage_api_keys
      WHERE key_hash = ? AND revoked_at IS NULL
      LIMIT 1
    `);
    this.touchLastUsedStmt = db.prepare(`
      UPDATE usage_api_keys SET last_used_at = ? WHERE id = ?
    `);
    this.revokeByNameStmt = db.prepare(`
      UPDATE usage_api_keys SET revoked_at = ? WHERE name = ? AND revoked_at IS NULL
    `);
    this.listStmt = db.prepare(`
      SELECT id, name, key_hash, created_at, last_used_at, revoked_at
      FROM usage_api_keys
      ORDER BY created_at DESC, name ASC
    `);
  }

  create(input: CreateUsageApiKeyInput): UsageApiKeyRecord {
    this.createStmt.run(input);
    return this.findByIdStmt.get(input.id) as UsageApiKeyRecord;
  }

  authenticate(apiKey: string, usedAt = new Date().toISOString()): UsageApiKeyRecord | null {
    const keyHash = hashUsageApiKey(apiKey);
    const record = this.findActiveByHashStmt.get(keyHash) as UsageApiKeyRecord | undefined;
    if (!record) {
      return null;
    }

    this.touchLastUsedStmt.run(usedAt, record.id);
    return {
      ...record,
      last_used_at: usedAt,
    };
  }

  revokeByName(name: string, revokedAt = new Date().toISOString()): boolean {
    const result = this.revokeByNameStmt.run(revokedAt, name);
    return result.changes > 0;
  }

  list(): UsageApiKeyRecord[] {
    return this.listStmt.all() as UsageApiKeyRecord[];
  }
}
