# Professional Iconography & Aesthetics Rules

## Zero Emoji Policy
- Under NO circumstance should emojis (e.g. 🚀, 📦, ⚠️, ❌, ✅, 🛒, 💡, 🔥, 👍, etc.) be used anywhere in:
  - User interfaces, components, buttons, dialogs, badges, or alerts
  - Code comments or docstrings
  - Git commit messages or branch names
  - API error responses or terminal logs
  - Project documentation or markdown artifacts

## Professional Vector Iconography
- Always use professional SVG/vector icon libraries (such as `lucide-react`, `@heroicons/react`, or Radix Icons).
- Use consistent sizing classes:
  - Small / Inline: `w-4 h-4` (16px)
  - Default / Buttons: `w-5 h-5` (20px)
  - Large / Page Headers: `w-6 h-6` (24px)
- Maintain uniform stroke widths (standard `1.5px` or `2px`).
- Include accessibility attributes:
  - Decorative icons: `aria-hidden="true"`
  - Standalone icon buttons: explicit `aria-label="Descriptive action"`
- Align icons with text using `inline-flex items-center gap-2`.

## Modern UI & Smooth Color Gradients
- **Subtle, Low-Contrast Gradients**:
  - Always design with refined, professional aesthetics. Avoid harsh or jarring color gradients that jump aggressively from light to dark on the same surface.
  - Stick to monochromatic or analogous tonal shifts using adjacent color steps (e.g., `from-slate-900 to-slate-800`, `from-blue-600 to-blue-700`, `from-slate-50 via-white to-slate-100/50`).
- **Ambient Elevation & Opacity Modifiers**:
  - Use subtle opacity washes (e.g., `from-indigo-500/10 via-transparent to-transparent`) for soft card depth and glassmorphism.
- **Accessibility Invariant**:
  - Never layer body copy over shifting multi-color gradient backgrounds. Always maintain WCAG AA (4.5:1) text contrast ratios against background surfaces.

## No Irrelevant Phrases or Marketing Jargon
- NEVER display buzzwords, slogans, technical marketing filler, or irrelevant phrases anywhere in the interface:
  - Do NOT use phrases like "Enterprise Core v1.0", "ACID Compliant...", "Fowler Multi-UOM...", "Ledger Synchronized", "NextGen OS", etc.
  - ONLY use concise, domain-specific descriptions and labels that serve an operational purpose for the user.
  - Use icons ONLY when they clearly and specifically convey a required action or status; omit decorative visual clutter.

## Typography, Button & Element Sizing Consistency
- **Standard Control Heights**:
  - All standard buttons, text inputs, combobox triggers, and dropdown filters MUST share the exact same height: `h-9` (36px).
  - Compact table buttons: `h-8` (32px).
- **Font Sizes & Weights Hierarchy**:
  - Page Titles: `text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100`
  - Section Headings: `text-sm font-semibold text-slate-900 dark:text-slate-100`
  - Body & Standard Controls: `text-sm text-slate-700 dark:text-slate-300 font-normal`
  - Table Column Headers: `text-xs font-medium text-slate-500 dark:text-slate-400` (no wide tracking, no screaming all-caps)
  - Identifiers & SKUs: `font-mono text-xs font-medium text-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700`
  - Secondary/Caption Text: `text-xs text-slate-500 dark:text-slate-400`
- **Button Standards**:
  - Primary Action: `h-9 px-4 rounded-lg bg-slate-900 text-white font-medium text-sm hover:bg-slate-800 shadow-sm transition-colors dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white`
  - Secondary Action: `h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80`



