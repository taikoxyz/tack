import { describe, expect, it } from 'vitest';
import { InMemoryRateLimiter } from '../../src/services/rate-limiter';

function getBucketCount(limiter: InMemoryRateLimiter): number {
  return (limiter as unknown as { buckets: Map<string, unknown> }).buckets.size;
}

describe('InMemoryRateLimiter', () => {
  it('allows requests within the configured window and blocks excess', () => {
    const limiter = new InMemoryRateLimiter(2, 60_000);
    const now = Date.now();

    const first = limiter.consume('wallet:abc', now);
    const second = limiter.consume('wallet:abc', now + 1);
    const third = limiter.consume('wallet:abc', now + 2);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets limits after the window elapses', () => {
    const limiter = new InMemoryRateLimiter(1, 1000);
    const now = Date.now();

    const first = limiter.consume('wallet:abc', now);
    const second = limiter.consume('wallet:abc', now + 10);
    const afterReset = limiter.consume('wallet:abc', now + 1001);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(afterReset.allowed).toBe(true);
  });

  it('evicts expired buckets during periodic sweeps', () => {
    const limiter = new InMemoryRateLimiter(1, 1000, 2);
    const now = Date.now();

    limiter.consume('expired', now);
    expect(getBucketCount(limiter)).toBe(1);

    limiter.consume('active', now + 2000);
    expect(getBucketCount(limiter)).toBe(1);
  });
});
