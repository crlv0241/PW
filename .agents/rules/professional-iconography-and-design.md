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

