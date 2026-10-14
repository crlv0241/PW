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

6. **Relational Integrity & Zero Orphaned / Unlinked Records**:
   - Whenever updating or creating database schemas, ALWAYS define explicit foreign key constraints (`constrained()`, `foreignId()`, `onDelete()`) reflecting the exact domain lifecycle.
   - NEVER permit records to be created without required parent links or left orphaned/unlinked across any table in the schema.
   - Use `cascadeOnDelete()` ONLY for strictly owned child entities (e.g., purchase order lines owned by purchase orders); use `restrictOnDelete()` for transactional, ledger, or master reference data (e.g., product, supplier, location, user references) to prevent accidental loss of historical records and broken linkages.
   - When modifying existing schemas, always audit all upstream and downstream table connections to guarantee that no existing or newly inserted data can become severed, dangling, or unlinked.

7. **Schema Performance by Design**:
   - Every foreign key column MUST have an explicit index (or lead a composite index) to ensure optimal join and lookup performance.
   - High-frequency query patterns (status filtering, date ranges, supplier lookups, tenant/location scoping) MUST have tailored compound indexes matching query predicate order (Equality first, Range second).
   - NEVER introduce unindexed table joins. Every table connection across the schema must be performant at enterprise scale.
   - Choose optimal column data types: use `UNSIGNED` for all auto-increment IDs and foreign keys; specify precise lengths for `VARCHAR`; use `DECIMAL(18, 4)` for money/rates; avoid unbounded types where structured types apply.

8. **Database-Wide Maintainability & Consistency**:
   - Enforce `NOT NULL` by default across all columns; only permit `nullable()` when domain business logic explicitly demands an optional state.
   - Enforce uniqueness at the database engine level via composite unique indexes (e.g. balance cache rows `(product_id, location_id)`, multi-UOM definitions, business reference numbers) rather than relying solely on application-layer validation.
   - Maintain uniform naming conventions: singular snake_case entity with `_id` suffix for all foreign keys (`supplier_id`, `product_id`, `purchase_order_id`).
   - Every schema change must be accompanied by comprehensive Pest test coverage validating cascade/restrict behaviors, index usage, and relational integrity across affected tables.
