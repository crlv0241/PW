# Database & Ledger Invariants Rules

## Mandatory Database Constraints
These invariants supersede all general suggestions and must be enforced unconditionally across migrations, queries, and transactions:

1. **Write-Ahead Ledger Immutability**:
   - Rows in physical stock movement ledgers (`inventory_ledgers`) are strictly **append-only and immutable**.
   - NEVER execute `UPDATE` or `DELETE` statements on inventory ledger rows.
   - Variances or reversals must be recorded as new offsetting ledger entries.

2. **No Live Aggregation for Balance Checks**:
   - NEVER calculate live stock availability using `SUM(qty_change)` during POS sales, order drafting, or route queries.
   - ALWAYS read current stock directly from the indexed balance cache (`inventory_balances`).

3. **Lowest-Common-Denominator Unit Atomicity**:
   - All internal storage, transfers, arithmetic, and ledger rows must use the lowest indivisible base unit (integer pieces/eaches).
   - Discrete item stock counts must ALWAYS be stored as integer types (`INT` or `BIGINT`).
   - NEVER use `FLOAT` or `DOUBLE` for discrete inventory quantities.

4. **Transactional Coupling**:
   - NEVER mutate physical inventory state and financial (AR / payments) state in separate database operations.
   - ALWAYS wrap simultaneous physical and financial state mutations inside `DB::transaction()`.
   - NEVER perform external HTTP calls, file uploads, or slow network I/O inside open `DB::transaction()` blocks. Dispatch queued background jobs using `DB::afterCommit()`.

5. **Migration Rigor**:
   - NEVER modify committed/deployed migrations. Always create a new sequential migration to alter schemas.
   - ALWAYS provide a working, tested `down()` rollback method for every migration.
