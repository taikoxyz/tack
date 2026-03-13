import { afterEach, describe, expect, it } from 'vitest';
import { getConfig } from '../../src/config';

const originalEnv = { ...process.env };
const realPayTo = '0x1111111111111111111111111111111111111111';
const realUsdc = '0x2222222222222222222222222222222222222222';
const placeholderAddress = '0x0000000000000000000000000000000000000001';

function setTestEnv(overrides: Record<string, string>): void {
  process.env = {
    ...originalEnv,
    ...overrides
  };
}

describe('config validation', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('fails fast in production when x402 is disabled', () => {
    setTestEnv({
      NODE_ENV: 'production',
      X402_ENABLED: 'false',
      X402_PAY_TO: realPayTo,
      X402_USDC_ASSET_ADDRESS: realUsdc
    });

    expect(() => getConfig()).toThrow('X402_ENABLED must be true');
  });

  it('fails fast in production when X402_PAY_TO is a placeholder', () => {
    setTestEnv({
      NODE_ENV: 'production',
      X402_ENABLED: 'true',
      X402_PAY_TO: placeholderAddress,
      X402_USDC_ASSET_ADDRESS: realUsdc
    });

    expect(() => getConfig()).toThrow('X402_PAY_TO must be a real wallet address');
  });

  it('fails fast in production when X402_USDC_ASSET_ADDRESS is a placeholder', () => {
    setTestEnv({
      NODE_ENV: 'production',
      X402_ENABLED: 'true',
      X402_PAY_TO: realPayTo,
      X402_USDC_ASSET_ADDRESS: placeholderAddress
    });

    expect(() => getConfig()).toThrow('X402_USDC_ASSET_ADDRESS must be a real token address');
  });

  it('accepts explicit production x402 configuration', () => {
    setTestEnv({
      NODE_ENV: 'production',
      X402_ENABLED: 'true',
      X402_NETWORK: 'eip155:167000',
      X402_PAY_TO: realPayTo,
      X402_USDC_ASSET_ADDRESS: realUsdc
    });

    const config = getConfig();
    expect(config.x402Enabled).toBe(true);
    expect(config.x402Network).toBe('eip155:167000');
    expect(config.x402PayTo).toBe(realPayTo);
    expect(config.x402UsdcAssetAddress).toBe(realUsdc);
  });

  it('parses replica URL lists', () => {
    setTestEnv({
      PIN_REPLICA_IPFS_API_URLS: 'http://ipfs-a:5001, http://ipfs-b:5001',
      PIN_REPLICA_DELEGATE_URLS: 'https://gw-a.example/ipfs,https://gw-b.example/ipfs'
    });

    const config = getConfig();
    expect(config.pinReplicaIpfsApiUrls).toEqual(['http://ipfs-a:5001', 'http://ipfs-b:5001']);
    expect(config.pinReplicaDelegateUrls).toEqual(['https://gw-a.example/ipfs', 'https://gw-b.example/ipfs']);
  });

  it('parses PUBLIC_BASE_URL as an origin', () => {
    setTestEnv({
      PUBLIC_BASE_URL: 'https://api.tack.example/'
    });

    const config = getConfig();
    expect(config.publicBaseUrl).toBe('https://api.tack.example');
  });

  it('fails when replica delegate URLs do not match replica API URL count', () => {
    setTestEnv({
      PIN_REPLICA_IPFS_API_URLS: 'http://ipfs-a:5001,http://ipfs-b:5001',
      PIN_REPLICA_DELEGATE_URLS: 'https://gw-a.example/ipfs'
    });

    expect(() => getConfig()).toThrow(
      'PIN_REPLICA_DELEGATE_URLS must have the same number of entries as PIN_REPLICA_IPFS_API_URLS'
    );
  });

  it('rejects PUBLIC_BASE_URL values with paths', () => {
    setTestEnv({
      PUBLIC_BASE_URL: 'https://api.tack.example/v1'
    });

    expect(() => getConfig()).toThrow('PUBLIC_BASE_URL must be an origin without path, query, or hash');
  });
});
