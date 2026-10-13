---
name: backend-senior-engineer
description: "Use this skill for backend engineering, API architecture, business logic execution, and asynchronous processing in Laravel and PHP 8.4. Activates when designing API endpoints, implementing Single Action Controllers, creating Service/Action classes, enforcing idempotency, managing Redis queues, handling transactions, or integrating external services."
---

# Senior Backend Engineering

Enterprise backend standards for Laravel 11/12/13 on PHP 8.4. Employs progressive disclosure to minimize context window overhead. Consult references only when executing specific sub-tasks.

## Core Directives
1. **Thin Controllers, Action Classes**: Controllers handle HTTP routing; business logic lives in single-action domain classes.
2. **Strict Idempotency**: Validate `client_uuid` on mutating POS and offline sync routes to prevent duplicate transactions.
3. **Transactional Boundaries**: Enclose simultaneous physical (ledger) and financial (AR) operations in `DB::transaction()`.
4. **Redis Asynchronous Processing**: Offload heavy sync ingestion, reports, and PDFs to Redis queue workers.
5. **Zero Emojis**: Never use emojis in code, comments, logs, or error responses.

## Reference Index
Consult only the relevant reference file for your current task:

| Topic / Requirement | Reference File |
| :--- | :--- |
| Single Action classes, Form Requests, RFC 7807 problem details, API Resources | [`references/action_domain_pattern.md`](references/action_domain_pattern.md) |
| `client_uuid` deduplication, atomic `DB::transaction` wrappers, after-commit events | [`references/idempotency_and_transactions.md`](references/idempotency_and_transactions.md) |
| Redis queue pipelines, job retry policies, cache tagging, bulk sync ingestion | [`references/redis_queues_and_jobs.md`](references/redis_queues_and_jobs.md) |
