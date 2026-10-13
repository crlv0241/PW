# POS & WMS Enterprise System Guidelines

## 1. Project Overview & Architecture
Enterprise-grade Direct Store Delivery (DSD), Point of Sale (POS), and Warehouse Management System (WMS).
- **Backend API**: Laravel (PHP 8.4) + Redis (Asynchronous queues, offline sync processing, cache).
- **Database**: MySQL 8 in Docker (port 3306, InnoDB, strict SQL mode, ACID compliance).
- **Web Frontend**: Inertia.js v3 + React 19 + TypeScript + Tailwind CSS.
- **Mobile Frontend**: React Native (ESC/POS thermal printer sockets, hardware barcode scanner listeners).
- **Docker Environment**: Docker Compose orchestrating MySQL 8 and Redis.

---

## 2. Essential Commands
Always use these exact commands. Never guess alternative runners or package managers:
| Action | Command |
| :--- | :--- |
| **Start Docker Services** | `docker compose up -d` |
| **Stop Docker Services** | `docker compose down` |
| **Run Dev Server** | `composer run dev` or `php artisan dev` |
| **Run Pest Tests** | `vendor/bin/pest` or `php artisan test --compact` |
| **Format PHP Code (Pint)** | `vendor/bin/pint --dirty --format agent` (or `vendor/bin/pint --format agent`) |
| **Type Check (PHPStan)** | `npm run types:check` or `vendor/bin/phpstan analyse` |
| **Frontend Build** | `npm run build` |
| **Database Migrations** | `php artisan migrate` |

---

## 3. Strict Guardrails & Negative Constraints ("NEVER DO THIS")
These constraints supersede all suggestions and must NEVER be violated:
- **ZERO EMOJI POLICY**: NEVER use emojis (e.g. 🚀, 📦, ⚠️, ❌, ✅, 🛒, 💡, 🔥, 👍) in:
  - User interfaces, components, buttons, dialogs, badges, or alerts
  - Code comments, docstrings, or method annotations
  - Commit messages, pull requests, or branch names
  - API responses, exceptions, terminal output, or markdown documentation.
  - *Instead, ALWAYS use professional SVG vector icons (`lucide-react`, `@heroicons/react`).*
- **NEVER CALCULATE INVENTORY VIA `SUM(qty_change)` LIVE**: Always read stock from the indexed `inventory_balances` cache.
- **NEVER OMIT `client_uuid` ON MUTATING POS/SYNC ENDPOINTS**: Every offline/mobile order, payment, and inventory count must validate `client_uuid` for idempotent deduplication.
- **NEVER MUTATE COUPLED FINANCIAL (AR) & PHYSICAL (LEDGER) STATE OUTSIDE `DB::transaction()`**: Both updates must succeed together or roll back completely.
- **NEVER MAKE SLOW I/O OR EXTERNAL HTTP CALLS INSIDE TRANSACTIONS**: Dispatch background queue jobs using `DB::afterCommit()`.
- **NEVER USE `any` IN TYPESCRIPT**: Maintain strict types across all interfaces, props, and API payloads.
- **NEVER INSTALL NEW DEPENDENCIES WITHOUT APPROVAL**: Do not modify `composer.json` or `package.json` dependencies without explicit user request.
- **NEVER EDIT COMMITTED MIGRATIONS**: Create a new sequential migration to alter existing schemas.
- **NEVER WRITE UNPARAMETERIZED RAW SQL**: Always use Eloquent query builder or parameterized bindings (`DB::raw('...', [$val])`).

*Detailed rule files enforcing these guardrails are organized in `.agents/rules/`:*
- [`professional-iconography-and-design.md`](.agents/rules/professional-iconography-and-design.md)
- [`database-and-ledger-invariants.md`](.agents/rules/database-and-ledger-invariants.md)
- [`security-and-data-protection.md`](.agents/rules/security-and-data-protection.md)
- [`code-standards-and-scalability.md`](.agents/rules/code-standards-and-scalability.md)

---

## 4. System Invariants & Domain Rules
- **Lowest-Common-Denominator Atomicity**: All inventory is stored, transferred, and calculated in the lowest indivisible base unit (integer pieces/eaches). Multi-UOM conversions (`product_uoms`) must resolve to whole integers.
- **Write-Ahead Ledger & Cache**: All physical movements write append-only, immutable rows to `inventory_ledgers` and synchronously update `inventory_balances`.
- **Idempotent Sync Verification**: Offline sync batches verify client UUIDs before inserting records to guarantee safe retries.
- **Clean Architecture & SOLID**: Keep controllers thin; encapsulate business logic in dedicated Single-Action classes (`app/Actions`). Keep models focused on schema relations, casts, and scopes.

---

## 5. Domain Skills Activation (Progressive Disclosure)
Detailed procedures and reference guides are organized into specialized skills in `.agents/skills/`. You MUST activate the relevant skill before executing tasks in its domain:
- `frontend-senior-engineer`: UI components, React/Inertia, barcode scanner keystroke buffering, offline queues, professional iconography.
- `backend-senior-engineer`: Single-action controllers, Form Requests, Redis queues, idempotent sync endpoints, RFC 7807 error envelopes.
- `senior-database-engineer`: MySQL 8 schemas, migrations, ledger tables, balance caches, pessimistic locking (`lockForUpdate`), indexing.
- `clean-code-architecture`: SOLID principles, domain layering, typed DTOs, guard clauses & early returns, naming conventions.
- `security-engineering`: Sanctum authentication, granular RBAC policies, HMAC sync signatures, anti-replay checks, encrypted attributes.
- `maintainability-and-upgradability`: Automated Pest invariant tests, Larastan Level 8+, Pint formatting, backward-compatible `/api/v1/` routes.
- `inertia-react-development`: Inertia v3 React client-side patterns, `useHttp`, forms, instant visits.
- `wayfinder-development`: Type-safe route calls via Laravel Wayfinder (`@/actions/`, `@/routes/`).
- `laravel-best-practices`: Eloquent performance, cache tags, event listeners, jobs.

---

<laravel-boost-guidelines>
=== foundation rules ===

# Laravel Boost Guidelines

## Foundational Context

This application is a Laravel application running on PHP 8.4. Always use the APIs that match the installed major version of each package — do not assume a version.

Before relying on a package's API, confirm its installed version:
- PHP packages: run `composer show --direct` to list direct dependencies with versions, or `composer show <vendor/package>` for a single package.
- JS packages: check `package.json` for the installed versions.

## Skills Activation

This project has domain-specific skills available in `**/skills/**`. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

## Conventions

- You must follow all existing code conventions used in this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for existing components to reuse before writing a new one.

## Verification Scripts

- Do not create verification scripts or tinker when tests cover that functionality and prove they work. Unit and feature tests are more important.

## Application Structure & Architecture

- Stick to existing directory structure; don't create new base folders without approval.
- Do not change the application's dependencies without approval.

## Frontend Bundling

- If a frontend change doesn't show in the UI or you get a "Unable to locate file in Vite manifest" error, run `npm run build` or ask the user to run `npm run dev` or `composer run dev`.

## Documentation Files

- You must only create documentation files if explicitly requested by the user.

=== boost rules ===

# Laravel Boost

## Tools

- Laravel Boost is an MCP server with tools designed specifically for this application. Prefer Boost tools over manual alternatives like shell commands or file reads.
- Use `database-query` to run read-only queries against the database instead of writing raw SQL in tinker.
- Use `database-schema` to inspect table structure before writing migrations or models.
- Use `get-absolute-url` to resolve the correct scheme, domain, and port for project URLs. Always use this before sharing a URL with the user.
- Use `browser-logs` to read browser logs, errors, and exceptions. Only recent logs are useful, ignore old entries.

## Searching Documentation (IMPORTANT)

- Use `search-docs` before changes that depend on Laravel ecosystem APIs, behavior, configuration, or version-specific syntax. Skip it for copy-only edits and other changes where package documentation is irrelevant. Reuse sufficient results already in context instead of searching again.
- Pass a `packages` array to scope results when you know which packages are relevant.
- Use multiple broad, topic-based queries: `['rate limiting', 'routing rate limiting', 'routing']`. Expect the most relevant results first.
- Do not add package names to queries because package info is already shared. Use `test resource table`, not `filament 4 test resource table`.

### Search Syntax

1. Use words for auto-stemmed AND logic: `rate limit` matches both "rate" AND "limit".
2. Use `"quoted phrases"` for exact position matching: `"infinite scroll"` requires adjacent words in order.
3. Combine words and phrases for mixed queries: `middleware "rate limit"`.
4. Use multiple queries for OR logic: `queries=["authentication", "middleware"]`.

## Project Rules

- This project contains committed, area-grouped rules in `.ai/rules` when that directory exists, including path-scoped framework guidelines under `.ai/rules/boost`. Before you enter plan mode or create/edit any file, you MUST first: open @.ai/rules/index.md (it maps file globs to rule files), read every rule file whose globs cover the path(s) in scope, and run `grep -rin 'keyword' .ai/rules` to catch what a path match alone misses. Do not write code until you have read and are following every matching rule. If `.ai/rules` does not exist, continue without it.

## Artisan

- Run Artisan commands directly via the command line (e.g., `php artisan route:list`). Use `php artisan list` to discover available commands and `php artisan [command] --help` to check parameters.
- Inspect routes with `php artisan route:list`. Filter with: `--method=GET`, `--name=users`, `--path=api`, `--except-vendor`, `--only-vendor`.
- Read configuration values using dot notation: `php artisan config:show app.name`, `php artisan config:show database.default`. Or read config files directly from the `config/` directory.

## Tinker

- Execute PHP in app context for debugging and testing code. Do not create models without user approval, prefer tests with factories instead. Prefer existing Artisan commands over custom tinker code.
- Always use single quotes to prevent shell expansion: `php artisan tinker --execute 'Your::code();'`
  - Double quotes for PHP strings inside: `php artisan tinker --execute 'User::where("active", true)->count();'`

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: `public function __construct(public GitHub $github) { }`. Do not leave empty zero-parameter `__construct()` methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: `function isAccessible(User $user, ?string $path = null): bool`
- Use TitleCase for Enum keys: `FavoritePerson`, `BestLake`, `Monthly`.
- Prefer PHPDoc blocks over inline comments. Only add inline comments for exceptionally complex logic.
- Use array shape type definitions in PHPDoc blocks.

=== deployments rules ===

# Deployment

- Laravel can be deployed using [Laravel Cloud](https://cloud.laravel.com/), which is the fastest way to deploy and scale production Laravel applications.

=== inertia-laravel/core rules ===

# Inertia

- Inertia creates fully client-side rendered SPAs without modern SPA complexity, leveraging existing server-side patterns.
- Components live in `resources/js/pages` (unless specified in `vite.config.js`). Use `Inertia::render()` for server-side routing instead of Blade views.
- ALWAYS use `search-docs` tool for version-specific Inertia documentation and updated code examples.
- IMPORTANT: Activate `inertia-react-development` when working with Inertia client-side patterns.

# Inertia v3

- Use all Inertia features from v1, v2, and v3. Check the documentation before making changes to ensure the correct approach.
- New v3 features: standalone HTTP requests (`useHttp` hook), optimistic updates with automatic rollback, layout props (`useLayoutProps` hook), instant visits, simplified SSR via `@inertiajs/vite` plugin, custom exception handling for error pages.
- Carried over from v2: deferred props, infinite scroll, merging props, polling, prefetching, once props, flash data.
- When using deferred props, add an empty state with a pulsing or animated skeleton.
- Axios has been removed. Use the built-in XHR client with interceptors, or install Axios separately if needed.
- `Inertia::lazy()` / `LazyProp` has been removed. Use `Inertia::optional()` instead.
- Prop types (`Inertia::optional()`, `Inertia::defer()`, `Inertia::merge()`) work inside nested arrays with dot-notation paths.
- SSR works automatically in Vite dev mode with `@inertiajs/vite` - no separate Node.js server needed during development.
- Event renames: `invalid` is now `httpException`, `exception` is now `networkError`.
- `router.cancel()` replaced by `router.cancelAll()`.
- The `future` configuration namespace has been removed - all v2 future options are now always enabled.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `php artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.). You can list available Artisan commands using `php artisan list` and check their parameters with `php artisan [command] --help`.
- If you're creating a generic PHP class, use `php artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

### Model Creation

- When creating new models, create useful factories and seeders for them too. Ask the user if they need any other things, using `php artisan make:model --help` to check the available options.

## APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Testing

- When creating models for tests, use the factories for the models. Check if the factory has custom states that can be used before manually setting up the model.
- Faker: Use methods such as `$this->faker->word()` or `fake()->randomDigit()`. Follow existing conventions whether to use `$this->faker` or `fake()`.
- When creating tests, make use of `php artisan make:test [options] {name}` to create a feature test, and pass `--unit` to create a unit test. Most tests should be feature tests.

=== wayfinder/core rules ===

# Laravel Wayfinder

Use Wayfinder to generate TypeScript functions for Laravel routes. Import from `@/actions/` (controllers) or `@/routes/` (named routes).

=== pint/core rules ===

# Laravel Pint Code Formatter

- If you have modified any PHP files, you must run `vendor/bin/pint --dirty --format agent` before finalizing changes to ensure your code matches the project's expected style.
- Do not run `vendor/bin/pint --test --format agent`, simply run `vendor/bin/pint --format agent` to fix any formatting issues.

=== pest/core rules ===

# Pest

- This project uses Pest. Create tests with `php artisan make:test --pest {name}`.
- Do not include the test suite directory in `{name}`. Use `SomeFeatureTest`, not `Feature/SomeFeatureTest`.
- Read the `testing-best-practices` skill for guidance on coverage, naming, structure, dependency isolation, and review.
- Do not delete tests or test files without approval. They are part of the application.

## Running Tests

- Run the narrowest set of tests that covers the change. Pass a file path or `--filter=testName` to `php artisan test --compact`.
- Rerun a test after each change to it.
- Run `vendor/bin/pest` to call the test runner directly. It accepts the same file path and `--filter=testName` arguments.
- After the feature tests pass, ask the user to run the complete suite with `php artisan test --compact`.

=== inertia-react/core rules ===

# Inertia + React

- IMPORTANT: Activate `inertia-react-development` when working with Inertia React client-side patterns.
</laravel-boost-guidelines>

