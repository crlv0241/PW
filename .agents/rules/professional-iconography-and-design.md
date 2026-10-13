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
