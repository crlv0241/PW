# Offline Queue & Mobile Edge Sync UX Guide

## 1. Optimistic State Updates with Rollback
- Cashier order additions and mobile truck sales must update UI state immediately (latency < 16ms).
- Maintain an in-memory or SQLite mutation queue with status tags (`PENDING`, `SYNCING`, `SYNCED`, `FAILED`).
- If server reconciliation rejects a transaction (e.g. insufficient central stock or pricing mismatch), roll back local state gracefully and trigger a notification banner with manual resolution options.

## 2. Sync Transparency & Status Indicators
- Header status pill:
  - Online & Synced: Muted gray/neutral badge with check icon.
  - Syncing: Blue badge with spinning refresh icon and pending item counter (`Syncing 3 items...`).
  - Offline: Amber badge with cloud-offline icon (`Offline - 5 queued`).
- Sync Queue Inspector:
  - Accessible via settings/header. Shows list of queued client UUIDs, timestamps, payload size, and retry buttons.

## 3. High-Density Table Virtualization
- Large catalog lists (> 100 items) or ledger audit views must use virtual scrolling (`@tanstack/react-virtual`).
- Render only visible window plus overscan buffer (5-10 rows) to keep DOM node count constant and memory footprint minimal.
