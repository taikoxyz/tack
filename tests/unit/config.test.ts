import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getConfig } from '../../src/config';

const originalEnv = { ...process.env };
const realTaikoPayTo = '0x1111111111111111111111111111111111111111';
const realBasePayTo = '0x3333333333333333333333333333333333333333';
const realMppPayTo = '0x4444444444444444444444444444444444444444';
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

  it('requires WALLET_AUTH_TOKEN_SECRET', () => {
    setTestEnv({
      WALLET_AUTH_TOKEN_SECRET: ''
    });

    expect(() => getConfig()).toThrow('Missing required environment variable: WALLET_AUTH_TOKEN_SECRET');
  });

  it('fails fast in production when WALLET_AUTH_TOKEN_SECRET is weak', () => {
    setTestEnv({
      NODE_ENV: 'production',
      WALLET_AUTH_TOKEN_SECRET: 'change-me',
      X402_TAIKO_PAY_TO: realTaikoPayTo,
      X402_BASE_PAY_TO: realBasePayTo,
      X402_USDC_ASSET_ADDRESS: realUsdc
    });

    expect(() => getConfig()).toThrow('WALLET_AUTH_TOKEN_SECRET must be a strong random secret');
  });

  it('fails fast in production when X402_TAIKO_PAY_TO is a placeholder', () => {
    setTestEnv({
      NODE_ENV: 'production',
      WALLET_AUTH_TOKEN_SECRET: '0123456789abcdef0123456789abcdef',
      X402_TAIKO_PAY_TO: placeholderAddress,
      X402_BASE_PAY_TO: realBasePayTo,
      X402_USDC_ASSET_ADDRESS: realUsdc
    });

    expect(() => getConfig()).toThrow('X402_TAIKO_PAY_TO must be a real wallet address');
  });

  it('fails fast in production when X402_BASE_PAY_TO is a placeholder', () => {
    setTestEnv({
      NODE_ENV: 'production',
      WALLET_AUTH_TOKEN_SECRET: '0123456789abcdef0123456789abcdef',
      X402_TAIKO_PAY_TO: realTaikoPayTo,
      X402_BASE_PAY_TO: placeholderAddress,
      X402_USDC_ASSET_ADDRESS: realUsdc
    });

    expect(() => getConfig()).toThrow('X402_BASE_PAY_TO must be a real wallet address');
  });

  it('fails fast in production when X402_USDC_ASSET_ADDRESS is a placeholder', () => {
    setTestEnv({
      NODE_ENV: 'production',
      WALLET_AUTH_TOKEN_SECRET: '0123456789abcdef0123456789abcdef',
      X402_TAIKO_PAY_TO: realTaikoPayTo,
      X402_BASE_PAY_TO: realBasePayTo,
      X402_USDC_ASSET_ADDRESS: placeholderAddress
    });

    expect(() => getConfig()).toThrow('X402_USDC_ASSET_ADDRESS must be a real token address');
  });

  it('accepts explicit production x402 configuration', () => {
    setTestEnv({
      NODE_ENV: 'production',
      WALLET_AUTH_TOKEN_SECRET: '0123456789abcdef0123456789abcdef',
      X402_NETWORK: 'eip155:167000',
      X402_TAIKO_PAY_TO: realTaikoPayTo,
      X402_BASE_PAY_TO: realBasePayTo,
      X402_USDC_ASSET_ADDRESS: realUsdc,
      MPP_SECRET_KEY: '0123456789abcdef0123456789abcdef',
      MPP_PAY_TO: realMppPayTo
    });

    const config = getConfig();
    expect(config.x402Network).toBe('eip155:167000');
    expect(config.x402TaikoPayTo).toBe(realTaikoPayTo);
    expect(config.x402BasePayTo).toBe(realBasePayTo);
    expect(config.x402UsdcAssetAddress).toBe(realUsdc);
    expect(config.mppPayTo).toBe(realMppPayTo);
    expect(config.walletAuthTokenAudience).toBe('tack-owner-api');
    expect(config.walletAuthTokenIssuer).toBe('tack');
    expect(config.walletAuthTokenTtlSeconds).toBe(900);
  });

  it('allows production deploys without MPP_SECRET_KEY', () => {
    setTestEnv({
      NODE_ENV: 'production',
      WALLET_AUTH_TOKEN_SECRET: '0123456789abcdef0123456789abcdef',
      X402_TAIKO_PAY_TO: realTaikoPayTo,
      X402_BASE_PAY_TO: realBasePayTo,
      X402_USDC_ASSET_ADDRESS: realUsdc
    });

    const config = getConfig();
    expect(config.mppSecretKey).toBeUndefined();
  });

  it('fails fast in production when MPP_SECRET_KEY is too short', () => {
    setTestEnv({
      NODE_ENV: 'production',
      WALLET_AUTH_TOKEN_SECRET: '0123456789abcdef0123456789abcdef',
      X402_TAIKO_PAY_TO: realTaikoPayTo,
      X402_BASE_PAY_TO: realBasePayTo,
      X402_USDC_ASSET_ADDRESS: realUsdc,
      MPP_SECRET_KEY: 'tooshort',
      MPP_PAY_TO: realMppPayTo
    });

    expect(() => getConfig()).toThrow('MPP_SECRET_KEY must be at least 32 bytes');
  });

  it('fails fast in production when MPP is enabled but MPP_PAY_TO is a placeholder', () => {
    setTestEnv({
      NODE_ENV: 'production',
      WALLET_AUTH_TOKEN_SECRET: '0123456789abcdef0123456789abcdef',
      X402_TAIKO_PAY_TO: realTaikoPayTo,
      X402_BASE_PAY_TO: realBasePayTo,
      X402_USDC_ASSET_ADDRESS: realUsdc,
      MPP_SECRET_KEY: '0123456789abcdef0123456789abcdef'
    });

    expect(() => getConfig()).toThrow('MPP_PAY_TO must be a real wallet address when MPP is enabled');
  });

  it('rejects X402_NETWORK set to Base to prevent dedupe collision', () => {
    setTestEnv({
      WALLET_AUTH_TOKEN_SECRET: 'test-wallet-auth-secret',
      X402_NETWORK: 'eip155:8453'
    });

    expect(() => getConfig()).toThrow('X402_NETWORK cannot be eip155:8453');
  });

  it('parses replica URL lists', () => {
    setTestEnv({
      WALLET_AUTH_TOKEN_SECRET: 'test-wallet-auth-secret',
      PIN_REPLICA_IPFS_API_URLS: 'http://ipfs-a:5001, http://ipfs-b:5001',
      PIN_REPLICA_DELEGATE_URLS: 'https://gw-a.example/ipfs,https://gw-b.example/ipfs'
    });

    const config = getConfig();
    expect(config.pinReplicaIpfsApiUrls).toEqual(['http://ipfs-a:5001', 'http://ipfs-b:5001']);
    expect(config.pinReplicaDelegateUrls).toEqual(['https://gw-a.example/ipfs', 'https://gw-b.example/ipfs']);
  });

  it('parses PUBLIC_BASE_URL as an origin', () => {
    setTestEnv({
      WALLET_AUTH_TOKEN_SECRET: 'test-wallet-auth-secret',
      PUBLIC_BASE_URL: 'https://api.tack.example/'
    });

    const config = getConfig();
    expect(config.publicBaseUrl).toBe('https://api.tack.example');
  });

  it('fails when replica delegate URLs do not match replica API URL count', () => {
    setTestEnv({
      WALLET_AUTH_TOKEN_SECRET: 'test-wallet-auth-secret',
      PIN_REPLICA_IPFS_API_URLS: 'http://ipfs-a:5001,http://ipfs-b:5001',
      PIN_REPLICA_DELEGATE_URLS: 'https://gw-a.example/ipfs'
    });

    expect(() => getConfig()).toThrow(
      'PIN_REPLICA_DELEGATE_URLS must have the same number of entries as PIN_REPLICA_IPFS_API_URLS'
    );
  });

  it('rejects PUBLIC_BASE_URL values with paths', () => {
    setTestEnv({
      WALLET_AUTH_TOKEN_SECRET: 'test-wallet-auth-secret',
      PUBLIC_BASE_URL: 'https://api.tack.example/v1'
    });

    expect(() => getConfig()).toThrow('PUBLIC_BASE_URL must be an origin without path, query, or hash');
  });

  it('rejects non-positive wallet auth token ttl', () => {
    setTestEnv({
      WALLET_AUTH_TOKEN_SECRET: 'test-wallet-auth-secret',
      WALLET_AUTH_TOKEN_TTL_SECONDS: '0'
    });

    expect(() => getConfig()).toThrow('WALLET_AUTH_TOKEN_TTL_SECONDS must be a positive integer');
  });

  it('parses new pricing env vars with defaults', () => {
    setTestEnv({
      WALLET_AUTH_TOKEN_SECRET: 'test-wallet-auth-secret'
    });

    const config = getConfig();
    expect(config.x402RatePerGbMonthUsd).toBe(0.10);
    expect(config.x402MinPriceUsd).toBe(0.001);
    expect(config.x402MaxPriceUsd).toBe(50.0);
    expect(config.x402DefaultDurationMonths).toBe(1);
    expect(config.x402MaxDurationMonths).toBe(24);
  });

  it('parses custom pricing env vars', () => {
    setTestEnv({
      WALLET_AUTH_TOKEN_SECRET: 'test-wallet-auth-secret',
      X402_RATE_PER_GB_MONTH_USD: '0.10',
      X402_MIN_PRICE_USD: '0.002',
      X402_MAX_PRICE_USD: '25.0',
      X402_DEFAULT_DURATION_MONTHS: '6',
      X402_MAX_DURATION_MONTHS: '12'
    });

    const config = getConfig();
    expect(config.x402RatePerGbMonthUsd).toBe(0.10);
    expect(config.x402MinPriceUsd).toBe(0.002);
    expect(config.x402MaxPriceUsd).toBe(25.0);
    expect(config.x402DefaultDurationMonths).toBe(6);
    expect(config.x402MaxDurationMonths).toBe(12);
  });
});

describe('reporting config', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      WALLET_AUTH_TOKEN_SECRET: 'test-wallet-auth-secret'
    };
    delete process.env.WEEKLY_DIGEST_ENABLED;
    delete process.env.WEEKLY_DIGEST_CRON;
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.SLACK_SLASH_COMMAND_ENABLED;
    delete process.env.SLACK_SIGNING_SECRET;
    delete process.env.NOTION_API_KEY;
    delete process.env.NOTION_DATABASE_ID;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults reporting features to disabled', () => {
    delete process.env.WEEKLY_DIGEST_ENABLED;
    delete process.env.SLACK_SLASH_COMMAND_ENABLED;
    const cfg = getConfig();
    expect(cfg.weeklyDigestEnabled).toBe(false);
    expect(cfg.slackSlashCommandEnabled).toBe(false);
  });

  it('reads default WEEKLY_DIGEST_CRON of 0 9 * * 1', () => {
    delete process.env.WEEKLY_DIGEST_CRON;
    const cfg = getConfig();
    expect(cfg.weeklyDigestCron).toBe('0 9 * * 1');
  });

  it('rejects WEEKLY_DIGEST_ENABLED=true without SLACK_WEBHOOK_URL', () => {
    process.env.WEEKLY_DIGEST_ENABLED = 'true';
    delete process.env.SLACK_WEBHOOK_URL;
    process.env.NOTION_API_KEY = 'secret_x';
    process.env.NOTION_DATABASE_ID = 'db_x';
    expect(() => getConfig()).toThrow(/SLACK_WEBHOOK_URL/);
  });

  it('rejects WEEKLY_DIGEST_ENABLED=true without NOTION_API_KEY', () => {
    process.env.WEEKLY_DIGEST_ENABLED = 'true';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/x';
    delete process.env.NOTION_API_KEY;
    process.env.NOTION_DATABASE_ID = 'db_x';
    expect(() => getConfig()).toThrow(/NOTION_API_KEY/);
  });

  it('rejects WEEKLY_DIGEST_ENABLED=true without NOTION_DATABASE_ID', () => {
    process.env.WEEKLY_DIGEST_ENABLED = 'true';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/x';
    process.env.NOTION_API_KEY = 'secret_x';
    delete process.env.NOTION_DATABASE_ID;
    expect(() => getConfig()).toThrow(/NOTION_DATABASE_ID/);
  });

  it('rejects WEEKLY_DIGEST_ENABLED=true with invalid cron expression', () => {
    process.env.WEEKLY_DIGEST_ENABLED = 'true';
    process.env.WEEKLY_DIGEST_CRON = 'not-a-cron';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/x';
    process.env.NOTION_API_KEY = 'secret_x';
    process.env.NOTION_DATABASE_ID = 'db_x';
    expect(() => getConfig()).toThrow(/WEEKLY_DIGEST_CRON/);
  });

  it('accepts WEEKLY_DIGEST_ENABLED=true with all required env', () => {
    process.env.WEEKLY_DIGEST_ENABLED = 'true';
    process.env.WEEKLY_DIGEST_CRON = '0 9 * * 1';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/x';
    process.env.NOTION_API_KEY = 'secret_x';
    process.env.NOTION_DATABASE_ID = 'db_x';
    const cfg = getConfig();
    expect(cfg.weeklyDigestEnabled).toBe(true);
    expect(cfg.slackWebhookUrl).toBe('https://hooks.slack.com/x');
    expect(cfg.notionApiKey).toBe('secret_x');
    expect(cfg.notionDatabaseId).toBe('db_x');
  });

  it('rejects SLACK_SLASH_COMMAND_ENABLED=true without SLACK_SIGNING_SECRET', () => {
    process.env.SLACK_SLASH_COMMAND_ENABLED = 'true';
    delete process.env.SLACK_SIGNING_SECRET;
    expect(() => getConfig()).toThrow(/SLACK_SIGNING_SECRET/);
  });

  it('accepts SLACK_SLASH_COMMAND_ENABLED=true with signing secret', () => {
    process.env.SLACK_SLASH_COMMAND_ENABLED = 'true';
    process.env.SLACK_SIGNING_SECRET = 'shhh';
    const cfg = getConfig();
    expect(cfg.slackSlashCommandEnabled).toBe(true);
    expect(cfg.slackSigningSecret).toBe('shhh');
  });

  it('does not enforce reporting validation when both features are disabled', () => {
    process.env.WEEKLY_DIGEST_ENABLED = 'false';
    process.env.SLACK_SLASH_COMMAND_ENABLED = 'false';
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.SLACK_SIGNING_SECRET;
    delete process.env.NOTION_API_KEY;
    delete process.env.NOTION_DATABASE_ID;
    expect(() => getConfig()).not.toThrow();
  });
});
