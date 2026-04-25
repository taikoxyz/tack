# Usage & Revenue Reporting

**Status:** Approved (design)
**Date:** 2026-04-25
**Author:** Gustavo + Claude

## Goal

Surface usage stats and revenue from Tack without building a conventional dashboard. Two consumption modes:

1. **Weekly digest** — auto-posted to Slack and appended as a row to a Notion database every Monday.
2. **On-demand** — a Slack slash command (`/tack stats`) returns the same shape inline, for any window.

The design is minimal-surface: no new UI, no auth ceremony, no external dashboarding tool. Slack is for "what happened," Notion is the long-term ledger.

## Metrics in v1

The digest reports:

1. Total revenue (USD-equivalent across both chains).
2. Revenue split by protocol (x402/Taiko vs MPP/Tempo).
3. New pins this week (count + total bytes pinned).
4. Active pins / total bytes under management (cumulative).
5. Unique paying wallets (this window + cumulative).
6. Request volume (total / paid / 402-rejected).
7. New wallet first-payment events (welcome signal).

Explicitly out of v1: split by endpoint type, top-N paying wallets, top CIDs by retrieval, failed-pin/replication health. All easy to add later from the same raw data.

## Schema changes

### 1. New `payments` table — raw event log

```sql
CREATE TABLE IF NOT EXISTS payments (
  id              TEXT PRIMARY KEY,        -- ulid, generated locally
  occurred_at     TEXT NOT NULL,           -- ISO 8601 UTC
  protocol        TEXT NOT NULL CHECK(protocol IN ('x402', 'mpp')),
  chain_id        INTEGER NOT NULL,        -- 167000 Taiko, 4217 Tempo
  payer_wallet    TEXT NOT NULL,           -- lowercased 0x...
  asset_address   TEXT NOT NULL,           -- USDC contract
  asset_decimals  INTEGER NOT NULL,
  amount_atomic   TEXT NOT NULL,           -- string to preserve precision
  amount_usd      REAL NOT NULL,           -- normalized at payment time
  endpoint        TEXT NOT NULL CHECK(endpoint IN ('pin', 'retrieval')),
  request_id      TEXT,                    -- correlate to log line
  tx_hash         TEXT,                    -- mpp: settled hash; x402: optional
  pin_request_id  TEXT                     -- nullable, links pins.requestid
);
CREATE INDEX IF NOT EXISTS idx_payments_occurred_at ON payments(occurred_at);
CREATE INDEX IF NOT EXISTS idx_payments_payer_wallet ON payments(payer_wallet);
CREATE INDEX IF NOT EXISTS idx_payments_protocol ON payments(protocol);
```

Raw events (not pre-aggregated rollups) because volume is small and flexibility is high — any new metric can be derived from this table. `amount_atomic` preserves on-chain truth; `amount_usd` is what the digest reads. Dedup is keyed on `(protocol, tx_hash)` when `tx_hash` is present; for x402 without a tx hash, the ULID makes inserts naturally unique.

### 2. New `request_metrics_daily` table — counters

```sql
CREATE TABLE IF NOT EXISTS request_metrics_daily (
  day     TEXT NOT NULL,           -- 'YYYY-MM-DD' UTC
  bucket  TEXT NOT NULL,           -- 'total' | 'paid' | 'rejected_402'
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, bucket)
);
```

Updated via `INSERT ... ON CONFLICT(day, bucket) DO UPDATE SET count = count + 1` from the existing per-request middleware. SQLite single-writer makes this safe. Daily granularity (~1100 rows/year) preserves future flexibility for trivial cost.

### 3. `pins.size_bytes` column

```sql
ALTER TABLE pins ADD COLUMN size_bytes INTEGER;
CREATE INDEX IF NOT EXISTS idx_pins_size_bytes ON pins(size_bytes);
```

Populated from Kubo's `/api/v0/add` response (`Size` field) at pin creation. Migration follows the existing `expires_at` pattern in `db.ts`. Pre-existing rows stay `NULL`; the digest treats NULL as "unknown, exclude" rather than zero, so historical pins don't distort byte totals.

### Migration strategy

All three changes are additive — extend `createDb()` in `src/db.ts` following the existing pattern. No data loss, no downtime, no read-side fallback.

### Acknowledged limitation

Past payments are not recorded anywhere recoverable, so metrics start from deploy date. The first Notion row will cover a partial window. This is documented in the digest message itself for the first week.

## Components

```
src/
  repositories/
    payment-repository.ts        # CRUD + window-summary queries on `payments`
    metrics-repository.ts        # upsert + summary on `request_metrics_daily`
  services/
    reporting/
      payment-recorder.ts        # records a payment row from PaymentResult + price
      digest-builder.ts          # pure: aggregates a [start, end] window into a Report
      slack-publisher.ts         # outbound: post(report) → webhook POST for weekly digest;
                                 #           formatInline(report) → returns Slack response body
                                 #           shape for slash command replies
      notion-publisher.ts        # outbound: appends row via @notionhq/client
      slack-slash-handler.ts     # inbound: verifies signature, builds Report, replies
      weekly-digest-job.ts       # cron entrypoint: build → publish to Slack + Notion
```

### Boundaries

- **`digest-builder` is pure**: takes repo handles in, returns a typed `Report`. No I/O, no time source. Unit-testable against an in-memory SQLite with seeded rows.
- **Publishers are thin**: each takes a `Report`, makes one network call, returns ok/err. They never throw into the caller.
- **`payment-recorder` is synchronous on the request path**: a single SQLite `INSERT` is microseconds. No queue, no retries — if the row fails, the chain receipt is the source of truth, our row is bookkeeping. Failure logs at `error` and returns; the request still succeeds.

### Wiring changes

- **`services/payment/middleware.ts` (MPP) and `services/x402.ts`**: extend `PaymentResult` to carry `amount_atomic`, `asset_address`, `asset_decimals`, `endpoint`. Both sites already know the price at decision time.
- **`app.ts:435` (request-handled middleware)**: increments `request_metrics_daily` counters (`total` always; `paid` if `paymentResult` set; `rejected_402` if `c.res.status === 402`). After 2xx, calls `paymentRecorder.record()` if `paymentResult` is set.
- **`src/index.ts`**: boots `weekly-digest-job` if `WEEKLY_DIGEST_ENABLED=true`. Registers `POST /slack/commands/stats` if `SLACK_SLASH_COMMAND_ENABLED=true`.
- **`src/services/pinning-service.ts`**: captures `Size` from Kubo's add response and persists to `pins.size_bytes`.

### Slash command

Single new route, gated by config:

```
POST /slack/commands/stats
  ↓ verify X-Slack-Signature against SLACK_SIGNING_SECRET (timestamp ±5min, HMAC-SHA256)
  ↓ parse Slack form body; extract `text` arg:
    - "" or "week"  → last 7 days (rolling)
    - "today"       → since 00:00 UTC today
    - "month"       → last 30 days (rolling)
    - "wtd"         → current ISO week to now (matches what the next digest will report)
  ↓ digest-builder.build({start, end})
  ↓ slack-publisher.formatInline(report)
  → 200 with Slack response shape
```

Auth is the Slack signing secret. No wallet auth, no allowlist, no HTTP `/admin/stats` — channel membership is the access boundary, slash command output is the only surface. If CURL/CLI access is wanted later, add a bearer-token-protected endpoint then.

## Data flow

```
request → middleware → handler ─┐
                                ├→ payment-recorder → INSERT payments
                                └→ metrics middleware → UPSERT request_metrics_daily

cron (Mon 09:00 UTC) → weekly-digest-job
                       └→ digest-builder.build({start, end})
                          ├→ payment-repository.summarize()
                          ├→ pin-repository.summarize()  (new method)
                          └→ metrics-repository.summarize()
                       → Report
                       ├→ slack-publisher.post(Report)        → Slack webhook
                       └→ notion-publisher.append(Report)     → Notion DB row

slash command → POST /slack/commands/stats
              → verify signature
              → digest-builder.build(window)
              → slack-publisher.formatInline(Report)
              → response body
```

## Error handling

### Recorder (request-path)

- DB write fails → log `error` with full PaymentResult, return; never throw into the response. Worst case: under-counted revenue for that minute. Chain receipt still exists.
- Duplicate write → `INSERT OR IGNORE ON (protocol, tx_hash)` when `tx_hash` present; ULID guarantees uniqueness otherwise.
- Missing fields (shouldn't happen) → log and skip. Better an under-count than a garbage row.

### Counters

Single-statement upsert. If the connection is gone the request already failed.

### Weekly digest job

- Single replica in prod (per CLAUDE.md), no leader election needed.
- Slack publish fails → log `warn`, continue to Notion. Notion fails → log `warn`. Both fail → log `error`. Job never throws.
- **Idempotency for Notion**: natural key is the ISO week (e.g., `2026-W17`). Before insert, query Notion for an existing row with that key; skip if present. Manual re-runs are safe.
- **Crash recovery**: if the pod restarts mid-job, next scheduled tick re-runs. Slack may double-post (visible, harmless); Notion is protected by week-key check.

### Slash command

- Invalid/missing/expired signature → 401, no body leak.
- Window-arg parse failure → friendly error message in Slack response.
- Builder failure → ephemeral "Stats temporarily unavailable" in Slack response, full error logged.

## Configuration

Env-driven, extends the existing `config.ts` validation pattern.

```
WEEKLY_DIGEST_ENABLED=true|false           # default false
WEEKLY_DIGEST_CRON="0 9 * * 1"             # Mondays 09:00 UTC
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
SLACK_SLASH_COMMAND_ENABLED=true|false     # default false
SLACK_SIGNING_SECRET=...                   # required when slash enabled
NOTION_API_KEY=secret_...
NOTION_DATABASE_ID=...
```

When `WEEKLY_DIGEST_ENABLED=true`, `config.ts` requires Slack webhook + Notion creds non-empty. When `SLACK_SLASH_COMMAND_ENABLED=true`, requires `SLACK_SIGNING_SECRET`. Both unset → recording + counters still run, no external surface (useful for local dev).

`@notionhq/client` is the chosen Notion integration (~150 KB). Hand-rolled `fetch` was considered but rejected: Notion's block/property shape is opinionated enough that the SDK pays for itself in correctness.

Notion MCP was considered and rejected for this writer — MCP is for LLM clients to discover tools at runtime, not for a deterministic cron job making one HTTP call. (Notion MCP remains useful on the *consumption* side: pointing Claude at Notion to ask ad-hoc questions about the accumulated ledger. That's complementary, not part of this spec.)

## Testing

### Unit tests (`tests/unit/`)

- `payment-repository.test.ts` — insert; dedup on `(protocol, tx_hash)`; summarize-by-window queries.
- `metrics-repository.test.ts` — upsert increments; summarize across day boundaries.
- `digest-builder.test.ts` — seeded payments + pins + counters → expected `Report`. Edge cases: empty week, NULL `size_bytes` excluded from byte totals, first-payment detection (payer_wallets whose `MIN(occurred_at)` across the entire `payments` table falls within the window).
- `slack-publisher.test.ts` — Block Kit shape; fetch failure logs without throwing.
- `notion-publisher.test.ts` — week-key idempotency skips existing rows; SDK call shape mocked.
- `slack-slash-handler.test.ts` — valid signature passes; tampered/missing signature → 401; window arg parsing.

### Integration tests (`tests/integration/`)

- Recording: a paid request through both x402 and MPP middleware lands the right `payments` row.
- Counters: a 200, a 402, and a paid 200 increment `total`/`paid`/`rejected_402` correctly.
- End-to-end digest: seed data, invoke the job, assert mocked Slack got one Block Kit POST and mocked Notion got one row append.

No new test infra; Slack and Notion are mocked at the `fetch` / SDK boundary. Existing per-test SQLite setup applies.

## Rollout

1. **Ship schema + recorders + counters with publishers off** (`WEEKLY_DIGEST_ENABLED=false`, `SLACK_SLASH_COMMAND_ENABLED=false`). Verify `payments` accumulates in prod for a few days. No external surface — safe.
2. **Provision Slack webhook + Notion DB + signing secret.** Enable the slash command first (read-only, low blast radius). Sanity-check output.
3. **Enable the weekly job.** First Monday tick writes a partial-window row, documented in the message itself.

## Out of scope

- HTTP `/admin/stats` endpoint (deferred; add with bearer token if needed).
- Top-N paying wallets, endpoint splits, top-CID retrievals, health/anomaly metrics.
- Backfill of historical payments — not recoverable.
- Notion MCP setup for human/agent-side reading of the ledger — separate concern, may be a follow-up note.
