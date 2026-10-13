# Safe Migrations & API Versioning Guide

## 1. Safe Database Migrations Lifecycle
- **Never Modify Committed Migrations**: Always create a new migration to adjust existing tables.
- **Rollback Verification**:
  - Every migration must have a tested `down()` method:
    `php artisan migrate:rollback --step=1`
- **Nullable Columns for Additions**:
  - When adding new columns to existing tables with millions of rows, make them nullable or provide a default value to prevent table rewrite locks.

## 2. API Versioning Contract Stability
- Place all mobile-consumed endpoints under versioned prefixes:
  - Route file: `routes/api_v1.php`
  - URL pattern: `/api/v1/...`
- Mobile applications deployed on truck handhelds remain in the field for weeks. Never break existing payload schema contracts without bumping version to `/api/v2/`.
