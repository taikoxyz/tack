# Tack

**Pin to IPFS. Pay with your wallet. No account needed.**

Tack is an IPFS pinning and retrieval service where payment *is* the authentication. No API keys, no signup, no monthly plans. Send a request with a wallet, pay per-use via [x402](https://www.x402.org/), and your content is pinned.

Built for AI agents, developer tooling, and any machine that needs to store data on IPFS without a human creating an account first.

## Why Tack?

| | Tack | Pinata (x402) | Pinata (Traditional) |
|---|---|---|---|
| Account required | **No** | Yes | Yes |
| API keys | **No** | Yes | Yes |
| Auth model | Wallet-only | Wallet + API key | API key |
| Pricing | **$0.001 base + $0.001/MB** | $0.10/GB x 12 months | $20-200+/mo subscription |
| Agent-to-Agent (A2A) | **Yes** | No | No |
| IPFS Pinning API spec | **Standard** | Custom | Standard |
| Payment chain | **Taiko Alethia** | Base | N/A |

Pinata uses x402 as a content monetization layer on top of their platform. Tack uses x402 as **the access layer itself**. The wallet is your identity. The payment is your auth.

## Quickstart

```bash
git clone <repo-url> && cd tack
pnpm install
cp .env.example .env
pnpm dev
```

The API runs at `http://localhost:3000`. IPFS (Kubo) must be running — use Docker Compose for the full stack:

```bash
docker compose up --build
```

This starts:
- **Tack API** on `http://localhost:3000`
- **Kubo IPFS** on `http://localhost:5001` (RPC) and `http://localhost:8080` (gateway)

## How x402 Payment Works

x402 turns HTTP 402 ("Payment Required") from a dead status code into a machine-readable payment protocol. Here's the flow:

```
Client                          Tack                         x402 Facilitator
  |                               |                                |
  |-- POST /pins {cid: "..."}  -->|                                |
  |<- 402 + payment requirements -|                                |
  |                               |                                |
  |-- settle payment ------------>|------------------------------->|
  |<- payment-signature ----------|                                |
  |                               |                                |
  |-- POST /pins {cid: "..."}  -->|                                |
  |   + payment-signature header  |                                |
  |<- 202 PinStatus ------------- |                                |
```

1. Client calls a paid endpoint (e.g., `POST /pins`).
2. Tack returns `402` with payment requirements (amount, asset, chain, receiver).
3. Client settles via the x402 facilitator and gets a `payment-signature`.
4. Client retries with `payment-signature` header. Tack verifies and processes.

No API keys exchanged. No OAuth. The wallet that paid is the wallet that owns the pin.

## For AI Agents (A2A)

Tack exposes an [Agent-to-Agent (A2A)](https://google.github.io/A2A/) compatible AgentCard at:

```
GET /.well-known/agent.json
```

This lets agent frameworks discover Tack's capabilities, endpoints, and payment requirements automatically. An AI agent with a wallet can find Tack, pin content, and pay — without any human in the loop.

## API Reference

### Health

```bash
# Check service health
curl http://localhost:3000/health
# 200: {"status":"ok","dependencies":{"ipfs":"ok"}}
# 503: {"status":"degraded","dependencies":{"ipfs":"unreachable"}}
```

### Pin Content (paid)

```bash
# First call returns 402 with payment requirements
curl -i -X POST http://localhost:3000/pins \
  -H 'content-type: application/json' \
  -d '{"cid":"bafybeigdyrzt...","name":"example.txt"}'

# After x402 payment, retry with signature
curl -i -X POST http://localhost:3000/pins \
  -H 'content-type: application/json' \
  -H 'payment-signature: <x402-payment-signature>' \
  -d '{"cid":"bafybeigdyrzt...","name":"example.txt","meta":{"env":"prod"}}'
# 202: PinStatus
```

### Upload File (paid)

```bash
curl -i -X POST http://localhost:3000/upload \
  -H 'payment-signature: <x402-payment-signature>' \
  -F 'file=@./example.txt'
# 201: {"cid":"bafy..."}
```

### List Pins

```bash
curl http://localhost:3000/pins?status=pinned&limit=20 \
  -H 'Authorization: Bearer <wallet-auth-token>'
# 200: {"count":1,"results":[...]}
```

Query params: `cid`, `name`, `status` (comma-separated), `before`, `after`, `limit` (1-1000), `offset`.

### Get Pin

```bash
curl http://localhost:3000/pins/<requestid> \
  -H 'Authorization: Bearer <wallet-auth-token>'
# 200: PinStatus
```

### Replace Pin

```bash
curl -i -X POST http://localhost:3000/pins/<requestid> \
  -H 'content-type: application/json' \
  -H 'Authorization: Bearer <wallet-auth-token>' \
  -d '{"cid":"bafybeinewcid...","name":"replacement.txt"}'
# 202: PinStatus
```

### Delete Pin

```bash
curl -i -X DELETE http://localhost:3000/pins/<requestid> \
  -H 'Authorization: Bearer <wallet-auth-token>'
# 202
```

### Retrieve Content (gateway)

```bash
# Full file
curl http://localhost:3000/ipfs/<cid>

# Byte range
curl http://localhost:3000/ipfs/<cid> -H 'range: bytes=0-1023'
```

Supports `ETag`, `If-None-Match` (304), and byte range requests (206).

### PinStatus Schema

```json
{
  "requestid": "uuid",
  "status": "queued|pinning|pinned|failed",
  "created": "2026-03-09T00:00:00.000Z",
  "pin": {
    "cid": "bafy...",
    "name": "optional-name",
    "origins": [],
    "meta": {}
  },
  "delegates": ["http://..."],
  "info": {
    "replication": {
      "replicas": [
        { "target": "replica-1", "status": "pinned" },
        { "target": "replica-2", "status": "failed", "error": "IPFS request failed" }
      ],
      "successfulReplicas": 1,
      "failedReplicas": 1
    }
  }
}
```

All errors return `{"error": "message"}` with standard HTTP codes (400, 401, 402, 404, 413, 429, 500, 502, 504).

## Authentication

Wallet identity comes from one of:

- **`payment-signature`** — x402 signed payment proof (for paid endpoints: `POST /pins`, `POST /upload`)
- **`Authorization: Bearer <token>`** — HS256-signed JWT with wallet in `sub` claim (for owner operations: list, get, replace, delete pins)

The wallet that pays for pinning owns the pin. Owner endpoints enforce wallet isolation — you can only see and manage your own pins.

## Reliability and Replication

- Primary durability comes from your main Kubo node (`IPFS_API_URL`) with persistent storage.
- Optional replicas can be configured through `PIN_REPLICA_IPFS_API_URLS` (comma-separated Kubo RPC endpoints).
- Replication is best-effort: primary pin success returns `pinned`; replica outcomes are reported in `PinStatus.info.replication`.
- `PIN_REPLICA_DELEGATE_URLS` (optional, 1:1 with replicas) publishes replica delegate URLs in the `delegates` response field.

## Configuration

All config is environment-driven. Copy `.env.example` to get started.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `IPFS_API_URL` | `http://ipfs:5001` | Kubo RPC URL |
| `PIN_REPLICA_IPFS_API_URLS` | — | Optional comma-separated replica Kubo RPC URLs |
| `PIN_REPLICA_DELEGATE_URLS` | — | Optional comma-separated delegate URLs matching replicas 1:1 |
| `IPFS_TIMEOUT_MS` | `30000` | Kubo RPC timeout |
| `DATABASE_PATH` | `./data/ipfs-manager.db` | SQLite path |
| `TRUST_PROXY` | `false` | Trust forwarded headers (only behind trusted proxy) |
| `UPLOAD_MAX_SIZE_BYTES` | `104857600` | Max upload size (100MB) |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `120` | Per-wallet/IP rate limit |
| `X402_ENABLED` | `false` | Enable x402 payments (must be `true` in production) |
| `X402_NETWORK` | `eip155:167000` | Chain ID (Taiko Alethia) |
| `X402_PAY_TO` | — | Settlement receiver wallet |
| `X402_USDC_ASSET_ADDRESS` | — | USDC contract on Taiko |
| `X402_BASE_PRICE_USD` | `0.001` | Base charge per operation |
| `X402_PRICE_PER_MB_USD` | `0.001` | Per-MB charge |
| `X402_MAX_PRICE_USD` | `0.01` | Price ceiling |

See `.env.example` for the full list with comments.

## Deployment

**Requirements**: Node.js 20+, Kubo IPFS node, persistent storage for SQLite.

```bash
# Build and run
pnpm install --frozen-lockfile
pnpm build
pnpm start

# Or with Docker
docker compose up -d --build
```

### Railway Baseline

For first production rollout on Railway (API + Kubo + persistent volumes), use:

- `docs/railway-deployment.md`

**Production checklist**:

1. Set `X402_ENABLED=true` — startup fails without it in production.
2. Set `X402_PAY_TO` to your treasury wallet and `X402_USDC_ASSET_ADDRESS` to the real Taiko USDC contract. Placeholder addresses are rejected at startup.
3. Keep `TRUST_PROXY=false` unless behind a trusted reverse proxy.
4. Terminate TLS at your reverse proxy / load balancer.
5. Mount persistent volumes for Kubo data and SQLite (`DATABASE_PATH`).
6. Use `/health` for liveness and readiness probes.

### Taiko x402 Smoke Validation

Before each go-live (or major payment change), run a real payment smoke test:

```bash
SMOKE_API_BASE_URL="https://<your-api-domain>" \
SMOKE_RPC_URL="https://rpc.mainnet.taiko.xyz" \
SMOKE_CHAIN_ID="167000" \
SMOKE_PAYER_PRIVATE_KEY="0x<funded-wallet-private-key>" \
pnpm smoke:x402
```

This validates `POST /pins` end-to-end: `402 -> pay -> retry`, plus settlement evidence from `payment-response`.

For full runbook steps, CI setup, and pass/fail criteria see:

- `docs/deployment-smoke.md`
- `.github/workflows/x402-taiko-smoke.yml`

## Architecture

```
src/
  index.ts              # Dependency wiring, config, process lifecycle
  app.ts                # Hono routes, middleware, request validation
  services/
    pinning-service.ts  # Pin create/list/get/replace/delete/upload logic
    ipfs-rpc-client.ts  # Kubo RPC integration
    x402.ts             # Wallet extraction, x402 middleware
    rate-limiter.ts     # Per-wallet/IP rate limiting
    content-cache.ts    # In-memory gateway cache
  repositories/
    pin-repository.ts   # SQLite persistence and query filtering
```

**Stack**: TypeScript, Hono, Kubo IPFS, x402 SDK, SQLite, Pino (structured logging).

Implements the [IPFS Pinning Service API](https://ipfs.github.io/pinning-services-api-spec/) spec with x402 payment enforcement and A2A agent discovery.

## License

MIT
