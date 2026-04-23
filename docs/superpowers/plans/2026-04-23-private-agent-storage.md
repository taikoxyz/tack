# Private Agent Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add wallet-owned private object storage, SIWE wallet login, and x402/MPP payment support without changing the existing IPFS pinning API.

**Architecture:** Keep IPFS pinning separate from private storage. Add focused auth, repository, storage, and service modules, then wire them into the existing Hono app and payment middleware. Reuse the current wallet JWT as the session token and add SIWE/EIP-191 login so OWS and browser wallets can re-authenticate later.

**Tech Stack:** TypeScript, Hono, Vitest, better-sqlite3, viem, Node.js fs/crypto APIs, existing x402 and MPP middleware.

---

## File Map

- Create `src/repositories/wallet-auth-challenge-repository.ts`: SQLite persistence for one-time SIWE login challenges.
- Create `src/repositories/private-object-repository.ts`: SQLite persistence and owner-scoped queries for private object metadata.
- Create `src/services/wallet-login.ts`: SIWE message generation, challenge validation, EIP-191 verification, optional EIP-1271 verification hook.
- Create `src/services/private-object-storage.ts`: local filesystem object storage adapter plus storage interface.
- Create `src/services/private-object-service.ts`: private object business logic, object IDs, metadata, retention, owner checks, storage cleanup.
- Modify `src/db.ts`: create `wallet_auth_challenges` and `private_objects` tables plus indexes.
- Modify `src/config.ts`: add private storage path/limits and wallet-login RPC map config.
- Modify `src/services/payment/types.ts`: extend `PaymentResult` to cover x402 and settlement callbacks.
- Modify `src/services/x402.ts`: set x402 `paymentResult` and run settlement callbacks.
- Modify `src/app.ts`: add auth routes, private object routes, parsing helpers, and response helpers.
- Modify `src/index.ts`: instantiate new repositories/services; add x402/MPP requirements for private create/renew.
- Modify `src/types.ts`: add `PrivateObjectResponse` and agent-card private storage metadata.
- Modify `src/openapi.ts`, `README.md`, and `src/app.ts` discovery text for private storage.
- Test `tests/unit/wallet-login.test.ts`: SIWE and OWS-compatible auth behavior.
- Test `tests/unit/private-object-service.test.ts`: service/repository/storage behavior.
- Test `tests/unit/x402.test.ts`: x402 payment identity and settlement callbacks.
- Test `tests/integration/app.test.ts`: private object create/read/list/delete/renew and auth flows.
- Test `tests/unit/config.test.ts`: new env parsing.
- Test `tests/unit/openapi.test.ts`: private storage OpenAPI additions.

---

### Task 1: Add Persistence and Config Foundations

**Files:**
- Modify: `src/db.ts`
- Modify: `src/config.ts`
- Test: `tests/unit/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Add these tests to `tests/unit/config.test.ts`:

```ts
it('parses private storage defaults', () => {
  setTestEnv({
    WALLET_AUTH_TOKEN_SECRET: 'test-wallet-auth-secret'
  });

  const config = getConfig();
  expect(config.privateStoragePath).toBe('./data/private-objects');
  expect(config.privateObjectMaxSizeBytes).toBe(100 * 1024 * 1024);
  expect(config.walletAuthAllowedNetworks).toEqual(['eip155:167000', 'eip155:8453']);
  expect(config.walletAuthEip1271RpcUrls).toEqual({});
});

it('parses wallet auth EIP-1271 RPC URLs', () => {
  setTestEnv({
    WALLET_AUTH_TOKEN_SECRET: 'test-wallet-auth-secret',
    WALLET_AUTH_EIP1271_RPC_URLS: 'eip155:8453=https://base.example,eip155:167000=https://taiko.example'
  });

  const config = getConfig();
  expect(config.walletAuthEip1271RpcUrls).toEqual({
    'eip155:8453': 'https://base.example',
    'eip155:167000': 'https://taiko.example'
  });
});
```

- [ ] **Step 2: Run the config tests and verify they fail**

Run:

```bash
pnpm vitest run tests/unit/config.test.ts
```

Expected: FAIL because `privateStoragePath`, `privateObjectMaxSizeBytes`, `walletAuthAllowedNetworks`, and `walletAuthEip1271RpcUrls` do not exist yet.

- [ ] **Step 3: Implement config fields**

In `src/config.ts`, extend `AppConfig`:

```ts
privateStoragePath: string;
privateObjectMaxSizeBytes: number;
walletAuthAllowedNetworks: string[];
walletAuthEip1271RpcUrls: Record<string, string>;
```

Add parser:

```ts
function parseKeyValueMap(value: string | undefined, fieldName: string): Record<string, string> {
  if (!value) return {};
  const result: Record<string, string> = {};
  for (const item of parseList(value)) {
    const separator = item.indexOf('=');
    if (separator <= 0 || separator === item.length - 1) {
      throw new Error(`${fieldName} entries must use key=value`);
    }
    const key = item.slice(0, separator).trim();
    const mapValue = item.slice(separator + 1).trim();
    if (key.length === 0 || mapValue.length === 0) {
      throw new Error(`${fieldName} entries must use key=value`);
    }
    result[key] = mapValue;
  }
  return result;
}
```

In `getConfig()` set:

```ts
privateStoragePath: process.env.PRIVATE_STORAGE_PATH ?? './data/private-objects',
privateObjectMaxSizeBytes: parseNumber(
  process.env.PRIVATE_OBJECT_MAX_SIZE_BYTES,
  100 * 1024 * 1024,
  'PRIVATE_OBJECT_MAX_SIZE_BYTES'
),
walletAuthAllowedNetworks: parseList(process.env.WALLET_AUTH_ALLOWED_NETWORKS).length > 0
  ? parseList(process.env.WALLET_AUTH_ALLOWED_NETWORKS)
  : ['eip155:167000', 'eip155:8453'],
walletAuthEip1271RpcUrls: parseKeyValueMap(
  process.env.WALLET_AUTH_EIP1271_RPC_URLS,
  'WALLET_AUTH_EIP1271_RPC_URLS'
),
```

Validate `privateObjectMaxSizeBytes` is a positive integer like `walletAuthTokenTtlSeconds`.

- [ ] **Step 4: Add database tables**

In `src/db.ts`, add to the existing `db.exec()` block:

```sql
CREATE TABLE IF NOT EXISTS wallet_auth_challenges (
  nonce_hash TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  network TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  domain TEXT NOT NULL,
  uri TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private_objects (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  name TEXT,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  meta TEXT NOT NULL,
  payment_status TEXT NOT NULL CHECK(payment_status IN ('paid', 'pending', 'failed')),
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_wallet_auth_challenges_expires_at ON wallet_auth_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_private_objects_owner ON private_objects(owner);
CREATE INDEX IF NOT EXISTS idx_private_objects_created ON private_objects(created);
CREATE INDEX IF NOT EXISTS idx_private_objects_expires_at ON private_objects(expires_at);
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm vitest run tests/unit/config.test.ts
pnpm typecheck
```

Expected: PASS.

Commit:

```bash
git add src/config.ts src/db.ts tests/unit/config.test.ts
git commit -m "feat(config): add private storage settings"
```

---

### Task 2: Implement SIWE Wallet Login

**Files:**
- Create: `src/repositories/wallet-auth-challenge-repository.ts`
- Create: `src/services/wallet-login.ts`
- Modify: `src/app.ts`
- Modify: `src/index.ts`
- Test: `tests/unit/wallet-login.test.ts`
- Test: `tests/integration/app.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `tests/unit/wallet-login.test.ts` with tests for:

```ts
it('creates an OWS-compatible SIWE challenge from a CAIP-2 network', () => {
  const challenge = service.createChallenge({
    address: wallet,
    network: 'eip155:8453',
    origin: 'https://tack.example'
  });

  expect(challenge.network).toBe('eip155:8453');
  expect(challenge.chainId).toBe(8453);
  expect(challenge.message).toContain('Chain ID: 8453');
  expect(challenge.message).toContain('Sign in to Tack to access wallet-owned storage.');
});

it('rejects unsupported networks', () => {
  expect(() => service.createChallenge({
    address: wallet,
    network: 'solana:mainnet',
    origin: 'https://tack.example'
  })).toThrow('unsupported wallet auth network');
});

it('issues a wallet auth token for a valid EIP-191 signature', async () => {
  const challenge = service.createChallenge({
    address: wallet,
    network: 'eip155:8453',
    origin: 'https://tack.example'
  });
  const signature = await account.signMessage({ message: challenge.message });

  const result = await service.exchangeToken({ message: challenge.message, signature });

  expect(result.wallet).toBe(wallet.toLowerCase());
  expect(result.token).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
});

it('rejects replayed challenges', async () => {
  const challenge = service.createChallenge({
    address: wallet,
    network: 'eip155:8453',
    origin: 'https://tack.example'
  });
  const signature = await account.signMessage({ message: challenge.message });
  await service.exchangeToken({ message: challenge.message, signature });

  await expect(service.exchangeToken({ message: challenge.message, signature }))
    .rejects.toThrow('wallet auth challenge was already used');
});
```

- [ ] **Step 2: Run the wallet-login tests and verify they fail**

Run:

```bash
pnpm vitest run tests/unit/wallet-login.test.ts
```

Expected: FAIL because the repository and service do not exist yet.

- [ ] **Step 3: Add challenge repository**

Create `src/repositories/wallet-auth-challenge-repository.ts`:

```ts
import type Database from 'better-sqlite3';

export interface WalletAuthChallengeRecord {
  nonceHash: string;
  address: string;
  network: string;
  chainId: number;
  domain: string;
  uri: string;
  message: string;
  expiresAt: string;
  consumedAt: string | null;
  created: string;
}

export class WalletAuthChallengeRepository {
  constructor(private readonly db: Database.Database) {}

  create(record: WalletAuthChallengeRecord): void;
  findByNonceHash(nonceHash: string): WalletAuthChallengeRecord | null;
  consume(nonceHash: string, consumedAt: string): boolean;
  deleteExpired(now: string): number;
}
```

Implementation details:

- `create()` inserts every record field into `wallet_auth_challenges`.
- `findByNonceHash()` selects by `nonce_hash` and maps snake_case DB fields to camelCase records.
- `consume()` updates `consumed_at` only where `nonce_hash = ? AND consumed_at IS NULL` and returns whether one row changed.
- `deleteExpired()` deletes rows where `expires_at <= ?` and returns the number of deleted rows.

- [ ] **Step 4: Add wallet login service**

Create `src/services/wallet-login.ts` with:

```ts
export interface WalletLoginConfig {
  walletAuth: WalletAuthConfig;
  allowedNetworks: string[];
  eip1271RpcUrls: Record<string, string>;
  challengeTtlSeconds?: number;
  publicBaseUrl?: string;
}

export class WalletLoginService {
  createChallenge(input: { address: string; network?: string; chainId?: number; origin: string }): WalletLoginChallengeResponse;
  exchangeToken(input: { message: string; signature: string }): Promise<WalletLoginTokenResponse>;
}
```

Use `viem/accounts` test accounts in tests, and implementation helpers from `viem`:

```ts
import { createPublicClient, getAddress, hashMessage, http, isAddress, recoverMessageAddress } from 'viem';
```

For EOA verification:

```ts
const recovered = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
if (getAddress(recovered) === getAddress(record.address)) return true;
```

For EIP-1271 when a configured RPC URL exists, call `isValidSignature(bytes32,bytes)` against the requested address and accept magic value `0x1626ba7e`.

- [ ] **Step 5: Add auth endpoints**

In `src/app.ts`, extend `AppServices`:

```ts
walletLoginService?: WalletLoginService;
```

Add routes before paid routes:

```ts
app.post('/auth/challenge', async (c) => {
  if (!services.walletLoginService) throw new HTTPException(404);
  const body = await parseJsonBody(c);
  const challenge = services.walletLoginService.createChallenge({
    address: String((body as any).address ?? ''),
    network: typeof (body as any).network === 'string' ? (body as any).network : undefined,
    chainId: typeof (body as any).chainId === 'number' ? (body as any).chainId : undefined,
    origin: publicBaseUrl ?? new URL(c.req.url).origin
  });
  return c.json(challenge, 201, { 'Cache-Control': 'no-store' });
});

app.post('/auth/token', async (c) => {
  if (!services.walletLoginService) throw new HTTPException(404);
  const body = await parseJsonBody(c);
  const result = await services.walletLoginService.exchangeToken({
    message: String((body as any).message ?? ''),
    signature: String((body as any).signature ?? '')
  });
  c.header(WALLET_AUTH_TOKEN_RESPONSE_HEADER, result.token);
  c.header(WALLET_AUTH_TOKEN_EXPIRES_AT_RESPONSE_HEADER, result.expiresAt);
  c.header('Cache-Control', 'no-store');
  return c.json(result);
});
```

- [ ] **Step 6: Wire service in index**

In `src/index.ts`, instantiate:

```ts
const walletLoginService = new WalletLoginService(
  new WalletAuthChallengeRepository(db),
  {
    walletAuth: { secret, issuer, audience, ttlSeconds },
    allowedNetworks: config.walletAuthAllowedNetworks,
    eip1271RpcUrls: config.walletAuthEip1271RpcUrls,
    publicBaseUrl: config.publicBaseUrl
  }
);
```

Pass `walletLoginService` to `createApp`.

- [ ] **Step 7: Verify and commit**

Run:

```bash
pnpm vitest run tests/unit/wallet-login.test.ts tests/integration/app.test.ts
pnpm typecheck
```

Expected: PASS.

Commit:

```bash
git add src/repositories/wallet-auth-challenge-repository.ts src/services/wallet-login.ts src/app.ts src/index.ts tests/unit/wallet-login.test.ts tests/integration/app.test.ts
git commit -m "feat(auth): add SIWE wallet login"
```

---

### Task 3: Add Private Object Storage Core

**Files:**
- Create: `src/repositories/private-object-repository.ts`
- Create: `src/services/private-object-storage.ts`
- Create: `src/services/private-object-service.ts`
- Modify: `src/types.ts`
- Test: `tests/unit/private-object-service.test.ts`

- [ ] **Step 1: Write failing private storage tests**

Create `tests/unit/private-object-service.test.ts` with tests:

```ts
it('stores and reads a paid private object for the owner', async () => {
  const created = await service.createObject({
    owner,
    name: 'memory.json',
    contentType: 'application/json',
    meta: { purpose: 'memory' },
    content: new TextEncoder().encode('{"ok":true}'),
    durationMonths: 1,
    paymentStatus: 'paid'
  });

  const metadata = service.getObject(created.id, owner);
  const content = await service.getObjectContent(created.id, owner);

  expect(metadata.id).toBe(created.id);
  expect(content.content).toEqual(new TextEncoder().encode('{"ok":true}').buffer);
});

it('hides private objects from other wallets', async () => {
  const created = await service.createObject({ owner, content, contentType: 'text/plain', paymentStatus: 'paid' });
  expect(() => service.getObject(created.id, otherOwner)).toThrow('not found');
  await expect(service.getObjectContent(created.id, otherOwner)).rejects.toThrow('not found');
});

it('does not serve pending x402 objects', async () => {
  const created = await service.createObject({ owner, content, contentType: 'text/plain', paymentStatus: 'pending' });
  expect(() => service.getObject(created.id, owner)).toThrow('not found');
});

it('marks pending objects paid and then serves them', async () => {
  const created = await service.createObject({ owner, content, contentType: 'text/plain', paymentStatus: 'pending' });
  service.markPaid(created.id);
  expect(service.getObject(created.id, owner).id).toBe(created.id);
});

it('deletes stored bytes when an object is removed', async () => {
  const created = await service.createObject({ owner, content, contentType: 'text/plain', paymentStatus: 'paid' });
  await service.deleteObject(created.id, owner);
  await expect(storage.get(created.storageKey)).rejects.toThrow();
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm vitest run tests/unit/private-object-service.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Add repository**

Create `src/repositories/private-object-repository.ts` with:

```ts
export type PrivateObjectPaymentStatus = 'paid' | 'pending' | 'failed';

export interface StoredPrivateObjectRecord {
  id: string;
  owner: string;
  name: string | null;
  content_type: string;
  size_bytes: number;
  sha256: string;
  storage_key: string;
  meta: Record<string, string>;
  payment_status: PrivateObjectPaymentStatus;
  created: string;
  updated: string;
  expires_at: string | null;
}

export class PrivateObjectRepository {
  create(record: StoredPrivateObjectRecord): void;
  update(id: string, patch: Partial<Omit<StoredPrivateObjectRecord, 'id'>>): void;
  findById(id: string): StoredPrivateObjectRecord | null;
  findVisibleByIdAndOwner(id: string, owner: string, now: string): StoredPrivateObjectRecord | null;
  listByOwner(filters: PrivateObjectListFilters): PrivateObjectListResult;
  delete(id: string): boolean;
}
```

- [ ] **Step 4: Add local storage adapter**

Create `src/services/private-object-storage.ts`:

```ts
export interface PrivateObjectStorage {
  put(input: { key: string; content: ArrayBuffer; contentType: string }): Promise<{ sizeBytes: number; sha256: string }>;
  get(key: string): Promise<{ content: ArrayBuffer; sizeBytes: number }>;
  delete(key: string): Promise<void>;
}

export class LocalPrivateObjectStorage implements PrivateObjectStorage {
  constructor(private readonly rootDir: string) {}
}
```

Implementation rules:

- Use `mkdir(dirname(path), { recursive: true })`.
- Use `writeFile`, `readFile`, and `rm({ force: true })`.
- Reject keys containing `..` or absolute paths.
- Hash content with SHA-256 before writing.

- [ ] **Step 5: Add service**

Create `src/services/private-object-service.ts`:

```ts
export class PrivateObjectService {
  constructor(
    private readonly repository: PrivateObjectRepository,
    private readonly storage: PrivateObjectStorage
  ) {}

  async createObject(input: CreatePrivateObjectInput): Promise<StoredPrivateObjectRecord>;
  getObject(id: string, owner: string): StoredPrivateObjectRecord;
  async getObjectContent(id: string, owner: string): Promise<PrivateObjectContentResult>;
  listObjects(input: ListPrivateObjectsInput): { count: number; results: StoredPrivateObjectRecord[] };
  updateObject(id: string, owner: string, input: UpdatePrivateObjectInput): StoredPrivateObjectRecord;
  async deleteObject(id: string, owner: string): Promise<void>;
  markPaid(id: string): void;
  async markFailedAndDeleteBytes(id: string): Promise<void>;
  renewObject(id: string, owner: string, durationMonths: number): StoredPrivateObjectRecord;
}
```

Use `obj_${randomUUID()}` for object IDs and `objects/${id.slice(4, 6)}/${id}` for storage keys.

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm vitest run tests/unit/private-object-service.test.ts
pnpm typecheck
```

Expected: PASS.

Commit:

```bash
git add src/repositories/private-object-repository.ts src/services/private-object-storage.ts src/services/private-object-service.ts src/types.ts tests/unit/private-object-service.test.ts
git commit -m "feat(storage): add private object service"
```

---

### Task 4: Promote x402 Identity and Settlement Callbacks

**Files:**
- Modify: `src/services/payment/types.ts`
- Modify: `src/services/x402.ts`
- Modify: `src/app.ts`
- Test: `tests/unit/x402.test.ts`

- [ ] **Step 1: Write failing x402 middleware tests**

Add tests to `tests/unit/x402.test.ts`:

```ts
it('sets paymentResult for verified x402 requests', async () => {
  const app = new Hono<{ Variables: { paymentResult?: PaymentResult } }>();
  app.use(createX402PaymentMiddleware(testConfig, mockFacilitator));
  app.post('/pins', (c) => c.json({ wallet: c.get('paymentResult')?.wallet }));

  const paid = await paidX402Request(app, '/pins', wallet);

  expect(paid.status).toBe(200);
  expect(await paid.json()).toEqual({ wallet: wallet.toLowerCase() });
});

it('runs settlement failure callbacks when x402 settlement fails', async () => {
  let failed = false;
  const app = new Hono<{ Variables: { paymentSettlementCallbacks?: PaymentSettlementCallbacks[] } }>();
  app.use(createX402PaymentMiddleware(testConfig, failingSettlementFacilitator));
  app.post('/pins', (c) => {
    c.get('paymentSettlementCallbacks')?.push({ onSettlementFailure: () => { failed = true; } });
    return c.json({ ok: true });
  });

  const paid = await paidX402Request(app, '/pins', wallet);

  expect(paid.status).toBe(402);
  expect(failed).toBe(true);
});
```

- [ ] **Step 2: Run x402 tests and verify they fail**

Run:

```bash
pnpm vitest run tests/unit/x402.test.ts
```

Expected: FAIL because x402 does not set `paymentResult` and no callback array exists.

- [ ] **Step 3: Extend payment types**

In `src/services/payment/types.ts`, ensure:

```ts
export interface PaymentResult {
  wallet: string;
  protocol: 'x402' | 'mpp';
  chainName?: string;
}

export interface PaymentSettlementCallbacks {
  onSettlementSuccess?: () => void | Promise<void>;
  onSettlementFailure?: () => void | Promise<void>;
}
```

- [ ] **Step 4: Set x402 payment identity**

In `createPaymentMiddleware`, in the `payment-verified` branch before `await next()`:

```ts
const wallet = extractWalletFromPayload(paymentPayload);
if (wallet) {
  c.set('paymentResult' as any, {
    wallet,
    protocol: 'x402',
    chainName: paymentRequirements.network === 'eip155:8453' ? 'base' : 'taiko'
  } satisfies PaymentResult);
}
c.set('paymentSettlementCallbacks' as any, []);
```

- [ ] **Step 5: Run callbacks**

Add helper in `src/services/x402.ts`:

```ts
async function runSettlementCallbacks(
  callbacks: PaymentSettlementCallbacks[] | undefined,
  phase: 'success' | 'failure'
): Promise<void> {
  for (const callback of callbacks ?? []) {
    const fn = phase === 'success' ? callback.onSettlementSuccess : callback.onSettlementFailure;
    if (fn) await fn();
  }
}
```

Call success callbacks after successful settlement. Call failure callbacks when handler response status is `>= 400`, settlement returns failure, or settlement throws unexpectedly.

- [ ] **Step 6: Update app env types**

In `src/app.ts`, add:

```ts
paymentSettlementCallbacks?: import('./services/payment/types.js').PaymentSettlementCallbacks[];
```

- [ ] **Step 7: Verify and commit**

Run:

```bash
pnpm vitest run tests/unit/x402.test.ts
pnpm typecheck
```

Expected: PASS.

Commit:

```bash
git add src/services/payment/types.ts src/services/x402.ts src/app.ts tests/unit/x402.test.ts
git commit -m "feat(payments): expose x402 payer identity"
```

---

### Task 5: Wire Private Object Payment Requirements and Routes

**Files:**
- Modify: `src/app.ts`
- Modify: `src/index.ts`
- Modify: `src/services/x402.ts`
- Test: `tests/integration/app.test.ts`

- [ ] **Step 1: Write failing integration tests**

Add to `tests/integration/app.test.ts`:

```ts
it('creates and reads a paid private object', async () => {
  const body = new TextEncoder().encode('private memory');
  const createRes = await paidRequest(app, 'http://localhost/private/objects', walletA, () => {
    const form = new FormData();
    form.append('file', new File([body], 'memory.txt', { type: 'text/plain' }));
    return {
      method: 'POST',
      headers: {
        'x-content-size-bytes': String(body.byteLength),
        'x-storage-duration-months': '1'
      },
      body: form
    };
  });

  expect(createRes.status).toBe(201);
  const ownerToken = extractIssuedOwnerToken(createRes);
  const created = await createRes.json() as { id: string; name: string; size: number };
  expect(created.name).toBe('memory.txt');
  expect(created.size).toBe(body.byteLength);

  const contentRes = await app.request(new Request(`http://localhost/private/objects/${created.id}/content`, {
    headers: ownerAuthHeaders(ownerToken)
  }));
  expect(contentRes.status).toBe(200);
  expect(await contentRes.text()).toBe('private memory');
});

it('hides private objects from another wallet', async () => {
  const createRes = await createPrivateObjectAs(walletA, 'secret');
  const created = await createRes.json() as { id: string };
  const otherToken = createWalletAuthToken(walletB, walletAuthConfig).token;

  const hidden = await app.request(new Request(`http://localhost/private/objects/${created.id}`, {
    headers: ownerAuthHeaders(otherToken)
  }));

  expect(hidden.status).toBe(404);
});

it('requires x-wallet-auth-token for MPP renew owner auth', async () => {
  const createRes = await createPrivateObjectAs(walletA, 'secret');
  const ownerToken = extractIssuedOwnerToken(createRes);
  const created = await createRes.json() as { id: string };

  const renewRes = await mppPaidRequest(app, `http://localhost/private/objects/${created.id}/renew`, walletA, {
    headers: { 'x-wallet-auth-token': ownerToken, 'x-storage-duration-months': '1' }
  });

  expect(renewRes.status).toBe(200);
});
```

- [ ] **Step 2: Run integration tests and verify they fail**

Run:

```bash
pnpm vitest run tests/integration/app.test.ts
```

Expected: FAIL because private routes are not implemented.

- [ ] **Step 3: Add x402 paid routes**

In `src/services/x402.ts`, add route configs:

```ts
'POST /private/objects': {
  accepts: config.chains.map((chain) => ({
    scheme: 'exact' as const,
    network: chain.network,
    payTo: chain.payTo,
    extra: { name: chain.usdcDomainName, version: chain.usdcDomainVersion },
    price: (context) => {
      const sizeBytes = parseNonNegativeInteger(context.adapter.getHeader('x-content-size-bytes')) ?? 0;
      const durationMonths = parseDurationMonths(context.adapter.getHeader('x-storage-duration-months'), config.defaultDurationMonths, config.maxDurationMonths);
      return usdToAssetAmount(calculatePriceUsd(sizeBytes, durationMonths, config), chain.usdcAssetAddress, chain.usdcAssetDecimals);
    }
  })),
  description: 'Create private object',
  mimeType: 'application/json',
  unpaidResponseBody: makeUnpaidResponseBody('Store a private wallet-owned object.', config),
  settlementFailedResponseBody: makeSettlementFailedResponseBody()
}
```

Add `POST /private/objects/[objectId]/renew` with the same duration pricing and `sizeBytes` resolved from the existing object through an optional resolver passed into `createX402PaymentMiddleware`.

- [ ] **Step 4: Add app services and helpers**

In `src/app.ts`, extend `AppServices`:

```ts
privateObjectService?: PrivateObjectService;
privateObjectMaxSizeBytes?: number;
```

Add helpers:

```ts
function requirePrivateObjectService(services: AppServices): PrivateObjectService {
  if (!services.privateObjectService) throw new HTTPException(404, { message: 'private storage is not enabled' });
  return services.privateObjectService;
}
```

Implement multipart/raw parser that returns `{ content, name, contentType, meta, declaredSize }` and rejects when `X-Content-Size-Bytes` is missing or does not match actual object bytes.

- [ ] **Step 5: Add private routes**

Add these routes in `src/app.ts`:

- `POST /private/objects`: parse upload, require paid wallet, create object, issue wallet token, register x402 settlement callbacks when the object starts as `pending`, and return 201 metadata.
- `GET /private/objects`: require owner wallet, list visible paid objects for that owner, and return `{ count, results }`.
- `GET /private/objects/:objectId`: require owner wallet and return metadata for a visible paid object.
- `GET /private/objects/:objectId/content`: require owner wallet, return bytes with `Content-Type`, `Content-Length`, `ETag`, `Accept-Ranges`, `Cache-Control: private, no-store`, and `X-Content-Type-Options: nosniff`.
- `HEAD /private/objects/:objectId/content`: require owner wallet and return the same headers as `GET` without a body.
- `PATCH /private/objects/:objectId`: require owner wallet, parse `{ name?, meta? }`, update metadata, and return metadata.
- `DELETE /private/objects/:objectId`: require owner wallet, delete row and bytes, and return 202.
- `POST /private/objects/:objectId/renew`: require owner wallet, require paid wallet, reject when they differ, extend `expires_at`, and return metadata.

For x402 create, register settlement callbacks:

```ts
const callbacks = c.get('paymentSettlementCallbacks');
callbacks?.push({
  onSettlementSuccess: () => privateObjectService.markPaid(record.id),
  onSettlementFailure: () => privateObjectService.markFailedAndDeleteBytes(record.id)
});
```

For MPP create, pass `paymentStatus: 'paid'` because settlement already happened.

- [ ] **Step 6: Wire index**

In `src/index.ts`, instantiate:

```ts
const privateObjectRepository = new PrivateObjectRepository(db);
const privateObjectStorage = new LocalPrivateObjectStorage(config.privateStoragePath);
const privateObjectService = new PrivateObjectService(privateObjectRepository, privateObjectStorage);
```

Update x402 and MPP requirement resolvers for `/private/objects` and `/private/objects/:objectId/renew`.

- [ ] **Step 7: Verify and commit**

Run:

```bash
pnpm vitest run tests/integration/app.test.ts tests/unit/x402.test.ts
pnpm typecheck
```

Expected: PASS.

Commit:

```bash
git add src/app.ts src/index.ts src/services/x402.ts tests/integration/app.test.ts
git commit -m "feat(api): add private object routes"
```

---

### Task 6: Update Discovery, OpenAPI, and Docs

**Files:**
- Modify: `src/openapi.ts`
- Modify: `src/app.ts`
- Modify: `README.md`
- Test: `tests/unit/openapi.test.ts`
- Test: `tests/integration/app.test.ts`

- [ ] **Step 1: Write failing discovery tests**

Add assertions:

```ts
it('advertises private storage in the agent card', async () => {
  const res = await app.request('http://localhost/.well-known/agent.json');
  const card = await res.json() as { capabilities: { privateStorage: { storage: string; visibility: string } } };
  expect(card.capabilities.privateStorage.storage).toBe('not-ipfs');
  expect(card.capabilities.privateStorage.visibility).toBe('owner-authenticated');
});
```

Add OpenAPI test:

```ts
it('documents private object endpoints', () => {
  const doc = buildOpenApiDocument(input);
  const paths = doc.paths as Record<string, any>;
  expect(paths['/private/objects'].post.operationId).toBe('createPrivateObject');
  expect(paths['/private/objects/{objectId}/content'].get.security).toEqual([{ walletAuthToken: [] }]);
});
```

- [ ] **Step 2: Run discovery tests and verify they fail**

Run:

```bash
pnpm vitest run tests/unit/openapi.test.ts tests/integration/app.test.ts
```

Expected: FAIL because discovery docs do not include private storage yet.

- [ ] **Step 3: Update agent card and llms text**

In `src/app.ts`, add:

```ts
privateStorage: {
  storage: 'not-ipfs',
  visibility: 'owner-authenticated',
  endpoints: [
    '/private/objects',
    '/private/objects/:objectId',
    '/private/objects/:objectId/content'
  ],
  auth: {
    session: 'Authorization: Bearer <token>',
    walletLogin: ['/auth/challenge', '/auth/token']
  }
}
```

Update `/llms.txt` endpoint list with `/auth/challenge`, `/auth/token`, and private object endpoints.

- [ ] **Step 4: Update OpenAPI**

In `src/openapi.ts`, add paths:

- `POST /auth/challenge`
- `POST /auth/token`
- `POST /private/objects`
- `GET /private/objects`
- `GET /private/objects/{objectId}`
- `GET /private/objects/{objectId}/content`
- `HEAD /private/objects/{objectId}/content`
- `PATCH /private/objects/{objectId}`
- `DELETE /private/objects/{objectId}`
- `POST /private/objects/{objectId}/renew`

Use `walletAuthToken` security on owner routes and `x-payment-info` on paid create/renew routes.

- [ ] **Step 5: Update README**

Add a short "Private Storage" section:

```md
## Private Storage

Tack can also store wallet-owned private objects that are not pinned to IPFS. Create objects with `POST /private/objects` using x402 or MPP payment, then read them with `Authorization: Bearer <x-wallet-auth-token>`. Returning clients can authenticate through SIWE:

1. `POST /auth/challenge` with `{ "address": "0x...", "network": "eip155:8453" }`
2. Sign the returned message with a wallet or OWS:
   `ows sign message --chain eip155:8453 --message "$SIWE_MESSAGE" --json`
3. `POST /auth/token` with the message and signature.
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm vitest run tests/unit/openapi.test.ts tests/integration/app.test.ts
pnpm typecheck
```

Expected: PASS.

Commit:

```bash
git add src/openapi.ts src/app.ts README.md tests/unit/openapi.test.ts tests/integration/app.test.ts
git commit -m "docs(api): document private storage"
```

---

### Task 7: Full Verification

**Files:**
- Modify only files needed to fix verification failures.

- [ ] **Step 1: Run full check**

Run:

```bash
pnpm check
```

Expected: PASS for lint, typecheck, tests, and build.

- [ ] **Step 2: Run targeted OWS compatibility smoke**

Run:

```bash
ows sign message --help
```

Expected: help text includes `Sign a message with chain-specific formatting (EIP-191`.

- [ ] **Step 3: Inspect diff**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: clean worktree after final commit.

- [ ] **Step 4: Commit remaining fixes**

If verification produced fixes:

```bash
git add src tests README.md docs/superpowers/plans/2026-04-23-private-agent-storage.md
git commit -m "fix(storage): complete private storage verification"
```

If no fixes were needed, no commit is required.
