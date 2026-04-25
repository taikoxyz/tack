import type Database from 'better-sqlite3';

export interface PaymentRecord {
  id: string;
  occurred_at: string;
  protocol: 'x402' | 'mpp';
  chain_id: number;
  payer_wallet: string;
  asset_address: string;
  asset_decimals: number;
  amount_atomic: string;
  amount_usd: number;
  endpoint: 'pin' | 'retrieval';
  request_id: string | null;
  tx_hash: string | null;
  pin_request_id: string | null;
}

export interface PaymentWindow {
  start: string;
  end: string;
}

export interface PaymentSummary {
  totalUsd: number;
  count: number;
  uniquePayers: number;
  byProtocol: {
    x402: { totalUsd: number; count: number };
    mpp: { totalUsd: number; count: number };
  };
}

export class PaymentRepository {
  constructor(private readonly db: Database.Database) {}

  insert(record: PaymentRecord): void {
    if (record.tx_hash) {
      const existing = this.db
        .prepare('SELECT id FROM payments WHERE protocol = ? AND tx_hash = ?')
        .get(record.protocol, record.tx_hash);
      if (existing) {
        return;
      }
    }

    this.db
      .prepare(
        `INSERT INTO payments (
          id, occurred_at, protocol, chain_id, payer_wallet,
          asset_address, asset_decimals, amount_atomic, amount_usd,
          endpoint, request_id, tx_hash, pin_request_id
        ) VALUES (
          @id, @occurred_at, @protocol, @chain_id, @payer_wallet,
          @asset_address, @asset_decimals, @amount_atomic, @amount_usd,
          @endpoint, @request_id, @tx_hash, @pin_request_id
        )`
      )
      .run(record);
  }

  findById(id: string): PaymentRecord | null {
    const row = this.db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as PaymentRecord | undefined;
    return row ?? null;
  }

  summarizeWindow(window: PaymentWindow): PaymentSummary {
    const rows = this.db
      .prepare(
        `SELECT protocol, amount_usd, payer_wallet
         FROM payments
         WHERE occurred_at >= ? AND occurred_at < ?`
      )
      .all(window.start, window.end) as Array<{ protocol: 'x402' | 'mpp'; amount_usd: number; payer_wallet: string }>;

    const summary: PaymentSummary = {
      totalUsd: 0,
      count: rows.length,
      uniquePayers: new Set(rows.map((r) => r.payer_wallet)).size,
      byProtocol: {
        x402: { totalUsd: 0, count: 0 },
        mpp: { totalUsd: 0, count: 0 },
      },
    };

    for (const row of rows) {
      summary.totalUsd += row.amount_usd;
      summary.byProtocol[row.protocol].totalUsd += row.amount_usd;
      summary.byProtocol[row.protocol].count += 1;
    }

    return summary;
  }

  firstTimePayers(window: PaymentWindow): string[] {
    const rows = this.db
      .prepare(
        `SELECT payer_wallet
         FROM payments
         GROUP BY payer_wallet
         HAVING MIN(occurred_at) >= ? AND MIN(occurred_at) < ?
         ORDER BY MIN(occurred_at) ASC`
      )
      .all(window.start, window.end) as Array<{ payer_wallet: string }>;

    return rows.map((r) => r.payer_wallet);
  }

  cumulativeUniquePayers(): number {
    const row = this.db.prepare('SELECT COUNT(DISTINCT payer_wallet) AS n FROM payments').get() as { n: number };
    return row.n;
  }
}
