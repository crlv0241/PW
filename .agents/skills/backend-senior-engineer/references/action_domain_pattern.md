# Action Domain Pattern & API Standards

## 1. Single-Action Architecture
- **Controllers**: Thin HTTP entry points. Responsible solely for:
  1. Authorizing and validating the request (via dedicated `FormRequest`).
  2. Invoking a Single-Action class with validated data or a typed DTO.
  3. Transforming the domain result into an Eloquent API Resource or Inertia view.
- **Action Classes**:
  - Encapsulate one specific business operation per class.
  - Expose a single public entry point (`execute()` or `__invoke()`).
  - Use constructor dependency injection for repositories, services, or sub-actions.
  - Return typed domain models, collections, or immutable result objects.

## 2. Form Requests & Input Validation
- Never call `$request->validate()` inline inside controllers or actions.
- Enforce strict validation rules (e.g., `required`, `uuid`, `integer`, `gt:0`, `exists:`).
- Use typed helper methods on the Form Request to expose validated fields cleanly.

## 3. Standardized API Envelopes & RFC 7807 Errors
- **Success Envelopes**:
  ```json
  {
    "success": true,
    "data": {},
    "meta": {}
  }
  ```
- **Error Envelopes (RFC 7807 Problem Details)**:
  ```json
  {
    "type": "error-code-identifier",
    "title": "Short Human-Readable Summary",
    "status": 422,
    "detail": "Detailed explanation of the specific validation or invariant violation.",
    "invalid_params": []
  }
  ```
