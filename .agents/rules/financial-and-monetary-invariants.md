# Financial & Monetary Invariants Rules

## Mandatory Financial & Accounting Constraints
These invariants supersede all general suggestions and must be enforced unconditionally across migrations, domain actions, and API calculations:

1. **Zero Floating-Point Monetary Math**:
   - NEVER use `FLOAT` or `DOUBLE` for monetary values, prices, discounts, taxes, or currency balances in database schemas or application code.
   - ALWAYS store base unit prices, tax rates, and exchange rates as `DECIMAL(18, 4)`.
   - ALWAYS store invoice totals, payments, and ledger balances as integer minor units (`BIGINT` cents) or `DECIMAL(18, 2)`.
   - In PHP 8.4, ALWAYS perform monetary arithmetic using `BcMath\Number` or integer cents. Never use native float arithmetic (`+`, `-`, `*`, `/`).

2. **The Penny Conservation Invariant (Fowler Allocation)**:
   - When splitting amounts (discounts across lines, split payments, or taxes), NEVER round parts independently in a way that leaks pennies.
   - ALWAYS use the Largest Remainder Method (Fowler's Allocation Algorithm) to distribute rounding remainders deterministically:
     $$\sum_{i=1}^n \text{allocated}_i \equiv \text{Total}$$
   - Invoice Line Total Invariant: `invoice.grand_total === sum(line_item.total)`.

3. **Double-Entry General & AR Ledger Balance**:
   - Money is conserved: it is never created or destroyed, only transferred between accounts.
   - Every financial transaction (Invoice, Payment, Credit Memo, Refund, Cash Adjustment) must write balanced entries:
     $$\sum \text{Debits} - \sum \text{Credits} = 0$$
   - AR and Cash balances must be updated synchronously within the same `DB::transaction()`.

4. **Historical Price & Financial Snapshot Immutability**:
   - Finalized invoices, receipts, and credit notes are **permanent, immutable legal records**.
   - NEVER recompute historical line totals dynamically from current product prices, customer discount rates, or tax matrices.
   - ALWAYS freeze and store `unit_price`, `unit_cost`, `tax_rate`, `tax_amount`, `discount_amount`, `line_total`, and `currency_code` directly on the transaction line rows.

5. **Pessimistic Locking on Financial Balances**:
   - ALWAYS acquire pessimistic row locks (`lockForUpdate()`) on customer AR records, credit limits, and cash drawer balances before evaluating credit limits or booking payments to prevent concurrency race conditions.

6. **Idempotent Financial Mutations**:
   - Every mutating payment, invoice, or refund endpoint must require and validate a unique `client_uuid`.
   - Duplicate UUID submissions must return the recorded transaction idempotently without double-charging or re-booking entries.
