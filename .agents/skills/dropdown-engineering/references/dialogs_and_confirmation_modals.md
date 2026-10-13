# Modal Dialogs & Modern Feedback Guide

## 1. Zero Browser Dialogs Policy
- **Strict Prohibition**: NEVER use vanilla browser `window.alert()`, `window.confirm()`, or `window.prompt()`.
- **Rationale**:
  - They synchronously block the browser thread, preventing background processing and animations.
  - They cannot be styled, lack dark mode support, and render inconsistently across platforms.
  - They fail enterprise accessibility (WCAG AA) requirements.

## 2. Accessible Confirmation Modals
- All destructive actions (e.g. deleting items, cancelling orders, overriding prices) must use styled React confirmation dialogs.
- **Required Elements**:
  - **Backdrop Overlay**: Semi-transparent dark wash (`bg-slate-900/50 backdrop-blur-sm`).
  - **Modal Container**: Styled card with header icon (`AlertTriangle` from `lucide-react`), title, and descriptive message.
  - **Action Buttons**:
    - "Cancel" button: Neutral outline style (`border-slate-300 dark:border-slate-700`).
    - "Confirm" / "Delete" button: Prominent primary or destructive red style (`bg-red-600 hover:bg-red-700 text-white`).
  - **Async State**: Display loading spinner/skeleton on the confirm button while the async request is in flight. Disable both buttons during execution.

## 3. Toast Notifications for Alerts
- Replace `alert('Saved successfully!')` with modern non-blocking toast notifications positioned at top-right or bottom-right.
- Success toasts: Green check vector icon with brief status message.
- Error toasts: Red alert-circle vector icon with RFC 7807 error detail.
