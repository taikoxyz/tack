/**
 * Report shapes shared between digest-builder, slack-publisher,
 * notion-publisher, and slack-slash-handler.
 */

export interface ReportWindow {
  /** Inclusive ISO 8601 UTC */
  start: string;
  /** Exclusive ISO 8601 UTC */
  end: string;
}

export interface Report {
  window: ReportWindow;
  generatedAt: string;
  revenue: {
    totalUsd: number;
    byProtocol: {
      x402: { totalUsd: number; count: number };
      mpp: { totalUsd: number; count: number };
    };
  };
  pins: {
    newInWindow: { count: number; totalBytes: number };
    active: { count: number; totalBytes: number };
  };
  wallets: {
    payersInWindow: number;
    cumulativePayers: number;
    firstTimePayersInWindow: string[];
  };
  requests: {
    total: number;
    paid: number;
    rejected_402: number;
  };
}
