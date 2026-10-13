# Professional Iconography & Typography Guide

## 1. Zero Emoji Policy
- Emojis (e.g. 🚀, 📦, ⚠️, ❌, ✅, 🛒, 💡, 🔥, 👍) are strictly prohibited across:
  - User interfaces (buttons, badges, alerts, dialogs, empty states)
  - Source code comments, docstrings, variable names
  - Git commit messages, pull requests, release notes
  - Terminal logs, API error payloads, documentation
- Rationale: Emojis create an amateurish appearance, render inconsistently across operating systems (iOS vs Android vs Windows), and lack uniform optical alignment in enterprise software.

## 2. Professional Vector Iconography
- Standard icon libraries: `lucide-react` (primary) or `@heroicons/react`.
- Stroke width: Maintain a uniform `1.5px` (subtle/refined) or `2px` (standard). Do not mix stroke widths on the same screen.
- Sizing tokens:
  - Inline / Compact: `w-4 h-4` (16px) — for chips, compact table cells, inline metadata.
  - Standard / Button: `w-5 h-5` (20px) — for standard buttons, form field adornments, list items.
  - Header / Hero: `w-6 h-6` (24px) — for modal titles, section headers, prominent stat cards.
- Accessibility requirements:
  - Decorative icons paired with visible label: `aria-hidden="true"`.
  - Icon-only interactive buttons: Must include explicit `aria-label="Descriptive action"` and title tooltip.
- Alignment: Always wrap with `inline-flex items-center gap-2` to guarantee exact optical alignment with baseline typography.

## 3. Typography Hierarchy
- Fonts: Clean sans-serif (Inter, Roboto, or Outfit).
- Color contrast: Minimum WCAG AA 4.5:1 ratio for body copy (`text-slate-900` on white, `text-slate-100` on dark) and 3:1 for large headers (`text-slate-700` / `text-slate-300`).
- Tabular figures: High-density numeric data (prices, stock quantities, barcodes) must use `font-mono` or `tabular-nums` to guarantee aligned columns in tables.
