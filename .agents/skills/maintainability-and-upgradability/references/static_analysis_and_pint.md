# Static Analysis & Code Formatting Guide

## 1. Larastan / PHPStan Level 8+
- Configuration in `phpstan.neon`:
  ```neon
  parameters:
      level: 8
      paths:
          - app
      checkMissingIterableValueType: true
  ```
- Command:
  `./vendor/bin/phpstan analyse`
- Standards:
  - All array parameters must include array shape definitions in PHPDocs.
  - Return types must be explicit.

## 2. Laravel Pint Code Formatting
- Format code before completing any change:
  `./vendor/bin/pint --format agent`
- Pint enforces PSR-12, eliminates trailing spaces, and standardizes PHP 8.4 syntax formatting.

## 3. Strict TypeScript
- Configuration in `tsconfig.json`:
  - `"strict": true`
  - `"noImplicitAny": true`
  - `"strictNullChecks": true`
- Command:
  `npm run types:check`
