# Testing System Invariants with Pest

## 1. Core Testing Philosophy
- **Feature Tests Over Mock-Heavy Unit Tests**: System invariants (transactions, ledger cache synchronization, idempotency) must be tested against a real database (MySQL or SQLite in-memory for fast CI) rather than mocked out.
- **Strict Invariant Verification**: Write focused tests that attempt to break system rules (e.g., race conditions, duplicate UUIDs, fractional quantities).

## 2. Invariant Test Scenarios

### Scenario A: Multi-UOM Conversion Atomicity
- Test that packaging unit conversions calculate whole integer base units.
- Assert that multi-pack conversions produce exact integer totals without floating-point drift or decimal truncation.

### Scenario B: Ledger & Balance Cache Synchronization
- Test that every stock movement transaction creates an append-only ledger row AND synchronously updates the indexed balance cache.
- Assert that rolling back a transaction leaves both the ledger and balance cache completely unchanged.

### Scenario C: Idempotent Request Deduplication
- Submit an identical payload containing the same `client_uuid` twice to a mutating endpoint.
- Assertions:
  - First request returns HTTP 201 Created.
  - Second request returns HTTP 200/201 with the exact same resource payload.
  - Database count for ledger records or orders matching `client_uuid` equals exactly 1.
