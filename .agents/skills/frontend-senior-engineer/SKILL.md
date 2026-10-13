---
name: frontend-senior-engineer
description: "Use this skill for frontend engineering tasks across React, Next.js, Inertia.js, and React Native. Activates when building UI components, forms, layouts, POS/WMS entry screens, barcode scanner integration, offline queues, or applying professional iconography without emojis."
---

# Senior Frontend Engineering

Enterprise frontend standards for Back-Office (React / Inertia) and Mobile Field Apps (React Native). Follows progressive disclosure—consult references below only when needed for specific implementation details.

## Core Directives
1. **Zero Emoji Policy**: Never use emojis anywhere in UI, code, or commits. Use professional SVG icons (`lucide-react`, `@heroicons/react`).
2. **Strict TypeScript**: No `any`. Explicit typed props, states, and API contracts.
3. **Optimistic & Offline UX**: Update UI instantly, queue mutations with `client_uuid`, and handle rollbacks cleanly.
4. **Fast Entry**: Support keyboard hotkeys and barcode hardware listeners for cashier/warehouse speed.

## Reference Index
Consult only the relevant reference file for your current task:

| Topic / Requirement | Reference File |
| :--- | :--- |
| Zero-emoji rules, SVG icon sizing, typography, color contrast | [`references/iconography_and_typography.md`](references/iconography_and_typography.md) |
| Barcode scanner keystroke buffering, hotkeys, thermal receipts | [`references/barcode_and_pos_hardware.md`](references/barcode_and_pos_hardware.md) |
| Offline queue status, optimistic UI rollback, virtualized tables | [`references/offline_queue_and_sync_ux.md`](references/offline_queue_and_sync_ux.md) |
