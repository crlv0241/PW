# Code Standards, Clean Architecture & Scalability Rules

## Core Principles
- **Readability & Descriptive Naming**: Use intention-revealing, unambiguous names for classes, methods, variables, and database columns. Avoid single-letter variables, obscure acronyms, or misleading names.
- **SOLID & Clean Architecture**:
  - Keep controllers thin; delegate domain logic to single-action classes (`app/Actions`).
  - Keep Eloquent models focused on schema, relationships, and scopes.
  - Guard clauses and early returns must be used to eliminate deep nesting.
- **Strict Invariants Enforcement**:
  - Lowest-Common-Denominator Atomicity: All inventory counts and ledger movements must be in lowest base units (integer pieces/eaches).
  - Idempotent API endpoints: All mutating offline/POS sync requests must carry and validate a `client_uuid`.
  - Transactional boundaries: Always wrap interdependent financial (AR) and physical (Ledger) mutations in `DB::transaction()`.
- **Strict Typing & Quality Checks**:
  - PHP: `declare(strict_types=1);`, explicit return types, typed arguments, PHP 8 constructor property promotion.
  - TypeScript: Strict typing enabled; no implicit `any`.
  - Run `vendor/bin/pint --format agent` to format all modified PHP code.
  - Run Pest automated tests on modified components.
