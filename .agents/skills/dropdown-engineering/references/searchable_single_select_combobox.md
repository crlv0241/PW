# Searchable Single-Select Combobox Guide

## 1. Architectural Pattern
- Replaces raw HTML `<select>` with a flexible, keyboard-accessible combobox.
- Core components:
  1. **Trigger Button**: Displays current selection label, clear icon (`X`), and chevron (`ChevronDown`).
  2. **Search Input**: Embedded inside popover dropdown; filters options instantly in real-time.
  3. **Option List**: Scrollable viewport (`max-h-60 overflow-y-auto`) with highlighted active item and check icon on selected item.
  4. **Empty State**: Displays "No options found" with search icon (zero emojis) if filter returns 0 results.

## 2. Keyboard Navigation Requirements
- `ArrowDown` / `ArrowUp`: Traverse options with visual focus ring / background highlight (`bg-slate-100 dark:bg-slate-800`).
- `Enter`: Select highlighted option and close dropdown.
- `Escape`: Close dropdown without altering previous selection.
- Autofocus search input when dropdown opens.

## 3. Clear & Reset Actions
- Provide an inline clear icon button (`X`) when a value is selected to allow instant clearing without reopening the dropdown.
- When closed, clicking anywhere outside (click-away listener) cleanly dismisses the popover.
