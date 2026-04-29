---
name: tack-pinning
description: Use when an agent or user needs to pin a CID, upload a file, retrieve content, gate retrieval behind a paywall, or manage existing pins on Tack (the IPFS pinning service at tack.inferenceroom.ai). Covers payment, wallet auth, and all user-facing endpoints.
---

# Using Tack

Tack is an IPFS pinning service where **payment is the authentication**. There are no API keys, no signups, no accounts. The wallet that pays for a pin owns it.

**Production**: `https://tack.inferenceroom.ai`
**Spec**: [IPFS Pinning Service API](https://ipfs.github.io/pinning-services-api-spec/) compliant
**Discovery**: `GET /.well-known/agent.json` returns the live A2A card with current pricing and accepted protocols.

## When to Use

- You have a CID and want it pinned (`POST /pins`)
- You have a file and want it stored on the node and pinned (`POST /upload` then `POST /pins`)
- You want to fetch content by CID (`GET /ipfs/:cid`)
- You want to list, inspect, replace, or delete *your own* pins (`GET/POST/DELETE /pins/:requestid`)
- You want to charge other agents to retrieve your content (`meta.retrievalPrice`)

## The Payment Flow (one-shot)

Every paid endpoint works the same way:

1. Send the request **without** payment → server replies `402 Payment Required` with payment requirements (x402 in `payment-required` body, MPP in `WWW-Authenticate: Payment` header).
2. Pay using either protocol and **retry the same request** with the payment header attached.
3. On success, the response includes an `x-wallet-auth-token` header. Save it — that's your bearer token for owner endpoints.

**Two accepted protocols** (pick whichever your wallet supports — both are equivalent):
- **x402** (Taiko Alethia, USDC) — header `payment-signature`, signed via EIP-3009 `transferWithAuthorization`. Use the `@x402/core` + `@x402/evm` SDKs.
- **MPP** (Tempo, USDC.e) — header `Authorization: Payment ...`. Use the `mppx` SDK.

## Pricing

Dynamic per request: `max($0.001, sizeGB × $0.10 × durationMonths)`. Header `X-Pin-Duration-Months` (1–24, default 1) controls retention and **only applies to `POST /pins` and `POST /pins/:requestid`** — `/upload` itself is priced on bytes, not duration. The exact USD amount is in the 402 response — don't hardcode it.

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/pins` | payment | Body: `{cid, name?, origins?, meta?}`. For accurate size accounting on remote-pinned CIDs, also send `X-Content-Size-Bytes`. `X-Pin-Duration-Months` controls retention. |
| `POST` | `/upload` | payment | `multipart/form-data` with field `file`. **Stores the file and returns `{cid, size}` — does NOT create a pin record or assign ownership.** Always follow with `POST /pins` to actually pin it. |
| `GET` | `/ipfs/:cid` | none (or 402 if owner set `meta.retrievalPrice`) | Supports `Range`, `If-None-Match`/`ETag`. |
| `GET` | `/pins` | bearer | Query: `cid, name, status, before, after, limit (≤1000), offset`. |
| `GET` | `/pins/:requestid` | bearer | |
| `POST` | `/pins/:requestid` | bearer + payment | Replace a pin. **Full overwrite** — omitted fields (`name`, `origins`, `meta`) reset to empty. Always re-send everything you want to keep. |
| `DELETE` | `/pins/:requestid` | bearer | 202 on success. |

Bearer = `Authorization: Bearer <x-wallet-auth-token>`. Token is short-lived; **do any paid request again** (e.g., `POST /pins`) to mint a new one. There's no free refresh endpoint.

## Charging for Retrieval (paywall)

Set `meta.retrievalPrice` to a **stringified positive USD amount** when creating or replacing the pin (`meta` values must be strings). Example: `"meta": {"retrievalPrice": "0.05"}`. After that, `GET /ipfs/:cid` returns `402` with a runtime challenge instead of free bytes; payment is settled to the owner wallet.

`meta.retrievalPriceUsd` is accepted as an alias. Only the **first** wallet to pin a CID owns it and controls the price — later pinners can't redirect retrieval payouts.

## Example: Pin an existing CID (curl, after payment)

```bash
curl -X POST https://tack.inferenceroom.ai/pins \
  -H 'content-type: application/json' \
  -H 'X-Pin-Duration-Months: 6' \
  -H 'X-Content-Size-Bytes: 524288000' \
  -H 'payment-signature: <x402-signature-from-sdk>' \
  -d '{"cid":"bafybei...","name":"hello.txt","meta":{"retrievalPrice":"0.05"}}'
# 202 → response body has requestid + status; response headers include x-wallet-auth-token
```

## Example: Upload a file then pin it (TypeScript, x402)

```ts
import { x402HTTPClient } from '@x402/core/http';
import { x402Client } from '@x402/core/client';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { toClientEvmSigner } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

const base = 'https://tack.inferenceroom.ai';
const client = x402HTTPClient(x402Client({
  schemes: [ExactEvmScheme(toClientEvmSigner(privateKeyToAccount('0x...')))],
}));

// 1. Upload — server replies 402 first, client auto-pays + retries.
//    This stores the file and returns its CID. It does NOT pin or assign ownership yet.
const form = new FormData();
form.append('file', new Blob([bytes]), 'hello.txt');
const upRes = await client.fetch(`${base}/upload`, { method: 'POST', body: form });
const { cid, size } = await upRes.json();

// 2. Pin the CID under your wallet for 12 months. Send size so usage accounting is right.
const pinRes = await client.fetch(`${base}/pins`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-content-size-bytes': String(size),
    'x-pin-duration-months': '12',
  },
  body: JSON.stringify({ cid, name: 'hello.txt' }),
});
const token = pinRes.headers.get('x-wallet-auth-token')!;

// 3. List your pins (no payment needed; just the bearer token).
await fetch(`${base}/pins`, { headers: { authorization: `Bearer ${token}` } });
```

## Common Pitfalls

- **`POST /upload` doesn't pin**: It only stores bytes on the node and returns `{cid, size}`. Without a follow-up `POST /pins`, the CID has no pin record, no owner, and no retention guarantee. Always do both.
- **Size accounting**: For `POST /pins` with a CID you already have, `content-length` is the JSON envelope, not the file. Send `X-Content-Size-Bytes` so duration-based pricing and usage records are correct.
- **`X-Pin-Duration-Months` is for `/pins` only**: It has no effect on `/upload`.
- **Wallet identity ≠ `meta.source`**: For MPP, ownership is taken from the on-chain `Transfer` event — any client-supplied `source` field is ignored.
- **One-pin-per-CID ownership**: The first wallet that pins a CID owns it (and controls `meta.retrievalPrice`). A second pinner can't redirect retrieval payouts.
- **Token expiry**: `x-wallet-auth-token` expires. If owner endpoints start returning 401, run any paid request again — there's no free refresh.
- **Don't hardcode price**: Pricing is dynamic and may change. Always read the 402 challenge or `/.well-known/agent.json`.
- **`meta` values must be strings**: `meta.retrievalPrice` must be a stringified positive USD number (`"0.05"`, not `0.05`).
