# POS & Warehouse Hardware Integration Guide

## 1. Hardware Barcode Scanner Buffer
- Barcode scanners emulate rapid keyboard keystrokes ending with an `Enter` or `Tab` key event.
- Keystroke buffer logic:
  - Attach a window-level keydown listener.
  - Accumulate characters if the inter-keystroke interval is under 50ms (human typing is typically > 100ms).
  - When `Enter` is detected and the buffer length matches barcode standards (e.g. 8-14 characters), intercept the event, flush the buffer, and trigger the product lookup action.
  - Automatically clear the buffer if keystroke elapsed time exceeds 100ms without an `Enter` suffix.

## 2. Keyboard-Driven Fast Entry (Hotkeys)
- Cashiers and warehouse receiving encoders must operate without touching a mouse.
- Provide standard hotkeys:
  - `F1` or `Cmd+K` / `Ctrl+K`: Global product search modal.
  - `F2`: Toggle quantity multiplier mode.
  - `F4`: Tender / Payment completion dialog.
  - `Escape`: Cancel / dismiss active modal.
- Prevent default browser behaviors for registered hotkeys.

## 3. Thermal Receipt Formatting (ESC/POS)
- Receipt layouts must render in standard 58mm (32 characters per line) or 80mm (48 characters per line) monospace width.
- Preview components should render with fixed-width typography (`font-mono text-xs`), dashed divider lines, left-aligned item descriptions, and right-aligned prices.
