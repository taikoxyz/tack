import { x402Client } from '@x402/core/client';
import { x402HTTPClient } from '@x402/core/http';
import { toClientEvmSigner } from '@x402/evm';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { createPublicClient, defineChain, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

interface SmokeConfig {
  apiBaseUrl: string;
  rpcUrl: string;
  chainId: number;
  expectedNetwork: `eip155:${number}`;
  payerPrivateKey: Hex;
  cid: string;
  requestTimeoutMs: number;
}

interface PinStatusResponse {
  requestid: string;
  status: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePositiveNumber(name: string, raw: string | undefined, fallback: number): number {
  const value = raw?.trim();
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function normalizeHexPrivateKey(raw: string): Hex {
  const normalized = raw.startsWith('0x') ? raw : `0x${raw}`;

  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error('SMOKE_PAYER_PRIVATE_KEY must be a 32-byte hex private key');
  }

  return normalized as Hex;
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  const parsed = new URL(trimmed);

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('SMOKE_API_BASE_URL must use http or https');
  }

  return parsed.toString().replace(/\/$/, '');
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function parseConfig(): SmokeConfig {
  const chainId = parsePositiveNumber('SMOKE_CHAIN_ID', process.env.SMOKE_CHAIN_ID, 167000);

  return {
    apiBaseUrl: normalizeBaseUrl(process.env.SMOKE_API_BASE_URL?.trim() ?? 'http://localhost:3000'),
    rpcUrl: requiredEnv('SMOKE_RPC_URL'),
    chainId,
    expectedNetwork: `eip155:${chainId}`,
    payerPrivateKey: normalizeHexPrivateKey(requiredEnv('SMOKE_PAYER_PRIVATE_KEY')),
    cid: process.env.SMOKE_CID?.trim() || 'bafkreiabfiu4ij6y7h5xj4yx4f2x7v2m2w6w63s3u5xyd4uxw5k2j7f7de',
    requestTimeoutMs: parsePositiveNumber('SMOKE_REQUEST_TIMEOUT_MS', process.env.SMOKE_REQUEST_TIMEOUT_MS, 45000)
  };
}

async function run(): Promise<void> {
  const config = parseConfig();
  const account = privateKeyToAccount(config.payerPrivateKey);
  const chain = defineChain({
    id: config.chainId,
    name: 'Smoke Chain',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: [config.rpcUrl]
      }
    }
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl)
  });

  const signer = toClientEvmSigner(account, publicClient);
  const paymentClient = new x402HTTPClient(
    new x402Client().register('eip155:*', new ExactEvmScheme(signer))
  );

  const smokeRunId = `x402-smoke-${Date.now()}`;
  const pinRequestBody = {
    cid: config.cid,
    name: `${smokeRunId}.txt`,
    meta: {
      smokeRunId
    }
  };

  const pinsUrl = `${config.apiBaseUrl}/pins`;
  const unpaidResponse = await fetchWithTimeout(
    pinsUrl,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(pinRequestBody)
    },
    config.requestTimeoutMs
  );

  const unpaidBodyText = await unpaidResponse.text();
  if (unpaidResponse.status !== 402) {
    throw new Error(`Expected 402 from unpaid POST /pins, got ${unpaidResponse.status}. Body: ${unpaidBodyText}`);
  }

  const paymentRequired = paymentClient.getPaymentRequiredResponse((name) => unpaidResponse.headers.get(name));
  const acceptedRequirement = paymentRequired.accepts[0];

  if (!acceptedRequirement) {
    throw new Error('Payment requirements were empty');
  }

  if (acceptedRequirement.network !== config.expectedNetwork) {
    throw new Error(
      `Expected payment network ${config.expectedNetwork} but got ${acceptedRequirement.network}`
    );
  }

  const paymentPayload = await paymentClient.createPaymentPayload(paymentRequired);

  const paidResponse = await fetchWithTimeout(
    pinsUrl,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...paymentClient.encodePaymentSignatureHeader(paymentPayload)
      },
      body: JSON.stringify(pinRequestBody)
    },
    config.requestTimeoutMs
  );

  const paidBodyText = await paidResponse.text();
  if (paidResponse.status !== 202) {
    throw new Error(`Expected 202 from paid POST /pins, got ${paidResponse.status}. Body: ${paidBodyText}`);
  }

  let pinStatus: PinStatusResponse;
  try {
    pinStatus = JSON.parse(paidBodyText) as PinStatusResponse;
  } catch {
    throw new Error(`Expected JSON pin response but got: ${paidBodyText}`);
  }

  if (!pinStatus.requestid) {
    throw new Error(`Paid pin response missing requestid: ${paidBodyText}`);
  }

  const settlement = paymentClient.getPaymentSettleResponse((name) => paidResponse.headers.get(name));
  if (!settlement.success) {
    throw new Error(`Settlement did not succeed: ${JSON.stringify(settlement)}`);
  }

  if (settlement.network !== config.expectedNetwork) {
    throw new Error(
      `Expected settlement network ${config.expectedNetwork} but got ${settlement.network}`
    );
  }

  const settlementPayer = settlement.payer?.toLowerCase();
  if (settlementPayer && settlementPayer !== account.address.toLowerCase()) {
    throw new Error(
      `Expected settlement payer ${account.address.toLowerCase()} but got ${settlementPayer}`
    );
  }

  if (!settlement.transaction || !settlement.transaction.startsWith('0x')) {
    throw new Error(`Settlement missing transaction hash: ${JSON.stringify(settlement)}`);
  }

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        flow: '402 -> pay -> retry',
        requestId: pinStatus.requestid,
        pinStatus: pinStatus.status,
        paymentRequired: {
          network: acceptedRequirement.network,
          amount: acceptedRequirement.amount,
          asset: acceptedRequirement.asset,
          payTo: acceptedRequirement.payTo
        },
        settlement: {
          transaction: settlement.transaction,
          network: settlement.network,
          payer: settlement.payer,
          success: settlement.success
        }
      },
      null,
      2
    )
  );
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[x402-smoke] ${message}`);
  process.exitCode = 1;
});
