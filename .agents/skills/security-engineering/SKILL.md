---
name: security-engineering
description: "Use this skill for application security, authentication, authorization, data protection, and vulnerability prevention. Activates when implementing login/auth flows, role-based access control (RBAC), API authentication, sanitizing inputs, securing offline synchronization endpoints, managing secrets, or auditing sensitive transactions."
---

# Enterprise Security Engineering

Security architecture, authorization policies, and data protection for POS, WMS, and DSD. Uses progressive disclosure—consult references below only when implementing auth, sync security, or encryption.

## Core Directives
1. **Sanctum & Device Authentication**: Secure bearer tokens with hardware storage on mobile clients.
2. **Strict RBAC**: Enforce granular Laravel Policies and Gates for all mutating actions.
3. **Offline Sync Integrity**: Validate HMAC signatures and prevent replay attacks using unique transaction UUIDs.
4. **Data Protection**: Parameterized SQL queries, `$hidden` sensitive model attributes, and encrypted casts for PII.

## Reference Index
Consult only the relevant reference file for your current task:

| Topic / Requirement | Reference File |
| :--- | :--- |
| Sanctum token authentication, RBAC with Laravel Policies & Gates, supervisor overrides | [`references/auth_and_rbac_policies.md`](references/auth_and_rbac_policies.md) |
| Offline sync HMAC signatures, anti-replay protections, route data scoping | [`references/offline_sync_security.md`](references/offline_sync_security.md) |
| SQL injection defense, mass-assignment guards, encrypted casts, secret handling | [`references/owasp_and_data_protection.md`](references/owasp_and_data_protection.md) |
