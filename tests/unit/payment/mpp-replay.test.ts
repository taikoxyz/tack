import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createClient, custom, encodeAbiParameters, encodeEventTopics, pad } from 'viem';
import { tempo as tempoChain } from 'viem/chains';
import { Abis } from 'viem/tempo';
import { Credential } from 'mppx';
import { Mppx, tempo } from 'mppx/server';
import { createDb } from '../../../src/db';
import { createSqliteMppStore } from '../../../src/services/payment/mpp-store';

// Drives the real mppx 0.4.12 charge verification (hash credentials) against Tack's SQLite store, with the
// Tempo RPC mocked. This is the replay protection that matters in production: a settled transaction hash must
// pay once, including after a restart.

const CURRENCY = '0x20C000000000000000000000b9537d11c60E8b50' as const;
const RECIPIENT = '0x1111111111111111111111111111111111111111' as const;
const SENDER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
const SECRET_KEY = 'test-secret-key-at-least-32-bytes-long!';
const TX_HASH = `0x${'de'.repeat(32)}` as const;
const AMOUNT_ATOMIC = 1000n; // $0.001 with 6 decimals

function rpcReceipt(): Record<string, unknown> {
  const topics = encodeEventTopics({
    abi: Abis.tip20,
    eventName: 'Transfer',
    args: { from: SENDER, to: RECIPIENT },
  });
  return {
    transactionHash: TX_HASH,
    blockHash: pad('0x01', { size: 32 }),
    blockNumber: '0x1',
    transactionIndex: '0x0',
    from: SENDER,
    to: CURRENCY,
    status: '0x1',
    type: '0x76',
    cumulativeGasUsed: '0x1',
    gasUsed: '0x1',
    effectiveGasPrice: '0x1',
    logsBloom: `0x${'00'.repeat(256)}`,
    contractAddress: null,
    logs: [
      {
        address: CURRENCY,
        topics,
        data: encodeAbiParameters([{ type: 'uint256' }], [AMOUNT_ATOMIC]),
        blockHash: pad('0x01', { size: 32 }),
        blockNumber: '0x1',
        transactionHash: TX_HASH,
        transactionIndex: '0x0',
        logIndex: '0x0',
        removed: false,
      },
    ],
  };
}

function mockClient() {
  return createClient({
    chain: tempoChain,
    transport: custom({
      request: ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return Promise.resolve(`0x${tempoChain.id.toString(16)}`);
        if (method === 'eth_getTransactionReceipt') return Promise.resolve(rpcReceipt());
        return Promise.reject(new Error(`unexpected rpc method ${method}`));
      },
    }),
  });
}

function createServer(db: ReturnType<typeof createDb>) {
  return Mppx.create({
    secretKey: SECRET_KEY,
    realm: 'tack.example',
    methods: [
      tempo.charge({
        currency: CURRENCY,
        recipient: RECIPIENT,
        store: createSqliteMppStore(db) as never,
        getClient: () => mockClient() as never,
      }),
    ],
  });
}

async function payWithHash(server: ReturnType<typeof createServer>) {
  const handler = server.charge({ amount: '0.001' });
  const challengeResult = await handler(new Request('https://tack.example/pins', { method: 'POST' }));
  if (challengeResult.status !== 402) throw new Error('expected a challenge');

  const header = challengeResult.challenge.headers.get('www-authenticate') as string;
  const { Challenge } = await import('mppx');
  const challenge = Challenge.deserialize(header);
  const credential = Credential.from({ challenge, payload: { type: 'hash', hash: TX_HASH } });

  return handler(
    new Request('https://tack.example/pins', {
      method: 'POST',
      headers: { Authorization: Credential.serialize(credential) },
    })
  );
}

describe('mppx charge replay protection with the SQLite store', () => {
  const dirs: string[] = [];

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'tack-mpp-replay-'));
    dirs.push(dir);
    return join(dir, 'tack.db');
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('accepts a settled transaction hash once and rejects the second use', async () => {
    const server = createServer(createDb(tempDbPath()));

    const first = await payWithHash(server);
    expect(first.status).toBe(200);

    const second = await payWithHash(server);
    expect(second.status).toBe(402);
  });

  it('still rejects the hash after a restart (new server and connection, same database file)', async () => {
    const path = tempDbPath();
    const before = createDb(path);
    expect((await payWithHash(createServer(before))).status).toBe(200);
    before.close();

    const afterRestart = createServer(createDb(path));
    expect((await payWithHash(afterRestart)).status).toBe(402);
  });
});
