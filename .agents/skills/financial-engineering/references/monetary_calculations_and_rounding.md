# Monetary Calculations, Precision & Rounding Reference

## 1. The Core Hazard: Floating-Point Math
Computers use binary floating-point (IEEE 754) which cannot represent decimal fractions like `0.1` or `0.05` with exact precision.
```php
// In native PHP float:
0.1 + 0.2 === 0.3; // FALSE! Evaluates to 0.30000000000000004
```
In an enterprise POS or DSD system executing thousands of daily line items, raw float arithmetic accumulates missing or phantom pennies, corrupts customer balances, and causes audit failures with statutory tax agencies.

---

## 2. Representation Standards: Database & Application Layers

| Data Element | MySQL Schema Type | PHP 8.4 Representation | TypeScript Representation |
| :--- | :--- | :--- | :--- |
| **Unit Price / Unit Cost** | `DECIMAL(18, 4)` | `BcMath\Number` or `string` | `string` / `number` (cents * 100) |
| **Tax Rate / Discount %** | `DECIMAL(6, 4)` | `BcMath\Number` or `string` | `number` (e.g. 0.1200) |
| **Line Subtotal / Line Total** | `DECIMAL(18, 2)` | `BcMath\Number` or integer cents | `number` (integer cents) |
| **Invoice / Payment Grand Total** | `DECIMAL(18, 2)` | `BcMath\Number` or integer cents | `number` (integer cents) |
| **AR Ledger Balance** | `DECIMAL(18, 2)` | `BcMath\Number` or integer cents | `number` (integer cents) |

- **Unit Rates (4 Decimals)**: Storing unit costs and prices to 4 decimal places (`0.0325`) prevents loss of precision when converting across packaging units (e.g., breaking a 24-pack down to individual pieces).
- **Totals & Balances (2 Decimals or Integer Cents)**: Real-world transactions clear in indivisible minor units (cents). Invoices, cash tenders, and AR debits must resolve to exact cents.

---

## 3. Native PHP 8.4 Arbitrary Precision (`BcMath\Number`)
PHP 8.4 introduces the native `BcMath\Number` class with operator overloading and explicit rounding modes. This eliminates third-party dependencies while guaranteeing 100% precision:

```php
declare(strict_types=1);

namespace App\Support\Financial;

use BcMath\Number;
use RoundingMode;

final class Money
{
    private Number $amount;
    private string $currency;

    public function __construct(string|int|Number $amount, string $currency = 'PHP')
    {
        $this->amount = $amount instanceof Number ? $amount : new Number((string) $amount);
        $this->currency = $currency;
    }

    public function add(Money $other): self
    {
        $this->assertSameCurrency($other);
        return new self($this->amount + $other->amount, $this->currency);
    }

    public function subtract(Money $other): self
    {
        $this->assertSameCurrency($other);
        return new self($this->amount - $other->amount, $this->currency);
    }

    public function multiply(string|int|Number $multiplier): self
    {
        $factor = $multiplier instanceof Number ? $multiplier : new Number((string) $multiplier);
        return new self($this->amount * $factor, $this->currency);
    }

    public function round(int $scale = 2, RoundingMode $mode = RoundingMode::HalfAwayFromZero): self
    {
        return new self($this->amount->round($scale, $mode), $this->currency);
    }

    public function toMinorUnits(): int
    {
        return (int) (string) ($this->amount->round(2, RoundingMode::HalfAwayFromZero) * new Number('100'));
    }

    public function toDecimalString(int $scale = 2): string
    {
        return (string) $this->amount->round($scale, RoundingMode::HalfAwayFromZero);
    }

    private function assertSameCurrency(Money $other): void
    {
        if ($this->currency !== $other->currency) {
            throw new \InvalidArgumentException("Currency mismatch: {$this->currency} vs {$other->currency}");
        }
    }
}
```

---

## 4. Fowler's Allocation Algorithm (Penny Conservation)

### The Problem
When distributing an order-level discount (e.g. ₱10.00) or tax across multiple lines with odd proportions (e.g., 3 equal lines), naive division produces repeating decimals:
$$\frac{10.00}{3} = 3.333333...$$
If you round each to ₱3.33:
$$3.33 + 3.33 + 3.33 = 9.99 \quad (\text{1 cent leaked!})$$

### The Solution: Largest Remainder Method (Hare-Niemeyer / Fowler Allocation)
1. Convert total amount to integer minor units (cents).
2. Calculate the base integer share for each line: $\lfloor \text{Total} \times \frac{\text{Weight}_i}{\sum \text{Weights}} \rfloor$.
3. Compute the remainder cents: $\text{Remainder} = \text{Total} - \sum \text{BaseShares}$.
4. Rank line items by their fractional remainders in descending order.
5. Distribute 1 cent to each top line item until the remainder reaches zero.

```php
declare(strict_types=1);

namespace App\Support\Financial;

final class PennyAllocator
{
    /**
     * Allocates an integer amount of cents proportionally across weights without leaking a single cent.
     *
     * @param int $totalCents Total amount in minor units
     * @param array<int|string, int> $weights Proportional integer weights (e.g. line item amounts)
     * @return array<int|string, int> Allocated cents per key matching exact input sum
     */
    public static function allocate(int $totalCents, array $weights): array
    {
        $sumWeights = array_sum($weights);
        if ($sumWeights === 0) {
            throw new \InvalidArgumentException('Sum of allocation weights cannot be zero.');
        }

        $allocated = [];
        $remainders = [];
        $currentSum = 0;

        foreach ($weights as $key => $weight) {
            // Integer division for floor share
            $share = intdiv($totalCents * $weight, $sumWeights);
            $allocated[$key] = $share;
            $currentSum += $share;
            
            // Fractional remainder for tie-breaking
            $remainders[$key] = ($totalCents * $weight) % $sumWeights;
        }

        $remainderCents = $totalCents - $currentSum;

        // Sort keys by remainder descending
        arsort($remainders, SORT_NUMERIC);

        // Distribute remaining cents one-by-one
        foreach (array_keys($remainders) as $key) {
            if ($remainderCents <= 0) {
                break;
            }
            $allocated[$key]++;
            $remainderCents--;
        }

        return $allocated;
    }
}
```

**Invariant Verification**:
`array_sum($allocated) === $totalCents` is mathematically guaranteed in 100% of cases.

---

## 5. Tax Calculation: Line-Item vs Aggregate Reconciliation

### Invariant: Line Totals Must Sum Exactly to Invoice Grand Total
In POS receipts and DSD invoices, statutory authorities require customer receipts to be self-consistent:
$$\sum_{i=1}^n \text{LineTotal}_i \equiv \text{Invoice.GrandTotal}$$

### The Standard Calculation Pipeline:
1. **Line Subtotal**: $\text{Qty} \times \text{UnitPrice}$ (calculated at 4 decimals).
2. **Line Discounts**: Deduct product/promotional discounts from line subtotal.
3. **Allocated Order Discount**: Use `PennyAllocator` to distribute cart-wide discounts down to lines.
4. **Taxable Base**: $\text{LineTaxableBase} = \text{LineSubtotal} - \text{LineDiscount} - \text{AllocatedOrderDiscount}$.
5. **Line Tax**:
   - **Tax-Exclusive**: $\text{LineTax} = \text{roundHalfUp}(\text{LineTaxableBase} \times \text{TaxRate}, 2)$.
   - **Tax-Inclusive**: $\text{LineTax} = \text{LineSubtotal} - \text{roundHalfUp}\left(\frac{\text{LineSubtotal}}{1 + \text{TaxRate}}, 2\right)$.
6. **Line Total**:
   - Tax-Exclusive: $\text{LineTaxableBase} + \text{LineTax}$.
   - Tax-Inclusive: $\text{LineTaxableBase}$ (tax is extracted, not added).
7. **Invoice Grand Total**: $\sum \text{LineTotal}_i$.

---

## 6. Multi-UOM Price Atomicity
When breaking a master container (e.g. Case of 24 = ₱1,200.00):
- If the pricing matrix defines a piece price (e.g. ₱55.00), use the explicit piece price.
- If no explicit piece price exists, unit price is derived: $\frac{1200.00}{24} = 50.0000$.
- If a package does not divide cleanly (e.g., 3-pack for ₱100.00):
  - Base unit price is stored as $\text{DECIMAL}(18, 4)$ = `33.3333`.
  - When customer buys 3 individual pieces, the POS line calculates $3 \times 33.3333 = 99.9999 \to 100.00$.
  - Explicit piece pricing in master catalog is ALWAYS preferred over programmatic division.
