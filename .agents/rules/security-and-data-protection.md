# Security & Data Protection Rules

## Mandatory Security Constraints
These rules are non-negotiable security boundaries that apply across all code written in this repository:

1. **SQL Injection Prevention**:
   - NEVER concatenate dynamic variables into raw SQL strings.
   - ALWAYS use Eloquent query builder methods or parameterized bindings (`DB::raw('...', [$val])`, `DB::select('...', [$val])`).

2. **Mass-Assignment & Input Safety**:
   - NEVER use empty `$guarded = []` on models handling transactional, financial, or ledger state.
   - ALWAYS declare explicit `$fillable` arrays on Eloquent models.
   - ALWAYS validate incoming request payloads via dedicated `FormRequest` classes before executing domain logic.

3. **Protection of Secrets & Sensitive Data**:
   - NEVER hardcode API keys, tokens, credentials, or secrets in source code, migrations, or seeders. All secrets must reside exclusively in `.env`.
   - ALWAYS mask sensitive model attributes from JSON serialization using the `$hidden` array (e.g., passwords, device tokens, PIN hashes).
   - ALWAYS use Laravel's `encrypted` attribute casts for sensitive personally identifiable information (PII) or stored payment credentials.

4. **Endpoint Protection**:
   - Enforce rate-limiting middleware on all authentication routes (`throttle:login`) and bulk synchronization endpoints.
   - Guard every mutating endpoint with explicit Laravel Policies or Gates.
