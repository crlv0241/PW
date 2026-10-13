# Authentication & RBAC Policies Guide

## 1. Token-Based Authentication (Sanctum)
- Mobile handhelds and POS terminals authenticate via Laravel Sanctum bearer tokens.
- Scope tokens with explicit abilities (e.g., specific domain permissions like `orders:create`, `sync:push`).
- Store tokens in OS-native secure hardware storage (iOS Keychain / Android Keystore).

## 2. Granular Role-Based Access Control (RBAC)
- Restrict business actions via Laravel Policies and Gates (`$this->authorize(...)`).
- Segregate roles strictly (e.g., cashiers initiate transactions, warehouse encoders scan receipts, managers approve variances/discounts, accounting audits financials).
- Verify authorization at the start of every controller or domain action before mutating state.

## 3. Managerial Overrides & Audit Logs
- High-risk operations (e.g., price overrides, manual discounts exceeding thresholds, inventory adjustments) require supervisor authorization.
- Capture immutable audit entries: authorizing user ID, target entity, reason text, and timestamp.
