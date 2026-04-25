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

    CREATE INDEX IF NOT EXISTS idx_pins_cid ON pins(cid);
    CREATE INDEX IF NOT EXISTS idx_pins_name ON pins(name);
    CREATE INDEX IF NOT EXISTS idx_pins_status ON pins(status);
    CREATE INDEX IF NOT EXISTS idx_pins_created ON pins(created);
    CREATE INDEX IF NOT EXISTS idx_pins_owner ON pins(owner);
  `);

  // Migration: add expires_at column if missing
  const columns = db.pragma('table_info(pins)') as Array<{ name: string }>;
  if (!columns.some((col) => col.name === 'expires_at')) {
    db.exec('ALTER TABLE pins ADD COLUMN expires_at TEXT');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_pins_expires_at ON pins(expires_at)');

  // Reporting feature: payments raw event log
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
    CREATE INDEX IF NOT EXISTS idx_payments_payer_wallet ON payments(payer_wallet);
    CREATE INDEX IF NOT EXISTS idx_payments_protocol ON payments(protocol);

    CREATE TABLE IF NOT EXISTS request_metrics_daily (
      day     TEXT NOT NULL,
      bucket  TEXT NOT NULL,
      count   INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, bucket)
    );
  `);

  // Reporting feature: pin size column
  if (!columns.some((col) => col.name === 'size_bytes')) {
    db.exec('ALTER TABLE pins ADD COLUMN size_bytes INTEGER');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_pins_size_bytes ON pins(size_bytes)');

  return db;
}
