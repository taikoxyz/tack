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
  byEndpoint: {
    pin: { totalUsd: number; count: number };
    retrieval: { totalUsd: number; count: number };
  };
}

export class PaymentRepository {
  constructor(private readonly db: Database.Database) {}

  insert(record: PaymentRecord): 'inserted' | 'duplicate' {
    if (record.tx_hash) {
      const existing = this.db
        .prepare('SELECT id FROM payments WHERE protocol = ? AND tx_hash = ?')
        .get(record.protocol, record.tx_hash);
      if (existing) {
        return 'duplicate';
      }
    }

    try {
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
      return 'inserted';
    } catch (err: unknown) {
      // Defense-in-depth: if the partial-unique index throws (race or
      // SELECT bypassed), surface duplicate signal rather than crashing.
      if (err && typeof err === 'object' && 'code' in err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return 'duplicate';
      }
      throw err;
    }
  }

  findById(id: string): PaymentRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, occurred_at, protocol, chain_id, payer_wallet,
                asset_address, asset_decimals, amount_atomic, amount_usd,
                endpoint, request_id, tx_hash, pin_request_id
         FROM payments WHERE id = ?`
      )
      .get(id) as PaymentRecord | undefined;
    return row ?? null;
  }

  summarizeWindow(window: PaymentWindow): PaymentSummary {
    const groupRows = this.db
      .prepare(
        `SELECT protocol, COUNT(*) AS n, COALESCE(SUM(amount_usd), 0) AS total_usd
         FROM payments
         WHERE occurred_at >= ? AND occurred_at < ?
         GROUP BY protocol`
      )
      .all(window.start, window.end) as Array<{ protocol: string; n: number; total_usd: number }>;

    const endpointRows = this.db
      .prepare(
        `SELECT endpoint, COUNT(*) AS n, COALESCE(SUM(amount_usd), 0) AS total_usd
         FROM payments
         WHERE occurred_at >= ? AND occurred_at < ?
         GROUP BY endpoint`
      )
      .all(window.start, window.end) as Array<{ endpoint: string; n: number; total_usd: number }>;

    const distinctRow = this.db
      .prepare(
        `SELECT COUNT(DISTINCT payer_wallet) AS n
         FROM payments
         WHERE occurred_at >= ? AND occurred_at < ?`
      )
      .get(window.start, window.end) as { n: number };

    const summary: PaymentSummary = {
      totalUsd: 0,
      count: 0,
      uniquePayers: distinctRow.n,
      byProtocol: {
        x402: { totalUsd: 0, count: 0 },
        mpp: { totalUsd: 0, count: 0 },
      },
      byEndpoint: {
        pin: { totalUsd: 0, count: 0 },
        retrieval: { totalUsd: 0, count: 0 },
      },
    };

    for (const row of groupRows) {
      summary.totalUsd += row.total_usd;
      summary.count += row.n;
      if (row.protocol === 'x402' || row.protocol === 'mpp') {
        summary.byProtocol[row.protocol] = { totalUsd: row.total_usd, count: row.n };
      }
    }

    for (const row of endpointRows) {
      if (row.endpoint === 'pin' || row.endpoint === 'retrieval') {
        summary.byEndpoint[row.endpoint] = { totalUsd: row.total_usd, count: row.n };
      }
    }

    return summary;
  }

  /**
   * Returns wallets whose ALL-TIME first payment occurred within the
   * window. The result is stable only when the window is fully closed —
   * i.e., no future payment with `occurred_at < window.start` can arrive
   * for a wallet that's currently a "first-time payer" in the window.
   *
   * This is stable for closed historical windows. For an open/in-progress
   * window, a late backfill with `occurred_at < window.start` can change
   * whether a payer is considered first-time.
   */
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
