---
name: table-engineering
description: "Use this skill when building or optimizing data tables with server-side pagination, multi-column filtering, URL query syncing, or column sorting in React, Inertia.js, and Laravel. Activates when creating tables, managing pagination, writing search/filter bars, or optimizing table query performance."
---

# Optimized Table Engineering

Standards for high-performance, filterable, and paginated data tables in React and Inertia. Follows progressive disclosure—consult references below only when executing specific implementation tasks.

## Core Directives
1. **Server-Side Pagination**: Use standard pagination for catalogs; use cursor pagination for high-volume append-only ledgers and logs.
2. **URL State Synchronization**: Store search terms, filters, and page numbers in URL query parameters (`preserveState: true, replace: true`).
3. **Debounced Search**: Debounce global table search inputs by 300ms to eliminate redundant network requests.
4. **Async Skeletons & Zero Emojis**: Render animated pulsing skeleton rows during data fetching. Never leave tables unresponsive. Use SVG vector icons for empty states and column sorting.

## Reference Index
Consult only the relevant reference file for your current task:

| Topic / Requirement | Reference File |
| :--- | :--- |
| Offset vs cursor pagination, query index alignment, Inertia partial reloads | [`references/pagination_and_query_optimization.md`](references/pagination_and_query_optimization.md) |
| URL query string synchronization, 300ms debounced search, Eloquent filter scopes | [`references/filtering_and_url_state.md`](references/filtering_and_url_state.md) |
| Async skeleton rows, sticky headers, numeric tabular alignment, professional empty states | [`references/table_ui_and_skeleton_states.md`](references/table_ui_and_skeleton_states.md) |
