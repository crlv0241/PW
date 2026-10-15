<?php

declare(strict_types=1);

namespace App\Actions\Procurement;

use App\Models\PurchaseOrder;
use App\Models\SupplierPayment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class RecordSupplierPaymentAction
{
    /**
     * Record an Accounts Payable payment (Cash, Cheque, Bank Transfer) against a supplier and optionally a PO.
     *
     * @param array{
     *     supplier_id: int,
     *     purchase_order_id?: int|null,
     *     amount_cents: int,
     *     payment_method: string,
     *     payment_date: string,
     *     cheque_number?: string|null,
     *     bank_name?: string|null,
     *     cheque_date?: string|null,
     *     clearing_date?: string|null,
     *     payee_name?: string|null,
     *     reference_number?: string|null,
     *     voucher_number?: string|null,
     *     status?: string,
     *     notes?: string|null,
     *     recorded_by?: int|null,
     * } $data
     */
    public function execute(array $data): SupplierPayment
    {
        return DB::transaction(function () use ($data) {
            $year = date('Y');
            $latestPayment = SupplierPayment::query()
                ->whereYear('created_at', (int) $year)
                ->latest('id')
                ->lockForUpdate()
                ->first();

            $sequence = $latestPayment !== null ? ((int) substr($latestPayment->payment_number, -4)) + 1 : 1;
            $paymentNumber = sprintf('AP-PAY-%s-%04d', $year, $sequence);

            $po = null;
            if (! empty($data['purchase_order_id'])) {
                /** @var PurchaseOrder $po */
                $po = PurchaseOrder::query()
                    ->where('id', $data['purchase_order_id'])
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($po->supplier_id !== (int) $data['supplier_id']) {
                    throw ValidationException::withMessages([
                        'purchase_order_id' => 'The selected purchase order does not belong to this supplier.',
                    ]);
                }

                $remainingBalance = max(0, $po->total_cents - $po->paid_amount_cents);
                if ($data['amount_cents'] > $remainingBalance && $remainingBalance > 0) {
                    throw ValidationException::withMessages([
                        'amount_cents' => sprintf(
                            'Payment amount (₱%s) exceeds the remaining purchase order balance (₱%s).',
                            number_format($data['amount_cents'] / 100, 2),
                            number_format($remainingBalance / 100, 2)
                        ),
                    ]);
                }
            }

            $paymentStatus = $data['status'] ?? ($data['payment_method'] === 'CHEQUE' && ! empty($data['clearing_date']) ? 'PENDING_CLEARING' : 'COMPLETED');

            $payment = SupplierPayment::create([
                'payment_number' => $paymentNumber,
                'supplier_id' => $data['supplier_id'],
                'purchase_order_id' => $data['purchase_order_id'] ?? null,
                'amount_cents' => $data['amount_cents'],
                'payment_method' => $data['payment_method'],
                'payment_date' => $data['payment_date'],
                'cheque_number' => ! empty($data['cheque_number']) ? trim($data['cheque_number']) : null,
                'bank_name' => ! empty($data['bank_name']) ? trim($data['bank_name']) : null,
                'cheque_date' => ! empty($data['cheque_date']) ? $data['cheque_date'] : null,
                'clearing_date' => ! empty($data['clearing_date']) ? $data['clearing_date'] : null,
                'payee_name' => ! empty($data['payee_name']) ? trim($data['payee_name']) : null,
                'reference_number' => ! empty($data['reference_number']) ? trim($data['reference_number']) : null,
                'voucher_number' => ! empty($data['voucher_number']) ? trim($data['voucher_number']) : null,
                'status' => $paymentStatus,
                'notes' => ! empty($data['notes']) ? trim($data['notes']) : null,
                'recorded_by' => $data['recorded_by'] ?? null,
            ]);

            // Reconcile Purchase Order paid amounts if linked
            if ($po !== null) {
                $totalPaid = (int) $po->payments()
                    ->whereNotIn('status', ['VOID', 'BOUNCED'])
                    ->sum('amount_cents');

                $newPaymentStatus = 'UNPAID';
                if ($totalPaid >= $po->total_cents) {
                    $newPaymentStatus = 'PAID';
                } elseif ($totalPaid > 0) {
                    $newPaymentStatus = 'PARTIALLY_PAID';
                }

                $po->update([
                    'paid_amount_cents' => $totalPaid,
                    'payment_status' => $newPaymentStatus,
                ]);
            }

            return $payment->fresh(['supplier', 'purchaseOrder', 'recorder']);
        });
    }
}
