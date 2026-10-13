# Concurrency, Row Locking & Indexing Guide

## 1. Pessimistic Locking & Deadlock Prevention
- When modifying stock balances under concurrent transactions, acquire row locks via pessimistic locking (`lockForUpdate()`).
- **Deadlock Prevention Rule**: When updating multiple items in a single transaction (e.g., multi-line orders or stock transfers), always acquire locks in a **deterministic order** (e.g., sort product IDs in ascending numerical order) before executing queries.
- Consistent lock ordering across all concurrent processes eliminates circular lock waits (deadlocks).

## 2. High-Frequency Indexing Strategy
- Back all high-traffic queries with compound indexes matching exact `WHERE` clauses:
  - Balance Lookups: Unique index on `(location_id, product_id)`.
  - Ledger Movement Searches: Composite index on `(location_id, product_id, created_at)`.
  - Idempotency Deduplication: Unique index on `(client_uuid)`.
- Avoid wildcards or unindexed columns in filtering clauses.

## 3. Strict Column Types
- Financial amounts, prices, costs, and discounts: `DECIMAL(14, 4)` or `DECIMAL(12, 2)` (never `FLOAT`).
- Base inventory counts: `INT` or `BIGINT`.
- UUIDs: `CHAR(36)` with unique index.
