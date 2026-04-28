import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ulid } from 'ulid';
import { createDb } from '../db';
import { hashUsageApiKey, UsageApiKeyRepository } from '../repositories/usage-api-key-repository';

function usage(): never {
  console.error(`Usage:
  pnpm usage:key create <name>
  pnpm usage:key import <name>   # reads the raw key from stdin
  pnpm usage:key revoke <name>
  pnpm usage:key list

Environment:
  DATABASE_PATH defaults to ./data/tack.db`);
  process.exit(1);
}

function requireName(value: string | undefined): string {
  const name = value?.trim();
  if (!name) {
    usage();
  }
  return name;
}

function openRepository(): UsageApiKeyRepository {
  const dbPath = process.env.DATABASE_PATH ?? './data/tack.db';
  const db = createDb(dbPath);
  return new UsageApiKeyRepository(db);
}

function createKey(repo: UsageApiKeyRepository, name: string): void {
  const apiKey = `tack_${randomBytes(32).toString('base64url')}`;
  repo.create({
    id: `uak_${ulid()}`,
    name,
    keyHash: hashUsageApiKey(apiKey),
    createdAt: new Date().toISOString(),
  });

  console.log(JSON.stringify({ name, apiKey }, null, 2));
}

function importKey(repo: UsageApiKeyRepository, name: string): void {
  const apiKey = readFileSync(0, 'utf8').trim();
  if (!apiKey) {
    throw new Error('No API key received on stdin');
  }

  repo.create({
    id: `uak_${ulid()}`,
    name,
    keyHash: hashUsageApiKey(apiKey),
    createdAt: new Date().toISOString(),
  });

  console.log(JSON.stringify({ name, imported: true }, null, 2));
}

function revokeKey(repo: UsageApiKeyRepository, name: string): void {
  const revoked = repo.revokeByName(name);
  console.log(JSON.stringify({ name, revoked }, null, 2));
  if (!revoked) {
    process.exitCode = 1;
  }
}

function listKeys(repo: UsageApiKeyRepository): void {
  const keys = repo.list().map((key) => ({
    id: key.id,
    name: key.name,
    created_at: key.created_at,
    last_used_at: key.last_used_at,
    revoked_at: key.revoked_at,
  }));
  console.log(JSON.stringify(keys, null, 2));
}

const [command, nameArg] = process.argv.slice(2);
const repo = openRepository();

switch (command) {
  case 'create':
    createKey(repo, requireName(nameArg));
    break;
  case 'import':
    importKey(repo, requireName(nameArg));
    break;
  case 'revoke':
    revokeKey(repo, requireName(nameArg));
    break;
  case 'list':
    listKeys(repo);
    break;
  default:
    usage();
}
