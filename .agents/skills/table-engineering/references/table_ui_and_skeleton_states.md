# Table UI & Skeleton Loading States Guide

## 1. Async Loading States & Skeleton Rows
- When table filters or page navigation are pending, NEVER render a blank screen or freeze the interface.
- Render 5–8 animated skeleton rows (`animate-pulse`):
  ```tsx
  {isLoading && Array.from({ length: 6 }).map((_, i) => (
    <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
      <td className="p-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
      <td className="p-4"><div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
      <td className="p-4"><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
    </tr>
  ))}
  ```

## 2. Table Layout & Ergonomics
- **Sticky Headers**: Keep `thead` fixed during vertical scroll:
  `sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur z-10 border-b border-slate-200`
- **Responsive Wrapper**: Enclose tables in `<div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">`.
- **Numeric Alignment**: Numbers (quantities, prices, barcodes) must be right-aligned with `text-right font-mono tabular-nums`.
- **Sortable Columns**: Use vector SVG sort icons (`ArrowUpDown`, `ChevronUp`, `ChevronDown` from `lucide-react`).

## 3. Empty States (Zero Emoji Policy)
- When query returns 0 records, render a professional empty state:
  - Vector icon (`SearchX` or `Inbox` from `lucide-react`, sized `w-8 h-8` in muted slate).
  - Clear heading: "No items found".
  - Subtitle: "Try adjusting your search terms or clearing active filters."
  - Action button: "Clear all filters".
