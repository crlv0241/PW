# Immutable Ledger & Balance Cache Architecture

## 1. The Write-Ahead Immutable Ledger
- **Role**: The single, authoritative source of truth for all physical stock movements.
- **Rules & Constraints**:
  - Rows are strictly **append-only and immutable**. Never update or delete ledger records.
  - Must record: `client_uuid` (unique index for idempotency), `location_id`, `product_id`, `qty_change` (signed integer in lowest base unit), transaction type (e.g., StockIn, Transfer, Sale, Adjustment), and timestamp.
  - Optional batch tracking: batch/lot number and expiration date for FIFO/FEFO tracking.

## 2. The Read-Optimized Balance Cache
- **Role**: High-speed, indexed snapshot of current on-hand quantities for live stock lookups.
- **Rules & Constraints**:
  - Maintained at the granular `(location_id, product_id)` level with a unique compound index.
  - Stores `current_qty` as an integer representing lowest base units.
  - **Negative Constraint**: Never calculate stock levels by running `SUM(qty_change)` on the ledger during live POS or order operations. Always read from the balance cache.

## 3. Transactional Synchronization Invariant
- Every physical movement MUST append a row to the ledger AND synchronously adjust the balance cache within the **same atomic database transaction**.
- Neither write may occur without the other.
