# Multi-UOM & Base Unit Atomicity Guide

## 1. Lowest-Common-Denominator Rule
- All internal inventory storage, transfers, arithmetic, and ledger entries MUST use the **absolute lowest indivisible base unit** (e.g., Piece, Each, Bottle, Can).
- Column data types for discrete quantities must always be integer types (`INT` or `BIGINT`).
- **Negative Constraint**: Never use `FLOAT` or `DOUBLE` for discrete item inventory to prevent floating-point rounding errors.

## 2. Multi-UOM Conversion Pattern
- Packaging tiers (e.g., Cases, Packs, Pallets) relate to the base unit via an integer `conversion_factor`.
- Calculations:
  - Inbound Receiving: `base_units = entered_quantity * conversion_factor` (e.g., 5 Cases × 24 = 120 Pieces).
  - Outbound Sales / Transfers: Always convert packaging tiers to whole base units before updating the ledger and balance cache.
- Stock splits (breaking a Case into Pieces) require zero rounding adjustments because the base unit is already indivisible.
