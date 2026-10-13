# Searchable Multi-Select Dropdown Guide

## 1. UI Structure & Badge Chips
- **Trigger Display**:
  - Displays selected items as compact dismissible badge chips (`bg-slate-100 dark:bg-slate-800 text-xs rounded px-2 py-1 inline-flex items-center gap-1`).
  - Each chip features an `X` icon button to remove that specific item directly.
  - Overflow handling: If more than 3–4 items are selected, collapse into "+X more" chip.
- **Search & Filter Header**:
  - Dedicated search input filtering options in real-time.
  - Quick action toolbar: "Select All" and "Clear All" buttons.

## 2. Option Selection Mechanics
- Each dropdown item renders with a checkbox, label, and optional subtitle (e.g. SKU, category, or code).
- Selecting an item toggles its state without closing the dropdown, allowing rapid multi-selection.
- Maintain selected values as an array of IDs/strings in parent state or form data.

## 3. Keyboard & Accessibility
- Preserve search query while toggling checkboxes.
- `Escape`: Closes the popover.
- Announce selected count via `aria-live="polite"` or badge count label for screen readers.
