import { describe, expect, it } from 'vitest';
import { createMppChainContext } from '../../../src/services/payment/mpp';

describe('createMppChainContext', () => {
  it('returns mainnet chain context', () => {
    const ctx = createMppChainContext(false);
    expect(ctx.chainId).toBe(4217);
    expect(ctx.assetAddress).toBe('0x20c000000000000000000000b9537d11c60e8b50');
    expect(ctx.assetDecimals).toBe(6);
  });

  it('returns testnet chain context with the correct moderato chainId', () => {
    const ctx = createMppChainContext(true);
    expect(ctx.chainId).toBe(42431);
    expect(ctx.assetAddress).toBe('0x20c0000000000000000000000000000000000000');
    expect(ctx.assetDecimals).toBe(6);
  });

  describe('endpointFor', () => {
    it('routes /ipfs/* to retrieval', () => {
      const ctx = createMppChainContext(false);
      expect(ctx.endpointFor('/ipfs/bafy123')).toBe('retrieval');
    });
    it('routes /pins to pin', () => {
      const ctx = createMppChainContext(false);
      expect(ctx.endpointFor('/pins')).toBe('pin');
    });
    it('routes /upload to pin', () => {
      const ctx = createMppChainContext(false);
      expect(ctx.endpointFor('/upload')).toBe('pin');
    });
    it('falls back to pin for unknown paths', () => {
      const ctx = createMppChainContext(false);
      expect(ctx.endpointFor('/some-other-thing')).toBe('pin');
    });
  });

  describe('atomicToUsd', () => {
    it('converts USDC.e atomic to USD', () => {
      const ctx = createMppChainContext(false);
      expect(ctx.atomicToUsd('1000000')).toBe(1);
      expect(ctx.atomicToUsd('500000')).toBe(0.5);
      expect(ctx.atomicToUsd('0')).toBe(0);
    });
    it('throws on malformed input', () => {
      const ctx = createMppChainContext(false);
      expect(() => ctx.atomicToUsd('abc')).toThrow(/invalid atomic amount/);
      expect(() => ctx.atomicToUsd('NaN')).toThrow(/invalid atomic amount/);
    });
  });
});
