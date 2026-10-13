# Idempotency & Database Transactions Guide

## 1. Idempotent Mutation Processing
- Every mutating request from mobile apps or edge POS terminals (e.g., creating orders, submitting payments, recording cycle counts) MUST include a unique `client_uuid` (UUID v4).
- **Deduplication Workflow**:
  1. Target tables must include a unique index on `client_uuid`.
  2. Before executing domain logic, query the database for an existing record matching `client_uuid`.
  3. If found, immediately return the existing entity's transformed representation with HTTP 200/201 without re-executing transactions or altering inventory balances.

## 2. Transactional Integrity (`DB::transaction`)
- **Dual-State Synchronization**: Whenever an operation affects both physical inventory (ledger) and financial records (AR / invoices), both writes MUST execute within the same `DB::transaction()`.
- **Scope Discipline**:
  - Keep transaction blocks as short and atomic as possible to prevent lock contention.
  - Never perform slow I/O, external HTTP calls, file uploads, or email dispatch inside open transactions.
  - Defer asynchronous side effects using `DB::afterCommit(fn() => dispatch(...))`.
- **Deadlock Handling**:
  - Configure retry attempts (e.g., `DB::transaction(callback, attempts: 3)`) to absorb transient database lock deadlocks cleanly.
