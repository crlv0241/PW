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

## 4. Modern Enterprise Design & Smooth Color Gradients
- **Subtle, Low-Contrast Gradients**:
  - Never use jarring, high-contrast gradients that jump abruptly from light to dark on the same surface.
  - Employ smooth, monochromatic or analogous color shifts using adjacent shade steps:
    - Light Mode Containers: `bg-gradient-to-b from-slate-50 via-white to-slate-100/50`
    - Dark Mode Containers: `bg-gradient-to-b from-slate-900 to-slate-800`
    - Primary CTA Buttons: `bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600`
- **Ambient Glows & Opacity Washes**:
  - Use subtle opacity washes (e.g., `from-indigo-500/10 via-transparent to-transparent`) for soft card depth and modern glassmorphism.
- **Async Loading States & Skeletons**:
  - Always pair asynchronous data containers with animated pulsing skeleton placeholders (`animate-pulse bg-slate-200 dark:bg-slate-700 rounded`). Never leave the screen unresponsive during network latency.

