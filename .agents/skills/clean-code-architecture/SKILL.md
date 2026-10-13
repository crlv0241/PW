---
name: clean-code-architecture
description: "Use this skill when designing system structure, refactoring code, establishing design patterns, or ensuring SOLID principles, DRY, KISS, and YAGNI across the entire POS and WMS stack. Activates when organizing directories, decoupling business logic from framework details, defining domain boundaries, or establishing naming conventions."
---

# Clean Code & System Architecture

Architectural principles and coding standards ensuring high maintainability and readability. Uses progressive disclosure—consult references below only when structuring new features or refactoring modules.

## Core Directives
1. **SOLID Design**: Thin controllers, single-action domain classes, extensible pipelines, and constructor dependency injection.
2. **Layered Separation**: Isolate Presentation, Application, Domain, and Infrastructure.
3. **Strongly-Typed DTOs**: Never pass raw HTTP Request objects into domain actions.
4. **Guard Clauses**: Return early and eliminate nested conditionals.
5. **Expressive Naming**: Intention-revealing class, method, and variable names without cryptic abbreviations.

## Reference Index
Consult only the relevant reference file for your current task:

| Topic / Requirement | Reference File |
| :--- | :--- |
| SOLID principles applied in Laravel & React components | [`references/solid_in_laravel.md`](references/solid_in_laravel.md) |
| Clean directory layers (Presentation, Application, Domain) & typed DTOs | [`references/domain_layering_and_dtos.md`](references/domain_layering_and_dtos.md) |
| Intention-revealing naming, early return guard clauses, avoiding nesting | [`references/naming_and_guard_clauses.md`](references/naming_and_guard_clauses.md) |
