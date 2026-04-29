import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

export function createDb(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS pins (
      requestid TEXT PRIMARY KEY,
      cid TEXT NOT NULL,
      name TEXT,
      status TEXT NOT NULL CHECK(status IN ('queued', 'pinning', 'pinned', 'failed')),
      origins TEXT NOT NULL,
      meta TEXT NOT NULL,
      delegates TEXT NOT NULL,
      info TEXT NOT NULL,
      owner TEXT NOT NULL,
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cid_owners (
      cid TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      created TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallet_auth_challenges (
      nonce_hash TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      network TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      domain TEXT NOT NULL,
      uri TEXT NOT NULL,
      message TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS private_objects (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      name TEXT,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      meta TEXT NOT NULL,
      payment_status TEXT NOT NULL CHECK(payment_status IN ('paid', 'pending', 'failed')),
      created TEXT NOT NULL,
      updated TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pins_cid ON pins(cid);
    CREATE INDEX IF NOT EXISTS idx_pins_name ON pins(name);
    CREATE INDEX IF NOT EXISTS idx_pins_status ON pins(status);
    CREATE INDEX IF NOT EXISTS idx_pins_created ON pins(created);
    CREATE INDEX IF NOT EXISTS idx_pins_owner ON pins(owner);
    CREATE INDEX IF NOT EXISTS idx_wallet_auth_challenges_expires_at ON wallet_auth_challenges(expires_at);
    CREATE INDEX IF NOT EXISTS idx_private_objects_owner ON private_objects(owner);
    CREATE INDEX IF NOT EXISTS idx_private_objects_created ON private_objects(created);
    CREATE INDEX IF NOT EXISTS idx_private_objects_expires_at ON private_objects(expires_at);
  `);

  // Migration: add expires_at column if missing
  const columns = db.pragma('table_info(pins)') as Array<{ name: string }>;
  if (!columns.some((col) => col.name === 'expires_at')) {
    db.exec('ALTER TABLE pins ADD COLUMN expires_at TEXT');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_pins_expires_at ON pins(expires_at)');

  // Usage metrics: payments raw event log
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id              TEXT PRIMARY KEY,
      occurred_at     TEXT NOT NULL,
      protocol        TEXT NOT NULL CHECK(protocol IN ('x402', 'mpp')),
      chain_id        INTEGER NOT NULL,
      payer_wallet    TEXT NOT NULL,
      asset_address   TEXT NOT NULL,
      asset_decimals  INTEGER NOT NULL,
      amount_atomic   TEXT NOT NULL,
      amount_usd      REAL NOT NULL,
      endpoint        TEXT NOT NULL CHECK(endpoint IN ('pin', 'retrieval')),
      request_id      TEXT,
      tx_hash         TEXT,
      pin_request_id  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_payments_occurred_at ON payments(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_payments_payer_occurred ON payments(payer_wallet, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_payments_protocol ON payments(protocol);
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_payments_protocol_txhash
      ON payments(protocol, tx_hash) WHERE tx_hash IS NOT NULL;

    CREATE TABLE IF NOT EXISTS request_metrics_daily (
      day     TEXT NOT NULL,
      bucket  TEXT NOT NULL,
      count   INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, bucket)
    );

    CREATE TABLE IF NOT EXISTS usage_api_keys (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL UNIQUE,
      key_hash     TEXT NOT NULL UNIQUE,
      created_at   TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_usage_api_keys_revoked_at ON usage_api_keys(revoked_at);
  `);

  // Usage metrics: pin size column
  if (!columns.some((col) => col.name === 'size_bytes')) {
    db.exec('ALTER TABLE pins ADD COLUMN size_bytes INTEGER');
  }
  // idx_pins_size_bytes intentionally omitted: no query filters by size_bytes alone (only SUM)

  return db;
}
