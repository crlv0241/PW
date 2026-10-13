# Offline Financial Idempotency, Cash Shifts & Split Payments Reference

## 1. The Distributed Financial Edge Problem
Field agents and DSD delivery drivers operate in dead zones (basements, rural store docks, patchy cellular). They take orders, issue receipts, and collect payments offline.
When connectivity restores, background workers push queues. Network timeouts and retries frequently send identical payloads multiple times.
**Without strict idempotency and cryptographic verification, customers get double-charged and payments double-booked.**

---

## 2. Idempotent Ingestion Pattern (`client_uuid`)

### Rules for Financial Mutations
1. Every payment collection and sales invoice MUST be assigned a UUID v4 generated on the client device at the instant of transaction creation.
2. The database MUST enforce `UNIQUE (client_uuid)` on `invoices`, `payments`, and `ar_transactions`.
3. If an existing `client_uuid` is posted:
   - DO NOT re-execute ledger inserts or update balances.
   - Return HTTP 200 OK with the originally recorded transaction and header `X-Idempotency-Replay: true`.

```php
declare(strict_types=1);

namespace App\Actions\Financial;

use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use App\Http\Resources\PaymentResource;
use Symfony\Component\HttpFoundation\Response;

final class RecordPaymentAction
{
    public function execute(array $payload): array
    {
        // 1. Idempotency Check: Return existing record if client_uuid already processed
        $existing = Payment::where('client_uuid', $payload['client_uuid'])->first();
        if ($existing !== null) {
            return [
                'replayed' => true,
                'payment' => $existing,
                'status' => Response::HTTP_OK,
            ];
        }

        // 2. Atomic Transaction Execution
        $payment = DB::transaction(function () use ($payload) {
            $payment = Payment::create([
                'client_uuid' => $payload['client_uuid'],
                'customer_id' => $payload['customer_id'],
                'amount_cents' => $payload['amount_cents'],
                'payment_method' => $payload['payment_method'], // CASH, CHECK, WIRE
                'reference_number' => $payload['reference_number'] ?? null,
                'shift_id' => $payload['shift_id'] ?? null,
                'collected_at' => $payload['collected_at'],
            ]);

            // Synchronously credit AR ledger and balance
            app(CreditCustomerArAction::class)->execute(
                customerId: $payload['customer_id'],
                amountCents: $payload['amount_cents'],
                paymentId: $payment->id,
                clientUuid: $payload['client_uuid']
            );

            return $payment;
        });

        return [
            'replayed' => false,
            'payment' => $payment,
            'status' => Response::HTTP_CREATED,
        ];
    }
}
```

---

## 3. Split Payments & Change Calculation

### Rules for Split Tenders
A transaction may be settled across multiple payment methods (e.g. ₱500 Cash + ₱500 Check on a ₱1,000 Invoice).

1. **Exact Allocation Invariant**:
   $$\sum_{j=1}^m \text{TenderAmount}_j \ge \text{Invoice.GrandTotal}$$
2. **Change Due Constraints**:
   - Change is **ONLY** allowed when Cash is tendered:
     $$\text{ChangeDue} = \max(0, \text{TotalCashTendered} - \text{RemainingUnpaid})$$
   - Checks, Credit Cards, and Customer Credit balances **NEVER produce change** (they must match or be less than the remaining balance).
3. **Overpayment on Account**:
   - If a customer pays via Check for more than the invoice total, the excess MUST be recorded as an unapplied credit in `Customer Advance Deposits` (Liability Account 2200), never returned as physical cash change.

---

## 4. Cash Drawer & Shift Management Architecture

To prevent cash loss, embezzlement, and drawer discrepancies, POS lanes and mobile truck safes follow a strict Shift Lifecycle:

```
+--------------------------------------------------------------------------+
| 1. Open Shift                                                            |
|    - Cashier enters starting float (e.g., ₱2,000.00)                     |
|    - Creates 'cash_shifts' record: status = OPEN                         |
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
| 2. Trading / Operations                                                  |
|    - Record Cash Sales (Increases Expected Cash)                         |
|    - Record Cash Collections (Increases Expected Cash)                   |
|    - Cash Drops (Manager transfers cash to safe; Decreases Expected Cash)|
|    - Paid Out / Petty Cash (Requires receipt & reason; Decreases Cash)   |
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
| 3. Shift Close: Blind Count Entry                                        |
|    - Cashier enters physical denomination counts without seeing system   |
|      expected total (avoids biased counts).                              |
|    - System computes:                                                    |
|      Expected = Float + CashSales + CashCollections - CashDrops - PaidOut|
|      Actual = PhysicalDenominationsCounted                               |
|      Variance = Actual - Expected                                        |
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
| 4. Closeout Finalization & Variance Booking                              |
|    - If Variance == 0: Clean close.                                      |
|    - If Variance != 0: Flagged; Manager enters mandatory reason note;    |
|      System writes balancing entry to 6010 Cash Shortage / Overage.      |
+--------------------------------------------------------------------------+
```

### Cash Shift Schema Requirements
- `cash_shifts`: `id`, `user_id`, `location_id` (terminal or truck), `opened_at`, `closed_at`, `opening_float_cents`, `closing_counted_cents`, `expected_cash_cents`, `variance_cents`, `status` (`OPEN`, `CLOSED`, `DISCREPANT`).
- `cash_denominations`: Breakdown of bills and coins (₱1000 x N, ₱500 x N, ₱100 x N, etc.).
- `cash_movements`: Immutable log of mid-shift drops and petty payouts (`amount_cents`, `type`: `DROP_TO_SAFE`, `PAY_OUT`, `reasons`, `approved_by`).
