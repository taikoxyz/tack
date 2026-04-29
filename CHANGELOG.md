# Changelog

All notable user-facing changes to `tack` are documented in this file.

Format:
- Keep entries concise and focused on user impact.
- Group notes in this order: `Added`, `Changed`, `Fixed`, `Docs`, `Security`.
- Add a tagged section before pushing a release tag. The release workflow uses the matching section for GitHub Release notes.

## [Unreleased]

## [v0.2.5] - 2026-04-29

### Fixed
- Re-publishes the v0.2.4 fix with a synced `pnpm-lock.yaml`. The v0.2.4 docker build failed with `ERR_PNPM_OUTDATED_LOCKFILE` because the lockfile's top-level dependencies block was missing the new `@x402/extensions` entry, so v0.2.4 never produced an image and the prior deploy continued serving v0.2.3. v0.2.5 fixes that and is the first build to actually carry the bazaar-discovery extension.

## [v0.2.4] - 2026-04-29

### Fixed
- x402 paid endpoints (`POST /pins`, `POST /upload`) now declare `inputSchema` and `outputSchema` via the Bazaar discovery extension, so the resulting v2 `payment-required` challenge carries per-route schemas. mppscan.com / x402scan / Bazaar discovery validators previously flagged both endpoints as "Input schema is missing" / "Output schema is missing" because they read the live x402 challenge body, not the agent card or `/openapi.json`.

## [v0.2.3] - 2026-04-28

### Added
- Operator usage and revenue API: `GET /usage/summary`, `/usage/revenue`, `/usage/requests`, `/usage/pins`, `/usage/wallets`. Returns daily-aggregated revenue (split by protocol and endpoint), request counters (total / paid / `402`-rejected / free), pin counts and bytes, and paying-wallet metrics. UTC-day windows via `?start=YYYY-MM-DD&end=YYYY-MM-DD` (end exclusive); defaults to the last 7 days.
- Operator API key management: keys are stored hashed in a new `usage_api_keys` table and required on every `/usage/*` request via `X-API-Key` or `Authorization: Bearer`. Manage with `pnpm usage:key create|import|revoke|list`. Wallet bearer tokens (used for owner endpoints) do not authenticate the usage API.
- Agent skills under `skills/` for drop-in agent integration: `skills/tack-pinning` (pin / upload / retrieve / paywall / owner ops) and `skills/tack-usage-api` (operator metrics + key management).

### Changed
- `paymentResult.chainName` for x402 now emits human-readable names (`'taiko'`, `'base'`) instead of the raw `eip155:N` identifier, matching the MPP middleware's `chainName: 'tempo'` contract. Falls back to the raw network identifier for unknown chainIds.

### Fixed
- MPP charges that settle on-chain but whose handler later returns non-2xx (or throws) are now correctly recorded in the `payments` table and counted in `requests.paid`. Previously the success-path 2xx gate dropped them, causing revenue under-reporting on server-error executions.
- `/usage/*` requests no longer increment the `total` / `paid` / `rejected_402` counters, so a polling dashboard can no longer inflate the very metrics it reads.
- Usage API errors are now classified correctly: only window-validation errors return `400 bad_request`; SQLite or other runtime faults propagate as `500` instead of being misreported as client errors with raw error messages leaked.
- MPP USD→atomic conversion now routes through the canonical `usdToAssetAmount` helper, so MPP and x402 produce the same `payments.amount_atomic` for identical USD inputs at boundary amounts (`Number.EPSILON` guard + minimum-of-1 floor).
- x402: when payer wallet extraction fails, the middleware now skips setting `paymentResult` so the handler's header-based `requirePaidWallet(...)` fallback engages, instead of recording a `payer_wallet=''` row.

### Docs
- Operator `/usage/*` routes are no longer advertised in the public OpenAPI document, A2A agent card (`capabilities.usage` removed), README API table, or `/llms.txt`. The endpoints still work at the same paths but are no longer surfaced to discovery clients.

## [v0.2.2] - 2026-04-28

### Added
- `/.well-known/agent.json` now publishes a `routes` array per capability (pinningApi + gateway) with `inputSchema` / `outputSchema` (JSON Schema) for every route, plus a top-level `openapi: '/openapi.json'` pointer. Discovery validators (e.g. x402scan) can consume per-endpoint schemas directly from the agent card. The legacy `endpoints: string[]` field is kept for backward compatibility.

### Changed
- Public API and landing domain moved from `tack.taiko.xyz` to `tack.inferenceroom.ai`. Affects the `LANDING_URL` default, `/llms.txt` `base` fallback, README quickstart, deploy environment URLs, and request-URL test fixtures. Taiko-chain references (x402 facilitator, RPC, payment chain badges) are unchanged — payments still settle on Taiko Alethia.
- The MPP `realm` advertised in `WWW-Authenticate: Payment` challenges is now the origin **host** (e.g. `tack.inferenceroom.ai`) instead of the full origin URL. This restores on-chain attribution in x402scan / mppx discovery, which keys settled-volume stats by host.

## [v0.2.1] - 2026-04-23

### Added
- Tack now accepts x402 payments on Base mainnet (`eip155:8453`) alongside Taiko Alethia. The same endpoints (`POST /pins`, `POST /upload`, paywalled `GET /ipfs/:cid`) serve both chains — unpaid requests receive a single `402` whose `payment-required` header advertises Taiko USDC and Base USDC at the same USD price. Clients pay on whichever chain they already hold USDC. Base settlement uses the permissionless PayAI facilitator; no operator-side credentials required.
- The agent card at `/.well-known/agent.json` publishes one x402 protocol entry per supported chain (`chain: 'taiko'` and `chain: 'base'`), so agents can discover both at once.
- New `GET /openapi.json` serves an OpenAPI 3.1 document describing every route, payment info per endpoint (USD price range, supported protocols and chains derived from runtime config), and the wallet-auth bearer scheme for owner endpoints. Compatible with `@agentcash/discovery` so Tack deployments can be registered on [mppscan.com/discovery](https://mppscan.com/discovery).
- New `GET /llms.txt` endpoint serves a human- and agent-readable overview of the service: overview, pricing formula (including the max-price cap), authentication model, payment protocols, and endpoint list. Pricing values and MPP availability are interpolated from runtime config so the advertised rate always matches what clients are charged.

### Changed
- **Breaking (ops):** Settlement wallets are now configured per chain. `X402_PAY_TO` is replaced by `X402_TAIKO_PAY_TO`, `X402_BASE_PAY_TO`, and `MPP_PAY_TO` (the last required only when MPP is enabled). Reusing a single address across chains is unsafe when that address is a Safe or other contract wallet — CREATE2 addresses are deterministic but the contract must actually be deployed on each chain before funds sent to that address can be controlled. Operators must set each variable to an address they control on the target chain.
- Landing page rewritten to highlight the dual-rail (x402 + MPP) payment story and deployed via a dedicated Vercel preview + production workflow.

### Fixed
- `scripts/agent-live` now authenticates owner-endpoint calls (`GET /pins`, `GET /pins/:requestid`) with the bearer wallet-auth token issued by the paid pin response instead of replaying the x402 `payment-signature` header, which is not accepted on owner endpoints. The script also fails loudly when a freshly created pin is missing from the owner list rather than silently reporting success.
- `scripts/agent-live` preserves any path component (for example `/api/tack`) when deriving the effective API base URL, so subsequent requests no longer hit the wrong routes on deployments where the advertised endpoint includes a sub-path.

## [v0.2.0] - 2026-04-14

### Added
- Tack now accepts dual-protocol payments on `POST /pins`, `POST /upload`, and paywalled `GET /ipfs/:cid`: existing x402 clients on Taiko keep working unchanged, and MPP (Machine Payment Protocol) clients can pay on Tempo using USDC.e. Unpaid requests receive a single `402` response advertising both protocols — x402 via the `payment-required` header and MPP via a standards-compliant `WWW-Authenticate: Payment` challenge — so either client can pay without a second round-trip.
- The agent card at `/.well-known/agent.json` now publishes a `payments.protocols` array so agents can discover both protocols at once, including the Tempo chain ID, asset address, and asset symbol for the active network.
- New opt-in env vars: `MPP_SECRET_KEY` (enables MPP, 32+ byte HMAC secret), `MPP_TESTNET` (switches to Tempo Moderato), and `MPP_TEMPO_RPC_URL` (overrides the default Tempo RPC used for on-chain payer verification).

### Changed
- Wallet-auth JWTs issued after an MPP-paid request work transparently on owner endpoints (`GET /pins`, `DELETE /pins/:id`), so clients using MPP get the same ownership flow as x402.
- When MPP is not configured, the service is behavior-compatible with prior releases: the MPP middleware is never constructed, no Tempo RPC traffic is generated, and the agent card omits the MPP protocol block.

### Security
- **Ownership is derived from verified on-chain evidence, never from client-supplied credential metadata.** The MPP credential's optional `source` DID is client-controlled (spread unverified through `Credential.deserialize` and never checked by the Tempo `verify()` implementation), so trusting it would let a paying attacker forge `did:pkh:eip155:4217:<victim>` and mint owner-scoped JWTs for the victim. Tack now re-reads the settled Tempo transaction from RPC, locates the matching TIP-20 `Transfer`/`TransferWithMemo` event, and uses its `from` field as the canonical payer. Regression coverage lives in `tests/integration/app.test.ts > dual-protocol > ignores a forged credential.source`.

## [v0.1.6] - 2026-03-26

### Added
- Added Docker image publishing for both the Tack API and the companion Kubo image to Google Artifact Registry.

### Changed
- Pinning prices now scale linearly with file size and requested retention duration, and expired pins are automatically cleaned up after their paid term ends.
- Deployment artifacts are now oriented around containerized Kubernetes rollouts, including hardened non-root runtime defaults and semver-tagged image publishing.

### Fixed
- Kubo can now advertise its configured public swarm address so pinned content is reachable through public IPFS gateway discovery flows.

## [v0.1.4] - 2026-03-16

### Added
- Agent-native landing page now highlights paid pinning, the public gateway, and the `@x402/fetch` client flow for wallet-based integrations.
- The agent card now includes x402 spec links, the recommended client SDK, the payment header name, and wallet auth token usage details.

### Changed
- Paid pinning and upload endpoints now return structured x402 guidance in 402 responses so agents can discover the protocol, SDK, and next-step hints without reverse-engineering headers.
- 402 responses now consistently include request IDs, making production debugging easier across logs and client reports.

### Fixed
- Invalid but decodable payment proofs now return helpful JSON bodies instead of silent `{}` responses.

### Security
- Settlement-failure responses no longer leak wallet auth tokens, cache headers, or other protected-resource headers when payment does not complete.

## [v0.1.3] - 2026-03-15

### Fixed
- Release paid smoke now uses the bearer token issued by `POST /pins` when polling pin status, so CI validates the authenticated owner flow that production enforces.

## [v0.1.2] - 2026-03-15

### Fixed
- Canonical CID ownership now records the actual successful pin time so `replacePin` no longer backdates ownership to the original request creation timestamp.
- Retrieval paywall resolution no longer guesses a payout wallet from ambiguous legacy pin history when `cid_owners` is missing, preventing misrouted Taiko USDC settlements after database upgrades.

## [v0.1.1] - 2026-03-13

### Changed
- Tack now normalizes public request URLs at the app boundary so AgentCard metadata and x402 payment metadata use the correct public HTTPS origin behind Railway and other trusted proxies.

### Fixed
- Release smoke validation now covers the paid pinning flow more accurately before deployment promotion.

### Docs
- Added `PUBLIC_BASE_URL` guidance for deterministic public URL metadata in Railway deployments.

## [v0.1.0] - 2026-03-10

### Added
- IPFS Pinning Service API support for pin creation, listing, replacement, deletion, and upload-based pinning.
- Public IPFS gateway retrieval with `ETag` and `Range` handling plus an A2A agent card at `/.well-known/agent.json`.
- x402 payment authentication on Taiko Alethia for paid pinning flows, with bearer-token owner auth for follow-up pin management.
- SQLite-backed pin metadata, in-memory rate limiting, and optional best-effort replica pinning across additional Kubo nodes.

### Fixed
- Production startup validation now fails fast when x402 is disabled or configured with placeholder payout or asset addresses.
- Docker and Railway deployment paths are hardened around persistent `data/` storage and health checks.

### Docs
- Added Railway deployment and Taiko x402 smoke runbooks covering volumes, backups, rollback, and go-live validation.

[Unreleased]: https://github.com/taikoxyz/tack/compare/v0.2.1...HEAD
[v0.2.1]: https://github.com/taikoxyz/tack/releases/tag/v0.2.1
[v0.2.0]: https://github.com/taikoxyz/tack/releases/tag/v0.2.0
[v0.1.6]: https://github.com/taikoxyz/tack/releases/tag/v0.1.6
[v0.1.4]: https://github.com/taikoxyz/tack/releases/tag/v0.1.4
[v0.1.3]: https://github.com/taikoxyz/tack/releases/tag/v0.1.3
[v0.1.2]: https://github.com/taikoxyz/tack/releases/tag/v0.1.2
[v0.1.1]: https://github.com/taikoxyz/tack/releases/tag/v0.1.1
[v0.1.0]: https://github.com/taikoxyz/tack/releases/tag/v0.1.0
