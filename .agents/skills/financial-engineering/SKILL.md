---
name: financial-engineering
description: "Use this skill when designing or implementing monetary calculations, currency storage, pricing matrices, discount pipelines, tax calculations, double-entry ledgers, accounts receivable (AR), cash drawer management, and financial reconciliation in Laravel, PHP 8.4, and TypeScript. Activates when working with money, payments, taxes, invoices, rounding, or credit balances."
---

# Financial & Monetary Engineering

Enterprise standards for handling money, taxes, rounding, double-entry ledgers, and cash shifts across POS, WMS, and DSD field sync. Follows progressive disclosure; consult references only when executing specific tasks.

## Core Directives
1. **Zero Float Math**: Always use `BcMath\Number` (PHP 8.4) or integer minor units (cents). Store rates as `DECIMAL(18, 4)` and balances as `DECIMAL(18, 2)` or `BIGINT`. Never use `float` or `double`.
2. **Penny Conservation**: Always use Fowler's Allocation Algorithm (Largest Remainder Method) when splitting discounts, taxes, or payments. Never allow penny leakage.
3. **Double-Entry Balance Invariant**: Enforce $\sum \text{Debits} - \sum \text{Credits} \equiv 0$ on every journal transaction.
4. **Line-Item Tax Reconciliation**: Invoice grand total must strictly equal the sum of line totals (`sum(line.total) === invoice.grand_total`).
5. **Pessimistic Concurrency**: Always acquire `lockForUpdate()` on customer AR records during credit sales to prevent credit limit race conditions.
6. **Strict Idempotency**: Validate unique `client_uuid` on every financial mutation to prevent duplicate charges.

## Reference Index
Consult only the relevant reference file for your current task:

| Topic / Requirement | Reference File |
| :--- | :--- |
| `BcMath\Number`, Money value object, Fowler penny allocation, tax calculation, UOM pricing | [`references/monetary_calculations_and_rounding.md`](references/monetary_calculations_and_rounding.md) |
| Chart of accounts, double-entry balancing entries, AR sub-ledger, credit limit locking | [`references/double_entry_and_ar_ledger.md`](references/double_entry_and_ar_ledger.md) |
| Offline `client_uuid` idempotency, split tenders, change rules, cash shift blind counts | [`references/offline_financial_idempotency.md`](references/offline_financial_idempotency.md) |
