# Clean Domain Layering & Data Boundaries

## 1. Architectural Layers & Separation of Concerns
- **Presentation Layer**: Thin HTTP controllers, Form Requests, API Resources, and Inertia page views. Handles transport and protocol details only.
- **Application Layer**: Single-Action classes, queue jobs, and event listeners. Coordinates domain workflows and database transactions.
- **Domain Layer**: Eloquent models, casts, query scopes, enums, and domain contracts. Encapsulates entity state and relationships.
- **Infrastructure Layer**: Storage adapters, third-party integrations, external APIs, and hardware drivers.

## 2. Strong Data Boundaries & DTOs
- Never pass raw HTTP `Request` instances across architectural boundaries into Actions, domain services, or queued jobs.
- Extract validated parameters into strongly-typed DTOs, PHP 8 readonly classes, or explicitly typed method arguments.
- Benefits:
  - Eliminates coupling between HTTP request structures and domain business logic.
  - Enables independent unit and integration testing without mocking HTTP request contexts.
