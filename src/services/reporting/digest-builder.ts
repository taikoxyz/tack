import type { PaymentRepository } from '../../repositories/payment-repository';
import type { MetricsRepository } from '../../repositories/metrics-repository';
import type { PinRepository } from '../../repositories/pin-repository';
import type { Report, ReportWindow } from './types';

export interface DigestBuilderDeps {
  payments: PaymentRepository;
  metrics: MetricsRepository;
  pins: PinRepository;
}

export interface DigestBuildInput {
  window: ReportWindow;
  /** ISO 8601 UTC — used to determine which pins are still active. */
  now: string;
  /** ISO 8601 UTC — recorded on the Report. */
  generatedAt: string;
}

/**
 * Pure function: aggregates a window into a Report.
 *
 * `firstTimePayers` is correct only when the window is fully closed
 * (no future payment can still arrive with `occurred_at` < window.start).
 * The weekly digest cron satisfies this by running on a window that
 * has already ended; do not call this for an open window if you need
 * idempotent reporting.
 */
export class DigestBuilder {
  constructor(private readonly deps: DigestBuilderDeps) {}

  build(input: DigestBuildInput): Report {
    const { payments, metrics, pins } = this.deps;
    const { window, now, generatedAt } = input;

    const paymentSummary = payments.summarizeWindow(window);
    const firstTimePayers = payments.firstTimePayers(window);
    const cumulativePayers = payments.cumulativeUniquePayers();
    const pinSummary = pins.summarize({ start: window.start, end: window.end, now });
    const requestsSummary = metrics.summarizeWindow({
      startDay: window.start.slice(0, 10),
      endDayExclusive: window.end.slice(0, 10),
    });

    return {
      window,
      generatedAt,
      revenue: {
        totalUsd: paymentSummary.totalUsd,
        byProtocol: paymentSummary.byProtocol,
      },
      pins: {
        newInWindow: pinSummary.newPinsInWindow,
        active: pinSummary.activePins,
      },
      wallets: {
        payersInWindow: paymentSummary.uniquePayers,
        cumulativePayers,
        firstTimePayersInWindow: firstTimePayers,
      },
      requests: requestsSummary,
    };
  }
}
