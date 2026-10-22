import { describe, expect, it } from 'vitest';
import { Challenge } from 'mppx';
import { Store } from 'mppx/server';
import { createMppInstance } from '../../../src/services/payment/mpp';

const PAY_TO = '0x1111111111111111111111111111111111111111';
const SECRET_KEY = 'test-secret-key-at-least-32-bytes-long!';
const USDC_E_MAINNET = '0x20C000000000000000000000b9537d11c60E8b50';

describe('createMppInstance', () => {
  it('creates an mppx instance with charge handler', () => {
    const mppx = createMppInstance({ payTo: PAY_TO, secretKey: SECRET_KEY, store: Store.memory() });
    expect(typeof mppx.charge).toBe('function');
  });

  it('honours explicit realm for deterministic challenge binding', () => {
    const mppx = createMppInstance({
      payTo: PAY_TO,
      secretKey: SECRET_KEY,
      store: Store.memory(),
      realm: 'https://tack.example',
    });
    expect(mppx.realm).toBe('https://tack.example');
  });

  it('supports testnet mode', () => {
    const mppx = createMppInstance({ payTo: PAY_TO, secretKey: SECRET_KEY, store: Store.memory(), testnet: true });
    expect(typeof mppx.charge).toBe('function');
  });

  // Uses the real mppx server (not a stub) so a dependency bump that changes the 402 challenge is caught here.
  it('issues a Tempo charge challenge bound to the realm, recipient and amount', async () => {
    const mppx = createMppInstance({
      payTo: PAY_TO,
      secretKey: SECRET_KEY,
      store: Store.memory(),
      realm: 'tack.example',
    });

    const result = await mppx.charge({ amount: '0.001' })(new Request('https://tack.example/pins', { method: 'POST' }));

    expect(result.status).toBe(402);
    if (result.status !== 402) return;
    expect(result.challenge.headers.get('www-authenticate')).toMatch(/^Payment /);

    const challenge = Challenge.fromResponse(result.challenge);
    expect(challenge.realm).toBe('tack.example');
    expect(challenge.method).toBe('tempo');
    expect(challenge.intent).toBe('charge');
    expect(challenge.request).toMatchObject({
      amount: '1000',
      currency: USDC_E_MAINNET,
      recipient: PAY_TO,
      methodDetails: { chainId: 4217 },
    });
  });

  it('does not offer the unused session method', () => {
    const mppx = createMppInstance({ payTo: PAY_TO, secretKey: SECRET_KEY, store: Store.memory() });
    expect(mppx.methods.map((method) => `${method.name}/${method.intent}`)).toEqual(['tempo/charge']);
  });
});
