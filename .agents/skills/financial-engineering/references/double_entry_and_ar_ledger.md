# Double-Entry Bookkeeping & Accounts Receivable (AR) Ledger Reference

## 1. The Financial Invariant: Conservation of Value
Just as physical stock movements are conserved in `inventory_ledgers`, all monetary movements must obey the fundamental accounting equation:
$$\text{Assets} = \text{Liabilities} + \text{Equity}$$

### The Universal Invariant
Every financial transaction consists of at least two balanced entries where:
$$\sum \text{Debits} - \sum \text{Credits} \equiv 0$$
Money is never created from nothing or lost to the ether; it is always debited from one account and credited to another.

---

## 2. Standard Chart of Accounts (POS / WMS / DSD)

| Code | Account Name | Type | Normal Balance | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **1010** | Cash on Hand (POS Drawer / Truck) | Asset | Debit | Physical cash held in register or truck safe |
| **1020** | Bank Clearing (Checks / Electronic) | Asset | Debit | Undeposited checks and digital card payments |
| **1100** | Accounts Receivable (Trade Debtors) | Asset | Debit | Customer credit balances owed to the business |
| **1200** | Merchandise Inventory | Asset | Debit | Valuation of stock held in warehouses and trucks |
| **2010** | Accounts Payable (Suppliers) | Liability | Credit | Balances owed to vendors for PO receipts |
| **2100** | VAT / Sales Tax Payable | Liability | Credit | Output tax collected on behalf of tax authorities |
| **2200** | Customer Advance Deposits | Liability | Credit | Unapplied customer overpayments/credits |
| **4010** | Sales Revenue | Revenue | Credit | Gross revenue from goods sold |
| **4020** | Sales Returns & Allowances | Revenue (Contra) | Debit | Offsetting deduction for returned goods |
| **5010** | Cost of Goods Sold (COGS) | Expense | Debit | Cost valuation of inventory sold |
| **6010** | Cash Shortage / Overage | Expense | Debit/Credit | Discrepancies during register / truck reconciliation |
| **6020** | Sales Discounts Allowed | Expense | Debit | Trade, volume, and prompt payment discounts |

---

## 3. Standard Financial Transactions & Balancing Entries

### A. Cash POS Sale (Register / Mobile Truck)
Customer purchases ₱1,120.00 inclusive of 12% VAT (₱1,000.00 base + ₱120.00 tax). Inventory cost is ₱700.00.
```
Debit:  1010 Cash on Hand            ₱1,120.00
Credit: 4010 Sales Revenue                       ₱1,000.00
Credit: 2100 VAT Payable                           ₱120.00
(Simultaneous Cost Entry):
Debit:  5010 Cost of Goods Sold        ₱700.00
Credit: 1200 Merchandise Inventory                 ₱700.00
Net Balance: ₱1,820.00 Dr - ₱1,820.00 Cr = 0
```

### B. Credit Sale / DSD Invoicing
Customer #105 purchases ₱5,000.00 on 30-day payment terms.
```
Debit:  1100 Accounts Receivable     ₱5,000.00 (Customer #105 sub-ledger)
Credit: 4010 Sales Revenue                       ₱4,464.29
Credit: 2100 VAT Payable                           ₱535.71
Net Balance: ₱5,000.00 Dr - ₱5,000.00 Cr = 0
```

### C. Customer Payment Collection (Cash / Check)
Customer #105 pays ₱3,000.00 via check.
```
Debit:  1020 Bank Clearing           ₱3,000.00
Credit: 1100 Accounts Receivable                 ₱3,000.00 (Customer #105 sub-ledger)
Net Balance: ₱3,000.00 Dr - ₱3,000.00 Cr = 0
```

### D. Sales Return with Credit Memo
Customer returns ₱560.00 of merchandise for credit.
```
Debit:  4020 Sales Returns             ₱500.00
Debit:  2100 VAT Payable                ₱60.00
Credit: 1100 Accounts Receivable                   ₱560.00 (Customer #105 sub-ledger)
(Restock Inventory Entry):
Debit:  1200 Merchandise Inventory     ₱350.00
Credit: 5010 Cost of Goods Sold                    ₱350.00
Net Balance: ₱910.00 Dr - ₱910.00 Cr = 0
```

### E. End-of-Day Cash Drawer Variance (Shortage / Overage)
Expected drawer cash is ₱15,000.00, physical count is ₱14,950.00 (₱50.00 shortage).
```
Debit:  6010 Cash Shortage / Overage     ₱50.00
Credit: 1010 Cash on Hand                           ₱50.00
Net Balance: ₱50.00 Dr - ₱50.00 Cr = 0
```

---

## 4. Accounts Receivable (AR) Sub-Ledger & Concurrency Control

### Pessimistic Locking on Credit Limits
When creating an invoice on credit, concurrent POS lanes or mobile sync batches could exceed the customer's credit limit simultaneously (race condition).

**Mandatory Transaction Pattern**:
```php
declare(strict_types=1);

namespace App\Actions\Financial;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\ArTransaction;
use Illuminate\Support\Facades\DB;
use App\Exceptions\CreditLimitExceededException;

final class RecordCreditSaleAction
{
    public function execute(int $customerId, int $invoiceTotalCents, array $invoiceData): Invoice
    {
        return DB::transaction(function () use ($customerId, $invoiceTotalCents, $invoiceData) {
            // 1. Acquire pessimistic lock on customer account record
            $customer = Customer::query()
                ->where('id', $customerId)
                ->lockForUpdate()
                ->firstOrFail();

            // 2. Validate current balance + new invoice against credit limit
            $newBalance = $customer->current_balance_cents + $invoiceTotalCents;
            if ($customer->credit_limit_cents !== null && $newBalance > $customer->credit_limit_cents) {
                throw new CreditLimitExceededException(
                    "Credit limit exceeded for Customer #{$customer->id}. Limit: {$customer->credit_limit_cents}, Projected: {$newBalance}"
                );
            }

            // 3. Create the immutable Invoice record
            $invoice = Invoice::create($invoiceData);

            // 4. Append AR debit transaction row (Immutable Log)
            ArTransaction::create([
                'client_uuid' => $invoiceData['client_uuid'],
                'customer_id' => $customer->id,
                'invoice_id' => $invoice->id,
                'type' => 'INVOICE_DEBIT',
                'amount_cents' => $invoiceTotalCents,
                'balance_after_cents' => $newBalance,
            ]);

            // 5. Update cached running balance on customer
            $customer->update(['current_balance_cents' => $newBalance]);

            return $invoice;
        });
    }
}
```

---

## 5. Aging Buckets & Statement Generation
Accounts Receivable balances must be deterministically bucketed by invoice due date:
- **Current (Not Due)**: $\text{Age} \le 0$ days
- **1–30 Days Overdue**: $1 \le \text{Age} \le 30$
- **31–60 Days Overdue**: $31 \le \text{Age} \le 60$
- **61–90 Days Overdue**: $61 \le \text{Age} \le 90$
- **90+ Days Overdue**: $\text{Age} > 90$

All aging calculations must use date boundaries derived from UTC calendar days to prevent timezone drift across mobile edge and central server.
