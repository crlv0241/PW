# POS & WMS Enterprise System Guidelines

## 1. Project Overview & Architecture
Enterprise-grade Direct Store Delivery (DSD), Point of Sale (POS), and Warehouse Management System (WMS).
- **Backend API**: Laravel (PHP 8.4) + Redis (Queues, cache, offline sync).
- **Database**: MySQL 8 in Docker (`port 3306`, InnoDB, strict SQL mode, ACID compliance).
- **Web Frontend**: Inertia.js v3 + React 19 + TypeScript + Tailwind CSS.
- **Mobile Frontend**: React Native (ESC/POS thermal printer sockets, barcode scanners).
- **Docker Orchestration**: Docker Compose for MySQL 8 and Redis.

---

## 2. Essential Commands
Always use these exact commands:
| Action | Command |
| :--- | :--- |
| **Start Docker Services** | `docker compose up -d` |
| **Stop Docker Services** | `docker compose down` |
| **Run Dev Server** | `composer run dev` or `php artisan dev` |
| **Run Pest Tests** | `vendor/bin/pest` or `php artisan test --compact` |
| **Format PHP Code (Pint)** | `vendor/bin/pint --dirty --format agent` |
| **Type Check (PHPStan)** | `npm run types:check` or `vendor/bin/phpstan analyse` |
| **Frontend Build** | `npm run build` |
| **Database Migrations** | `php artisan migrate` |

---

## 3. Strict Guardrails ("NEVER DO THIS")
These negative constraints supersede all other suggestions and must NEVER be violated:
- **ZERO EMOJI POLICY**: NEVER use emojis in UI, code, comments, commits, API errors, or docs. Always use SVG vector icons (`lucide-react`, `@heroicons/react`).
- **NEVER CALCULATE INVENTORY VIA `SUM(qty_change)` LIVE**: Always query the indexed `inventory_balances` cache.
- **NEVER OMIT `client_uuid` ON MUTATING POS/SYNC ENDPOINTS**: Validate `client_uuid` for idempotent deduplication.
- **NEVER MUTATE FINANCIAL (AR) & PHYSICAL (LEDGER) STATE OUTSIDE `DB::transaction()`**: Dual updates must succeed or roll back together.
- **NEVER MAKE SLOW I/O OR HTTP CALLS INSIDE TRANSACTIONS**: Dispatch background queue jobs using `DB::afterCommit()`.
- **NEVER USE `any` IN TYPESCRIPT**: Strict typing across all interfaces, props, and API payloads.
- **NEVER USE BROWSER `alert()`, `confirm()`, OR `prompt()`**: Always use styled React modal dialogs and toast notifications.
- **NEVER USE RAW UNSEARCHABLE `<select>` FOR DYNAMIC LISTS**: Always use searchable comboboxes or multi-select with badges.
- **NEVER INSTALL NEW DEPENDENCIES WITHOUT APPROVAL**: Do not modify `composer.json` or `package.json` without explicit request.
- **NEVER EDIT COMMITTED MIGRATIONS**: Always create a new sequential migration to alter schemas.
- **NEVER WRITE UNPARAMETERIZED RAW SQL**: Always use Eloquent query builder or parameterized bindings (`DB::raw('...', [$val])`).

*Detailed rule files: [`.agents/rules/`](.agents/rules/)*

---

## 4. System Invariants & Domain Rules
- **Lowest-Common-Denominator Atomicity**: All inventory is stored, transferred, and calculated in whole integer base units (pieces/eaches). Multi-UOM conversions (`product_uoms`) must resolve to integers.
- **Write-Ahead Ledger & Balance Cache**: Physical movements write append-only, immutable rows to `inventory_ledgers` and synchronously update `inventory_balances`.
- **Clean Architecture & SOLID**: Thin controllers, single-action domain classes (`app/Actions`), models focused on relationships/casts/scopes. Guard clauses and early returns over nested conditionals.

---

## 5. UI/UX & Coding Standards
- **Async Loading States**: Always include loading spinners or pulsing skeletons (`animate-pulse`) during async requests. Never leave the UI unresponsive.
- **Thoughtful Abstraction (DRY)**: Assess performance, independent evolution, and coupling before abstracting. Prefer slight duplication over premature/bad abstraction.
- **Modern Design & Subtle Gradients**: Refined, low-contrast monochromatic or analogous transitions (`from-slate-900 to-slate-800`, `from-indigo-500/10 via-transparent to-transparent`). Never use jarring light-to-dark gradient jumps on the same surface. Maintain WCAG AA (4.5:1) contrast.
- **Searchable Selection & Accessible Modals**: Searchable comboboxes/multi-select for entity selection; styled React confirmation modals with async loading states for destructive actions.

---

## 6. Domain Skills Activation (Progressive Disclosure)
Activate the corresponding skill in `.agents/skills/` when working in that domain:
- `table-engineering`: Server-side pagination, debounced multi-column filters, URL query sync, skeleton rows.
- `dropdown-engineering`: Searchable single-select combobox, searchable multi-select with badges, accessible confirmation modals.
- `frontend-senior-engineer`: UI components, React/Inertia, barcode keystroke buffer, offline queue UX, smooth gradients.
- `backend-senior-engineer`: Single-action domain classes, Form Requests, Redis queues, idempotent sync, RFC 7807 error envelopes.
- `senior-database-engineer`: MySQL 8 schemas, migrations, ledger tables, balance caches, pessimistic locking (`lockForUpdate`).
- `clean-code-architecture`: SOLID principles, domain layering, strongly-typed DTOs, guard clauses, naming conventions.
- `security-engineering`: Sanctum authentication, granular RBAC policies, HMAC sync signatures, anti-replay checks, encrypted casts.
- `maintainability-and-upgradability`: Automated Pest invariant tests, Larastan Level 8+, Pint formatting, backward-compatible API contracts.
- `inertia-react-development`: Inertia v3 React patterns, `useHttp`, forms, instant visits.
- `wayfinder-development`: Type-safe route calls via Laravel Wayfinder (`@/actions/`, `@/routes/`).
- `laravel-best-practices`: Eloquent performance, cache tags, event listeners, jobs.

---

<laravel-boost-guidelines>
=== foundation rules ===

# Laravel & Boost Guidelines

- **PHP 8.4 Standards**: `declare(strict_types=1);`, constructor property promotion, explicit parameter/return type hints, TitleCase for Enum keys, array shape PHPDocs.
- **Artisan**: Always pass `--no-interaction` to automated commands.
- **Tools**: Prefer Boost tools (`database-query`, `database-schema`, `get-absolute-url`, `browser-logs`, `search-docs`) over shell/tinker when inspecting DB or Laravel documentation.
- **Inertia v3**: SPAs rendered via `Inertia::render()`. Use `useHttp` for standalone requests, deferred props with animated skeletons, optimistic updates with automatic rollback. Axios is removed; use built-in XHR client.
- **Wayfinder**: Import type-safe routes from `@/actions/` (controllers) or `@/routes/` (named routes).
- **Code Quality**: Run `vendor/bin/pint --dirty --format agent` before finalizing PHP edits. Write feature tests with Pest. Do not edit models or dependencies without user approval.
</laravel-boost-guidelines>
