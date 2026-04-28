import type { MetricsRepository } from '../../repositories/metrics-repository';
import type { PaymentRepository } from '../../repositories/payment-repository';
import type { PinRepository } from '../../repositories/pin-repository';

export interface UsageWindowInput {
  startDay?: string;
  endDayExclusive?: string;
}

export interface UsageWindow {
  start: string;
  end: string;
  startDay: string;
  endDayExclusive: string;
}

export interface UsageSummary {
  window: UsageWindow;
  generatedAt: string;
  revenue: {
    totalUsd: number;
    paymentCount: number;
    uniquePayers: number;
    byProtocol: {
      x402: { totalUsd: number; count: number };
      mpp: { totalUsd: number; count: number };
    };
    byEndpoint: {
      pin: { totalUsd: number; count: number };
      retrieval: { totalUsd: number; count: number };
    };
  };
  requests: {
    total: number;
    paid: number;
    rejected_402: number;
    free: number;
  };
  pins: {
    created: { count: number; totalBytes: number };
    active: { count: number; totalBytes: number };
  };
  wallets: {
    payersInWindow: number;
    cumulativePayers: number;
    firstTimePayersInWindow: string[];
  };
}

export interface UsageMetricsServiceDeps {
  payments: PaymentRepository;
  metrics: MetricsRepository;
  pins: PinRepository;
}

export type UsageClock = () => Date;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WINDOW_DAYS = 366;

function toUtcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toUtcDay(date);
}

function dayToIso(day: string): string {
  return `${day}T00:00:00.000Z`;
}

function parseDay(day: string, fieldName: string): Date {
  if (!DAY_RE.test(day)) {
    throw new Error(`${fieldName} must be a UTC day in YYYY-MM-DD format`);
  }

  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || toUtcDay(parsed) !== day) {
    throw new Error(`${fieldName} must be a valid UTC day in YYYY-MM-DD format`);
  }

  return parsed;
}

function resolveWindow(input: UsageWindowInput | undefined, now: Date): UsageWindow {
  const today = toUtcDay(now);
  const startDay = input?.startDay ?? addUtcDays(today, -6);
  const endDayExclusive = input?.endDayExclusive ?? addUtcDays(today, 1);

  const start = parseDay(startDay, 'start');
  const end = parseDay(endDayExclusive, 'end');
  const days = (end.getTime() - start.getTime()) / 86_400_000;

  if (days <= 0) {
    throw new Error('start must be before end');
  }

  if (days > MAX_WINDOW_DAYS) {
    throw new Error(`usage window must not exceed ${MAX_WINDOW_DAYS} days`);
  }

  return {
    start: dayToIso(startDay),
    end: dayToIso(endDayExclusive),
    startDay,
    endDayExclusive,
  };
}

export class UsageMetricsService {
  constructor(
    private readonly deps: UsageMetricsServiceDeps,
    private readonly clock: UsageClock = () => new Date()
  ) {}

  summary(input?: UsageWindowInput): UsageSummary {
    const now = this.clock();
    const window = resolveWindow(input, now);
    const paymentSummary = this.deps.payments.summarizeWindow({
      start: window.start,
      end: window.end,
    });
    const requestSummary = this.deps.metrics.summarizeWindow({
      startDay: window.startDay,
      endDayExclusive: window.endDayExclusive,
    });
    const pinSummary = this.deps.pins.summarize({
      start: window.start,
      end: window.end,
      now: now.toISOString(),
    });

    const paid = requestSummary.paid;
    const rejected = requestSummary.rejected_402;
    const free = Math.max(requestSummary.total - paid - rejected, 0);

    return {
      window,
      generatedAt: now.toISOString(),
      revenue: {
        totalUsd: paymentSummary.totalUsd,
        paymentCount: paymentSummary.count,
        uniquePayers: paymentSummary.uniquePayers,
        byProtocol: paymentSummary.byProtocol,
        byEndpoint: paymentSummary.byEndpoint,
      },
      requests: {
        total: requestSummary.total,
        paid,
        rejected_402: rejected,
        free,
      },
      pins: {
        created: pinSummary.newPinsInWindow,
        active: pinSummary.activePins,
      },
      wallets: {
        payersInWindow: paymentSummary.uniquePayers,
        cumulativePayers: this.deps.payments.cumulativeUniquePayers(),
        firstTimePayersInWindow: this.deps.payments.firstTimePayers({
          start: window.start,
          end: window.end,
        }),
      },
    };
  }
}
