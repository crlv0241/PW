# POS, WMS & DSD Detailed Development Plan

This document operationalizes [initial plan.md](file:///Users/macuser/Desktop/POS_WMS/pos_wms/initial%20plan.md) into structured, incremental engineering phases. Every phase enforces the system invariants, clean architecture, and UI/UX standards established in [AGENTS.md](file:///Users/macuser/Desktop/POS_WMS/pos_wms/AGENTS.md).

---

## Architectural Principles Enforced Across All Phases
1. **Lowest-Common-Denominator Unit Atomicity**: All inventory math runs on integer base units (pieces/eaches). Packaging UOMs convert via explicit multiplier factors. Zero floating-point stock math.
2. **Write-Ahead Immutable Ledger & Balance Cache**: Physical changes write immutable, append-only logs (`inventory_ledgers`) and synchronously update indexed cache (`inventory_balances`) inside `DB::transaction()`. Live `SUM(qty_change)` queries are prohibited.
3. **Idempotent Synchronization**: Every offline/POS mutation carries a `client_uuid`. Duplicated UUIDs return cached responses without double-booking stock or charges.
4. **Coupled Financial & Physical Atomic Transactions**: Invoicing and stock deduction succeed or roll back together. External I/O is dispatched after commit via `DB::afterCommit()`.
5. **Zero Emoji & Accessible UI/UX**: Professional SVG icons (`lucide-react`), animated pulsing skeletons (`animate-pulse`) for async loading, searchable comboboxes for all entity selects, and styled React modals (no browser `alert()`/`confirm()`).

---

## Phase 1: Foundation, Multi-UOM Catalog & Master Data
**Goal**: Establish core database infrastructure, entity catalog, physical/virtual location models, and integer UOM conversion engine.

### Modules & Deliverables:
- **Module 1.1: Database Schemas & Migrations**
  - `products`: SKU (unique), name, category, status, tax category.
  - `product_uoms`: `product_id`, name (Piece, Pack, Case, Pallet), `conversion_factor` (integer), `barcode` (unique indexed), `is_base_unit` (boolean).
  - `locations`: Physical warehouses, staging bays, damage bins, and virtual truck locations (`type`: `warehouse`, `truck`, `damage`, `staging`).
  - `customers`: Account code, company name, delivery address, credit limit (`DECIMAL(14, 4)`), payment terms.
  - `suppliers`: Supplier code, name, contact, payment terms.
- **Module 1.2: Multi-UOM Conversion Service**
  - `UomConversionService`: Bidirectional conversions between packaging tiers and base units. Guarantees integer math without fractional pieces.
  - Pest Invariant Tests: Asserting whole-integer math and rejection of invalid ratios.
- **Module 1.3: Back-Office Management UI (Inertia + React)**
  - Product Catalog Table: Server-side pagination, 300ms debounced SKU/name search, UOM badge list.
  - Searchable Comboboxes: Integrated into customer, product, and location pickers (using `dropdown-engineering` standards).
  - Async Loading States: Pulsing skeleton rows during table filter navigations.

---

## Phase 2: Write-Ahead Ledger & Active Balance Cache Engine
**Goal**: Build the immutable physical inventory engine, balance cache synchronization, row-level locking, and transfer mechanisms.

### Modules & Deliverables:
- **Module 2.1: Ledger & Balance Schemas**
  - `inventory_ledgers`: `id`, `client_uuid` (unique index), `location_id`, `product_id`, `qty_change` (signed integer in base units), `transaction_type` (StockIn, Transfer, Sale, Adjustment), `batch_number`, `expiry_date`, `created_at`.
  - `inventory_balances`: `id`, `location_id`, `product_id`, `current_qty` (integer base units), `updated_at`. Compound unique index on `(location_id, product_id)`.
- **Module 2.2: Atomic Stock Movement Action**
  - `RecordStockMovementAction`: Executes dual-write (ledger append + balance update) within `DB::transaction()`.
  - Pessimistic Locking: Acquires `lockForUpdate()` on balance rows in deterministic ascending `product_id` order to prevent deadlocks under high concurrency.
- **Module 2.3: Location Transfers & Inventory Adjustments**
  - Warehouse-to-Truck and Bay-to-Damage stock transfer workflows.
  - Manager-supervised stock adjustment action requiring reason codes and audit log tracking.
- **Module 2.4: Real-Time Stock & Ledger Audit UI**
  - Stock Balances Dashboard: Filterable by warehouse/truck location with low-stock alerts.
  - Ledger Movement Log: Virtualized table for high-volume audit logs with date-range filters.

---

## Phase 3: Inbound Procurement & The 3-Way Match (WMS)
**Goal**: Implement purchase order workflows, blind barcode scanning for goods receipts, and 3-way matching financial verification.

### Modules & Deliverables:
- **Module 3.1: Purchasing Schemas & Stackable Discounts**
  - `purchase_orders` & `po_lines`: Ordered quantities in packaging UOMs, unit costs, and stackable discount JSON payloads (promotional, volume, vendor discounts).
  - Net cost calculator resolving effective purchase price per base unit.
- **Module 3.2: Blind Receiving & Goods Receipt (WMS Scan)**
  - `goods_receipts` & `gr_lines`: Warehouse receiving interface.
  - Hardware Barcode Scanner integration (< 50ms keystroke listener) for rapid blind scanning.
  - Inbound intake action: Appends `StockIn` rows to `inventory_ledgers` using the net PO unit cost and updates `inventory_balances`.
- **Module 3.3: 3-Way Match Engine & Supplier Invoicing**
  - `supplier_invoices`: Financial invoice entry from vendor.
  - `MatchPurchaseOrderAction`: Automatically compares PO quantity, GR physical scan, and Supplier Invoice amounts.
  - Variance Handling: Automatic allocation of damaged goods to `damage` location and generation of vendor credit memos for under-deliveries.
  - Reconciliation UI: Color-coded match comparison table with one-click approval dialogs.

---

## Phase 4: Pricing Matrices, Double-Entry AR & Financial Precision Engine
**Goal**: Deliver customer-specific pricing engines, Fowler penny allocation algorithms, immutable AR debit/credit ledgers with double-entry balancing, and pessimistic credit limit guards.

### Modules & Deliverables:
- **Module 4.1: Pricing Matrix & Money Engine**
  - Native `Money` value object backed by PHP 8.4 `BcMath\Number` and integer minor units (cents).
  - `pricing_matrices`: Customer-specific, route-specific, and volume-tier price rules with validity date ranges.
  - `PriceResolutionService`: Resolves base unit prices (`DECIMAL(18, 4)`) and active discounts for offline synchronization and live POS.
  - Redis Caching: Tagged caching for active customer pricing matrices.
- **Module 4.2: Fowler Penny Allocation & Tax Reconciliation**
  - `PennyAllocator`: Implementation of Martin Fowler's Largest Remainder Method (Hare-Niemeyer) for distributing order discounts and split taxes without losing a single cent.
  - Line-Item Tax Engine: Guaranteed self-consistency between line items and invoice grand totals (`invoice.grand_total === sum(line.total)`).
  - Historical Snapshotting: Immutable freezing of unit price, unit cost, tax rate, tax amount, discount amount, and total on line items.
- **Module 4.3: Double-Entry Accounts Receivable & General Ledger**
  - `journal_entries` & `journal_lines`: Double-entry accounting journal enforcing $\sum \text{Debits} - \sum \text{Credits} \equiv 0$ on every transaction.
  - `ar_transactions`: Customer financial sub-ledger tracking debits (Invoices) and credits (Payments, Returns, Adjustments).
  - Running balance calculation and aging buckets (Current, 1–30, 31–60, 61–90, 90+ days).
- **Module 4.4: Payments, Collections & Pessimistic Concurrency**
  - Payment entry supporting Cash, Check (with clearing date), and Bank Transfer.
  - Pessimistic Credit Limit Guard: Acquires `lockForUpdate()` on customer AR records inside `DB::transaction()` before booking sales to prevent race conditions.
  - Cash Shift & Drawer Lifecycle: Shift open (starting float), mid-shift cash drops to safe, and blind closeout denomination counts with automatic variance booking to Account 6010 (Cash Shortage/Overage).
  - AR Statements UI: Customer statement generation with filterable transaction history and PDF export.

---

## Phase 5: Route Logistics & DSD Field Operations
**Goal**: Schedule delivery routes, manage truck stock loading, and execute End-of-Day truck reconciliation with decoupled auditing.

### Modules & Deliverables:
- **Module 5.1: Route Dispatch & Truck Assignment**
  - `routes`: Links `truck_location_id`, `agent_id`, and `route_date`.
  - Customer Stop Sequence: Ordered stops assigned to route schedules.
- **Module 5.2: Morning Truck Loading (Transfer to Truck)**
  - Automated transfer action moving inventory from Main Warehouse to assigned Truck virtual location.
  - Mobile loading manifest verification via barcode scan.
- **Module 5.3: End-of-Day Truck Inventory Reconciliation**
  - Field agent performs physical truck count upon return.
  - System calculates difference between Physical Count and Truck `inventory_balances`.
  - **Decoupled Auditing Invariant**: Variances automatically record an `InventoryVariance` entry with audit reasons without blocking truck closeout.
  - Warehouse Manager review modal: Approve variance (writes ledger adjustment) or reject for physical recount.

---

## Phase 6: Offline-First Synchronization API (Backend)
**Goal**: Build bulletproof, idempotent endpoints for field mobile devices operating in zero-connectivity environments.

### Modules & Deliverables:
- **Module 6.1: Secure Device Auth & Route Scoping**
  - Sanctum API bearer tokens with device hardware fingerprinting.
  - `GET /api/v1/sync/down`: Generates compressed payload containing only the assigned route, customer records, pricing matrices, and truck balance cache.
- **Module 6.2: Offline Ingestion Endpoint & HMAC Verification**
  - `POST /api/v1/sync/up`: Ingests batch transactions (orders, payments, inventory counts).
  - HMAC-SHA256 signature verification and timestamp skew validation (< 15 min).
  - Strict Idempotency: `client_uuid` deduplication check prevents re-processing retried payloads.
- **Module 6.3: Asynchronous Redis Processing & Intake Staging**
  - Heavy sync batches validated and offloaded to `ProcessMobileSyncBatchJob` on Redis queues.
  - Immediate HTTP 202 Accepted response to mobile devices.
- **Module 6.4: Back-Office Encoder Pending Order Queue**
  - Dedicated web portal screen displaying incoming mobile draft orders.
  - Encoder review, line-item edit, and finalization.
  - Finalize Action: Executes `DB::transaction()` to deduct central inventory ledgers and debit customer AR accounts.

---

## 7. Phase 7: Mobile Field App & ESC/POS Thermal Printing (React Native)
**Goal**: Native mobile application for truck drivers and field agents with local SQLite offline queues and hardware printer integration.

### Modules & Deliverables:
- **Module 7.1: Local SQLite Storage & Outbound Queue**
  - Local database mimicking route schema, customer balances, and truck balance cache.
  - Outbound mutation queue table (`id`, `client_uuid`, `payload`, `status`: `PENDING`, `SYNCING`, `SYNCED`, `FAILED`).
  - Immediate local truck balance deduction upon order creation to prevent physical double-selling.
- **Module 7.2: POS Fast-Order Entry & Barcode Scanner**
  - Hardware barcode scanner integration via raw key event listeners.
  - Quick-add catalog with instant search and multi-UOM selector.
- **Module 7.3: Connectivity Watchdog & Auto-Push**
  - Background network monitor automatically triggering `POST /api/v1/sync/up` when internet connectivity restores.
  - Header sync pill showing offline/syncing/synced status with pending queue count.
- **Module 7.4: Configurable Hardware Printer & Device Engine**
  - Driver-Agnostic Printer Adapter Architecture: Decoupled interface supporting multiple hardware devices without vendor lock-in.
  - Multi-Protocol Connection Profiles: Configurable via settings for TCP/IP network socket, Bluetooth RFCOMM, USB OTG, and Serial COM.
  - Multi-Dialect Command Drivers: Driver strategies for standard ESC/POS, TSPL (label printing), StarPRNT, and raw CPCL dialects.
  - Configurable Paper & Column Profiles: Dynamic width adaptors for 58mm (32 columns), 80mm (42/48 columns), and custom print density.
  - Dynamic Monospace Receipt Builder: Configurable receipt and collection slip templates with customized headers, tax registration disclaimers, and barcodes.

---

## Phase 8: Hardening, Static Analysis & Enterprise Observability
**Goal**: Finalize automated test coverage, static analysis quality gates, query optimization, and production deployment readiness.

### Modules & Deliverables:
- **Module 8.1: Automated Invariant Test Suite (Pest)**
  - UOM integer rounding tests.
  - Financial precision tests: asserting zero float usage, zero penny leakage via `PennyAllocator`, and invoice line self-consistency (`sum(line.total) === invoice.grand_total`).
  - Double-entry zero-sum invariants: asserting $\sum \text{Debits} - \sum \text{Credits} \equiv 0$ across all sales, collections, and credit memos.
  - Concurrency & race condition tests: asserting customer credit limit enforcement under concurrent requests with pessimistic locking.
  - Dual-write ledger/balance transaction atomicity tests.
  - Concurrent deadlock stress tests with ascending ID locking.
  - Sync payload idempotency and replay attack tests.
- **Module 8.2: Static Analysis & Code Quality Gates**
  - Larastan Level 8+ analysis with zero errors.
  - TypeScript strict mode check (`npm run types:check`) with zero `any`.
  - Automated code formatting with Laravel Pint (`vendor/bin/pint --format agent`).
- **Module 8.3: Database Performance Profiling**
  - EXPLAIN query plan audits on high-frequency composite indexes.
  - Query count audits to guarantee zero N+1 queries across all index tables.
- **Module 8.4: Docker Production Tuning**
  - MySQL 8 InnoDB buffer pool and logging optimizations.
  - Redis persistence (`appendonly yes`) validation.
