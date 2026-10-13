# Offline Sync Security & Anti-Replay Guide

## 1. HMAC Signature & Payload Integrity
- Mobile edge applications compress SQLite sync payloads and compute an HMAC-SHA256 signature using a pre-shared device secret:
  `X-Device-Signature: <hmac_sha256_hash>`
- The Laravel middleware verifies the signature before decompressing the payload.

## 2. Anti-Replay & Timestamp Skew
- Every sync batch must supply a `timestamp` and unique `batch_uuid`.
- Reject payloads where timestamp differs by more than 15 minutes from server clock unless accompanied by an authorized offline time-sync token.
- Store processed `batch_uuid` in Redis or `idempotency_keys` table with a 30-day TTL to guarantee payloads cannot be re-executed twice.

## 3. Scoped Route Syncing
- When agents call `/api/sync/down`, data must be strictly scoped to their assigned `truck_location_id` and assigned route schedule.
- Never expose other truck inventories, global supplier costs, or non-assigned customer credit data.
