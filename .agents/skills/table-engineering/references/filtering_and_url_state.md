# Table Filtering & URL State Synchronization Guide

## 1. URL Query State Synchronization
- Store active filters, search keywords, and sort keys in URL query parameters (`?search=foo&status=active&page=2`).
- **Benefits**:
  - Filtered table states are bookmarkable, reloadable, and shareable via URL.
  - Browser back/forward navigation cleanly restores previous table filters.
- **Inertia Client Implementation**:
  ```tsx
  router.get(
    route('products.index'),
    { search, status, sort, direction },
    { preserveState: true, replace: true, preserveScroll: true }
  );
  ```

## 2. Debounced Search Inputs
- Never fire server requests on every keystroke.
- Attach a 300ms debounce timer to global search inputs before triggering router navigation:
  - Resets pagination back to page 1 upon new search term.
  - Cancels pending requests if user continues typing.

## 3. Backend Filter Scopes (`when` pipeline)
- In Laravel Eloquent, construct clean, conditional filter queries:
  ```php
  $query->when($filters['search'] ?? null, fn($q, $search) =>
      $q->where(fn($sub) => $sub->where('name', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%"))
  )->when($filters['status'] ?? null, fn($q, $status) =>
      $q->where('status', $status)
  );
  ```
