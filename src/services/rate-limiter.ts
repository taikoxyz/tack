export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  limit: number;
  remaining: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private consumeCalls = 0;

  constructor(
    private readonly limitPerWindow: number,
    private readonly windowMs: number,
    private readonly sweepEveryNCalls = 100
  ) {}

  private sweepExpiredBuckets(nowMs: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= nowMs) {
        this.buckets.delete(key);
      }
    }
  }

  consume(key: string, nowMs = Date.now()): RateLimitResult {
    this.consumeCalls += 1;
    if (this.consumeCalls % Math.max(this.sweepEveryNCalls, 1) === 0) {
      this.sweepExpiredBuckets(nowMs);
    }

    const normalizedKey = key.trim().toLowerCase();
    const existing = this.buckets.get(normalizedKey);

    if (!existing || existing.resetAt <= nowMs) {
      const resetAt = nowMs + this.windowMs;
      this.buckets.set(normalizedKey, { count: 1, resetAt });
      return {
        allowed: true,
        retryAfterSeconds: Math.ceil((resetAt - nowMs) / 1000),
        limit: this.limitPerWindow,
        remaining: Math.max(this.limitPerWindow - 1, 0)
      };
    }

    if (existing.count >= this.limitPerWindow) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((existing.resetAt - nowMs) / 1000),
        limit: this.limitPerWindow,
        remaining: 0
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      retryAfterSeconds: Math.ceil((existing.resetAt - nowMs) / 1000),
      limit: this.limitPerWindow,
      remaining: Math.max(this.limitPerWindow - existing.count, 0)
    };
  }
}
