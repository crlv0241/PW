---
name: maintainability-and-upgradability
description: "Use this skill to ensure long-term code quality, backward compatibility, dependency upgradability, and maintainability across the system lifecycle. Activates when setting up automated testing, static analysis, code formatting, refactoring legacy components, managing package dependencies, or preparing migrations for seamless framework upgrades."
---

# Maintainability & Long-Term Upgradability

Engineering quality gates and zero-technical-debt practices. Uses progressive disclosure—consult references below only when writing tests, running static analysis, or writing migrations.

## Core Directives
1. **Automated Invariant Tests**: Verify UOM conversions, ledger balances, and idempotency with automated Pest tests.
2. **Static Analysis & Linting**: Pass Larastan Level 8+, strict TypeScript, and Laravel Pint formatting.
3. **Safe Migrations**: Never modify committed migrations; always test rollback functionality.
4. **API Versioning**: Protect mobile clients by strictly versioning public API contracts (`/api/v1/`).

## Reference Index
Consult only the relevant reference file for your current task:

| Topic / Requirement | Reference File |
| :--- | :--- |
| Pest test suites for UOM conversion, ledger cache sync, and idempotent sync | [`references/testing_invariants_pest.md`](references/testing_invariants_pest.md) |
| Larastan Level 8+, Laravel Pint formatting, strict TypeScript rules | [`references/static_analysis_and_pint.md`](references/static_analysis_and_pint.md) |
| Safe migration lifecycle, rollback verification, versioned API stability | [`references/migrations_and_versioning.md`](references/migrations_and_versioning.md) |
