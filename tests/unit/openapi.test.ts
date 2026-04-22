import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from '../../src/openapi';
import type { AgentCardConfig } from '../../src/types';

const baseAgent: AgentCardConfig = {
  name: 'Tack',
  description: 'Pin to IPFS, pay with your wallet.',
  version: '0.2.0',
  x402Network: 'eip155:167000',
  x402UsdcAssetAddress: '0x07d83526730c7438048D55A4fc0b850e2aaB6f0b',
  x402RatePerGbMonthUsd: 0.1,
  x402MinPriceUsd: 0.001,
  x402MaxPriceUsd: 50,
  x402DefaultDurationMonths: 1,
  x402MaxDurationMonths: 24
};

const baseInput = {
  baseUrl: 'https://tack.example',
  uploadMaxSizeBytes: 100 * 1024 * 1024
};

describe('buildOpenApiDocument', () => {
  it('emits OpenAPI 3.1 with required top-level fields', () => {
    const doc = buildOpenApiDocument({ ...baseInput, agentCard: baseAgent });
    expect(doc.openapi).toBe('3.1.0');
    const info = doc.info as Record<string, unknown>;
    expect(info.title).toBe('Tack');
    expect(info.version).toBe('0.2.0');
    expect(typeof info['x-guidance']).toBe('string');
    expect((info['x-guidance'] as string).length).toBeGreaterThan(50);
    expect(doc.paths).toBeDefined();
  });

  it('marks paid endpoints with x-payment-info containing dynamic price and protocols', () => {
    const doc = buildOpenApiDocument({ ...baseInput, agentCard: baseAgent });
    const paths = doc.paths as Record<string, Record<string, Record<string, unknown>>>;
    const post = paths['/pins'].post;
    const payment = post['x-payment-info'] as Record<string, Record<string, unknown>>;
    expect(payment.price.mode).toBe('dynamic');
    expect(payment.price.currency).toBe('USD');
    expect(payment.price.min).toBe('0.001000');
    expect(payment.price.max).toBe('50.000000');
    const protocols = payment.protocols as Array<Record<string, unknown>>;
    expect(protocols).toHaveLength(1);
    expect(protocols[0]).toEqual({ x402: {} });
  });

  it('adds the mpp protocol entry only when agentCard.mppMethod is set', () => {
    const doc = buildOpenApiDocument({
      ...baseInput,
      agentCard: {
        ...baseAgent,
        mppMethod: 'tempo',
        mppAsset: '0x20C000000000000000000000b9537d11c60E8b50'
      }
    });
    const paths = doc.paths as Record<string, Record<string, Record<string, unknown>>>;
    const payment = paths['/upload'].post['x-payment-info'] as Record<string, unknown>;
    const protocols = payment.protocols as Array<Record<string, unknown>>;
    expect(protocols).toHaveLength(2);
    expect(protocols[1]).toEqual({
      mpp: {
        method: 'tempo',
        intent: 'charge',
        currency: '0x20C000000000000000000000b9537d11c60E8b50'
      }
    });
  });

  it('exposes owner endpoints behind the walletAuthToken apiKey scheme', () => {
    const doc = buildOpenApiDocument({ ...baseInput, agentCard: baseAgent });
    const paths = doc.paths as Record<string, Record<string, Record<string, unknown>>>;
    const get = paths['/pins'].get;
    expect(get.security).toEqual([{ walletAuthToken: [] }]);
    const components = doc.components as Record<string, Record<string, Record<string, unknown>>>;
    const scheme = components.securitySchemes.walletAuthToken;
    expect(scheme.type).toBe('apiKey');
    expect(scheme.in).toBe('header');
    expect(scheme.name).toBe('Authorization');
  });

  it('falls back to a generic guidance line when agentCard is omitted', () => {
    const doc = buildOpenApiDocument(baseInput);
    const guidance = (doc.info as Record<string, unknown>)['x-guidance'] as string;
    expect(guidance).toContain('agent.json');
  });
});
