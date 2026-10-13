# SOLID Principles in Laravel & React

## 1. Single Responsibility Principle (SRP)
- Controllers: Accept HTTP request, invoke Action/Service, return Resource/Inertia view.
- Form Requests: Validate input parameters and authorize user request.
- Actions: Execute a single business workflow (`CreatePurchaseOrderAction`).
- Eloquent Models: Define database schema relations, casts, and scopes. Do not write complex multi-table orchestration inside models.

## 2. Open/Closed Principle (OCP)
- Use Strategy or Pipeline patterns for extensible calculations:
  - Example: `DiscountPipeline` allowing stacking discount rules (Promotional, Volume, Customer-tier) without modifying core order checkout code.

## 3. Liskov Substitution Principle (LSP)
- Swap hardware drivers (e.g. `NetworkThermalPrinter` vs `BluetoothThermalPrinter`) behind a common `ThermalPrinterInterface` without altering printing workflows.

## 4. Interface Segregation Principle (ISP)
- Create narrow, specialized interfaces rather than "god" interfaces.
- Prefer `CanCalculateTaxInterface` over a bloated `ECommerceManagerInterface`.

## 5. Dependency Inversion Principle (DIP)
- Inject abstractions via constructors.
- Bind contracts in `AppServiceProvider`:
  `$this->app->bind(ReceiptPrinterInterface::class, EscPosReceiptPrinter::class);`
