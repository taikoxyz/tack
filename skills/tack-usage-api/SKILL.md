---
name: tack-usage-api
description: Use when an operator or admin needs to read service-level usage and revenue metrics from Tack (requests, paid/free counts, revenue by protocol/endpoint, paying-wallet stats, active/created pin bytes). Also covers issuing, listing, and revoking the operator API keys these endpoints require.
---

# Tack Usage API (Operator)

Service-wide metrics for the Tack operator. **Not** for end-user pin data — that's `GET /pins` with a wallet bearer token (see the **tack-pinning** skill). The Usage API exposes aggregate revenue and request counts and is gated by an operator API key, not a wallet.

**Production**: `https://tack.inferenceroom.ai`

## When to Use

- Reporting daily/weekly revenue, broken down by protocol (x402 vs MPP) and endpoint (`pin`, `retrieval`, `private_object`, `private_object_renewal`)
- Counting requests, paid vs free vs `402` rejections
- Tracking active vs created pin counts and total bytes
- Tracking unique paying wallets and first-time payers in a window

## Authentication

Pass the API key on every request, either:

```
X-API-Key: tack_<rest-of-key>
```

or

```
Authorization: Bearer tack_<rest-of-key>
```

Keys are stored hashed in the `usage_api_keys` table. The raw key is shown **once** at creation — store it immediately. Missing/revoked keys → `401 unauthorized`.

## Managing Keys (operator-side, requires repo + DB access)

```bash
pnpm usage:key create <name>     # prints { name, apiKey } once — copy it now
pnpm usage:key import <name>     # bring an existing key under management; key is read from stdin
pnpm usage:key revoke <name>     # disables future use; existing requests with the key fail 401
pnpm usage:key list              # id, name, created_at, last_used_at, revoked_at (no key material)
```

`DATABASE_PATH` defaults to `./data/tack.db`.

## Endpoints

All return JSON with `Cache-Control: no-store`. All accept the same window query parameters.

| Path | Returns |
|---|---|
| `GET /usage/summary` | Full payload: `window`, `generatedAt`, `revenue`, `requests`, `pins`, `wallets`. |
| `GET /usage/revenue` | `revenue` only (totalUsd, paymentCount, uniquePayers, byProtocol, byEndpoint). |
| `GET /usage/requests` | `requests` only (total, paid, rejected_402, free). |
| `GET /usage/pins` | `pins` only (created/active counts and totalBytes). |
| `GET /usage/wallets` | `wallets` only: `payersInWindow` (count, in-window), `cumulativePayers` (count, all-time since metrics recording began), `firstTimePayersInWindow` (array of wallet addresses whose first-ever payment landed in this window). |

## Window Query Parameters

| Param | Format | Behavior |
|---|---|---|
| `start` | `YYYY-MM-DD` (UTC day) | Inclusive. Default: 6 days before today. |
| `end` | `YYYY-MM-DD` (UTC day) | **Exclusive**. Default: tomorrow (so today is included). |

Constraints:
- Both must be valid UTC days; `start < end`; max window **366 days**.
- Granularity is **per UTC day** — sub-day timestamps are intentionally rejected. Today's bucket updates live as requests come in, so to read "today so far" use `start=<today>&end=<tomorrow>`.
- Defaults give "the last 7 UTC days including today" when both are omitted.
- Invalid inputs return `400 bad_request` with a `message` field.

## Example

```bash
KEY='tack_...'   # the raw key from `pnpm usage:key create`

# Last 7 days (default window)
curl -H "X-API-Key: $KEY" https://tack.inferenceroom.ai/usage/summary

# Specific week — Apr 21 through Apr 27 inclusive
curl -H "X-API-Key: $KEY" \
  "https://tack.inferenceroom.ai/usage/revenue?start=2026-04-21&end=2026-04-28"

# Today so far (UTC)
curl -H "X-API-Key: $KEY" \
  "https://tack.inferenceroom.ai/usage/requests?start=2026-04-28&end=2026-04-29"
```

## Response Shape (summary)

```json
{
  "window": { "start": "2026-04-21T00:00:00.000Z", "end": "2026-04-28T00:00:00.000Z",
              "startDay": "2026-04-21", "endDayExclusive": "2026-04-28" },
  "generatedAt": "2026-04-28T12:00:00.000Z",
  "revenue": {
    "totalUsd": 12.34, "paymentCount": 42, "uniquePayers": 9,
    "byProtocol": { "x402": { "totalUsd": 10.0, "count": 30 },
                    "mpp":  { "totalUsd":  2.34, "count": 12 } },
    "byEndpoint": { "pin":                    { "totalUsd": 12.0, "count": 40 },
                    "retrieval":              { "totalUsd":  0.34, "count":  2 },
                    "private_object":         { "totalUsd":  1.20, "count":  4 },
                    "private_object_renewal": { "totalUsd":  0.40, "count":  1 } }
  },
  "requests": { "total": 500, "paid": 42, "rejected_402": 18, "free": 440 },
  "pins":     { "created": { "count": 40, "totalBytes": 12345678 },
                "active":  { "count": 200, "totalBytes": 98765432 } },
  "wallets":  { "payersInWindow": 9, "cumulativePayers": 31, "firstTimePayersInWindow": ["0xabc..."] }
}
```

## Common Pitfalls

- **Wrong auth model**: Wallet bearer tokens (from paying for a pin) do **not** work here. The Usage API needs an operator key.
- **`end` is exclusive**: Asking for one day means `start=2026-04-21&end=2026-04-22`.
- **Day-granular only**: There's no hour or minute window — `2026-04-21T12:00:00Z` is rejected. Aggregate at day boundaries.
- **Metrics are forward-only**: Counters started recording from the deploy that introduced them. Payments and requests before that deploy are not retroactively visible.
- **Lost a raw key**: There's no recovery — keys are stored hashed. Revoke and create a new one.
