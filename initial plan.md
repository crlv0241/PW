# System Architecture Document v1.0

## 1. Executive Summary
This document outlines the architectural blueprint for an enterprise-grade Direct Store Delivery (DSD), Point of Sale (POS), and Warehouse Management System (WMS). It transitions from standard CRUD operations to strict system invariants, utilizing an immutable ledger backed by an active balance cache, idempotent offline synchronization, and strict Unit of Measure (UOM) atomicity.

## 2. Technology Stack & Hardware Realities
- **Database**: MySQL 8 (Relational database optimized for ACID compliance and transactional locking).
- **Backend API**: Laravel (PHP 8.4) + Redis (Handles business logic, API endpoints, and asynchronous processing of offline sync payloads).
- **Back-Office Frontend**: Inertia.js v3 + React 19 + TypeScript + Tailwind CSS (Web portal for Encoders, Warehouse Managers, and Accounting).
- **Mobile Frontend**: React Native (Committed to React Native natively over PWA to guarantee raw TCP/Bluetooth socket access for ESC/POS thermal receipt printers and hardware barcode scanner integrations).

## 3. System Invariants & Non-Functional Requirements
These rules supersede general business logic and must be enforced at the API and database levels:
- **Lowest-Common-Denominator Atomicity**: All inventory is calculated, transferred, and stored in the absolute lowest base unit (e.g., Pieces/Eaches) to prevent floating-point rounding errors across varying container sizes.
- **Conservation of Value & Financial Precision**: Zero floating-point math across the application and database. All unit costs/prices use `DECIMAL(18, 4)`; totals and balances use integer minor units (cents). Order discounts and split taxes use Fowler's Penny Allocation Algorithm (Largest Remainder Method) to guarantee $\sum \text{line\_totals} \equiv \text{invoice.grand\_total}$.
- **Double-Entry General Ledger**: Every financial event (Sale, Payment, Return, Cash Drop, Adjustment) writes balanced journal entries enforcing $\sum \text{Debits} - \sum \text{Credits} \equiv 0$.
- **Idempotent Synchronization**: Every draft order, payment, and inventory count generated offline by a mobile device must carry a `client_uuid`. The Laravel API must verify this UUID before execution to prevent duplicate transactions during network retries.
- **Transactional Wrappers**: Any action affecting both financial state (AR) and physical state (Ledger) must be wrapped in a strict `DB::transaction()`.
- **Decoupled Auditing**: Variances between physical truck counts and ledger balances at End-of-Day must not block system operation; they automatically trigger an `InventoryVariance` record requiring managerial approval.

## 4. Refined Database Architecture
Rather than listing exhaustive column names, this schema defines the structural patterns required to prevent scaling and performance bottlenecks.

### 4.1 Master Data & Multi-UOM
- `products`: Master catalog (SKU, Name, Category).
- `product_uoms`: Relational table handling packaging complexity (`product_id`, name [Case, Pack, Piece], `conversion_factor`, `barcode`, `is_base_unit`).
- `locations`: Physical (Main Warehouse, Damage Bin) and Virtual (Truck 1, Truck 2).

### 4.2 The Ledger & Balance Cache Pattern
Calculating stock strictly via `SUM(qty_change)` will crash the database under heavy load. The system will use a Write-Ahead Ledger with a Read-Optimized Cache:
- `inventory_ledgers`: The immutable log. Tracks `location_id`, `product_id`, `qty_change`, `transaction_type` (StockIn, Transfer, Sale, Adjustment), `batch_number`, and `expiry_date` for FIFO routing.
- `inventory_balances`: The cache. A highly indexed table (`location_id`, `product_id`, `current_qty`) updated synchronously via database triggers or within the same DB transaction that writes to the ledger. All POS stock checks read from here.

### 4.3 The 3-Way Match (Purchasing)
- `purchase_orders` / `po_lines`: The intent to buy. Stores the complex JSON payload of stackable discounts.
- `goods_receipts` / `gr_lines`: The physical reality. The WMS worker blindly scans inbound stock. The API updates `inventory_ledgers` using the net cost calculated from the PO.
- `supplier_invoices`: The financial reality. Accounting clears payment only if PO quantities match GR quantities.

### 4.4 Financials, General Ledger & Routing
- `journal_entries` & `journal_lines`: Double-entry accounting journal enforcing zero-sum debits and credits across assets, liabilities, revenue, and expenses.
- `ar_transactions`: Customer sub-ledger tracking debits (Invoices) and credits (Payments, Returns) with pessimistic locking on credit limits (`lockForUpdate()`).
- `cash_shifts` & `cash_movements`: Drawer shifts, mid-shift drops to safe, and blind count reconciliation with automatic variance booking to Account 6010.
- `routes`: Associates a `truck_location_id`, `agent_id`, and date.
- `pricing_matrices`: Customer-specific pricing rules queried by the offline app during route download.

## 5. Offline Sync & Mobile Edge Strategy
To support field agents in zero-connectivity environments, the mobile architecture relies on a sync-queue strategy rather than direct API calls:
- **Morning Initialization**: The React Native app hits the `/api/v1/sync/down` endpoint. It downloads a compressed SQLite payload of the assigned route, customer balances, pricing matrices, and the truck's `inventory_balances`.
- **Field Execution**: The agent generates orders completely offline. The app stores these locally in an outbound queue table and immediately deducts the local truck balance to prevent double-selling the same physical item to two different customers.
- **Connectivity Restoration**: A background thread detects network availability and pushes the queue payload to Laravel (`POST /api/v1/sync/up`).
- **Encoder Finalization (Back-Office)**: The payload enters a "Pending Order Queue" on the Encoder's screen. The Encoder verifies the details and clicks "Finalize", which executes the DB transaction to deduct the central `inventory_ledgers` and charge the customer's `ar_transactions`.
