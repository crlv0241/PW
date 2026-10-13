---
name: dropdown-engineering
description: "Use this skill when implementing single-select comboboxes, searchable multi-select dropdowns, or modal confirmation dialogs in React, Inertia, and Tailwind CSS. Activates when building searchable select inputs, multi-select components, filter pickers, or replacing browser confirm/alert popups."
---

# Dropdown & Dialog Engineering

Standards for searchable single-select comboboxes, searchable multi-select dropdowns, and accessible modal confirmation dialogs. Follows progressive disclosure—consult references below only when implementing UI components.

## Core Directives
1. **Searchable Selection**: Always use searchable dropdowns (combobox or multi-select with search) for dynamic or long entity lists. Never use raw unsearchable HTML `<select>` elements.
2. **Multi-Select with Badges**: Render selected items as dismissible badge chips with checkboxes and "Clear all" actions.
3. **No Vanilla Browser Dialogs**: Never use `window.alert()` or `window.confirm()`. Always use styled, accessible React confirmation modals and toast notifications.
4. **Keyboard Accessibility**: Support Arrow keys, Enter, and Escape for seamless non-mouse navigation.

## Reference Index
Consult only the relevant reference file for your current task:

| Topic / Requirement | Reference File |
| :--- | :--- |
| Searchable single-select combobox, keyboard navigation, clear button | [`references/searchable_single_select_combobox.md`](references/searchable_single_select_combobox.md) |
| Searchable multi-select dropdown, badge chips, select/clear all | [`references/searchable_multiselect_dropdown.md`](references/searchable_multiselect_dropdown.md) |
| Accessible confirmation modals and toast notifications (replacing alert/confirm) | [`references/dialogs_and_confirmation_modals.md`](references/dialogs_and_confirmation_modals.md) |
