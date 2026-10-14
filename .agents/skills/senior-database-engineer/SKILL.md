---
name: senior-database-engineer
description: "Use this skill for database schema designs, migrations, query performance optimization, indexing strategies, and transactional locking in MySQL 8. Activates when creating or modifying database tables, optimizing queries, designing immutable ledgers, balance caches, UOM conversions, or preventing deadlocks."
---

# Senior Database Engineering

MySQL 8 schema architecture, transactional concurrency, and indexing standards for POS, WMS, and DSD. Uses progressive disclosure—consult references below only when implementing schema or query logic.

## Core Directives
1. **Ledger & Cache Pattern**: Write append-only rows to `inventory_ledgers`; synchronize read-optimized `inventory_balances` in the same transaction. Never query `SUM(qty_change)` live.
2. **UOM Atomicity**: Store, calculate, and transfer all stock in the lowest base unit (integer pieces/eaches).
3. **Deadlock Prevention**: Sort item IDs ascending before calling `lockForUpdate()`.
4. **Data Types**: `DECIMAL(14, 4)` for money/prices, `INT` for base inventory, `CHAR(36)` for UUIDs.
5. **Relational Integrity & Zero Unlinked Data**: Every table relationship must be strictly constrained (`constrained()`, `foreignId()`). Child records must never exist without parents; transactional/ledger references must use `restrictOnDelete()` to prevent severed connections. Every foreign key and filter predicate must be indexed for query performance and maintainability.

## Reference Index
Consult only the relevant reference file for your current task:

| Topic / Requirement | Reference File |
| :--- | :--- |
| Immutable ledger schema, balance cache synchronization, triggers vs actions | [`references/ledger_and_balance_cache.md`](references/ledger_and_balance_cache.md) |
| Multi-UOM conversion factors, integer base units, zero floating-point math | [`references/uom_atomicity_conversions.md`](references/uom_atomicity_conversions.md) |
| Pessimistic locking (`lockForUpdate`), deadlock ordering, composite indexes | [`references/concurrency_locking_indexes.md`](references/concurrency_locking_indexes.md) |
