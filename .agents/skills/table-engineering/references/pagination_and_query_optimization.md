# Pagination & Query Optimization Guide

## 1. Pagination Strategies
- **Standard Offset Pagination (`paginate(20)`)**:
  - Best for: Master catalogs (products, customers, purchase orders) requiring numbered page buttons.
  - Caveat: Executes two queries (`COUNT(*)` and `SELECT ... LIMIT 20 OFFSET X`).
- **Cursor Pagination (`cursorPaginate(25)`)**:
  - Best for: Massive, append-only logs (`inventory_ledgers`, audit trails, sync batches).
  - Uses indexed keys (`id` or `created_at`) rather than `OFFSET`. Fast regardless of page depth.
- **Simple Pagination (`simplePaginate(20)`)**:
  - Best for: Mobile apps or continuous scroll views.
  - Generates Previous / Next links without executing the expensive `COUNT(*)` query.

## 2. Query Optimization & Index Alignment
- **Composite Index Matching**:
  - When filtering by `location_id` and sorting by `created_at`, ensure database has a compound index: `INDEX (location_id, created_at)`.
- **Eager Loading**:
  - Always eager-load relationships (`with(['uom', 'category'])`) on table queries to completely eliminate N+1 query bottlenecks.
- **Inertia Partial Reloads**:
  - When paginating or filtering, request only the table dataset:
    `router.get(url, params, { only: ['items'], preserveState: true, preserveScroll: true, replace: true })`
