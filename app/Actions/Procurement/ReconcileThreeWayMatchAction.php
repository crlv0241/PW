<?php

declare(strict_types=1);

namespace App\Actions\Procurement;

use App\Models\GoodsReceipt;
use App\Models\PurchaseOrder;

final class ReconcileThreeWayMatchAction
{
    /**
     * Evaluates Purchase Order quantities/costs vs Physical Receipt vs Supplier Invoice.
     *
     * @return array{
     *     match_status: string,
     *     ordered_base_qty: int,
     *     received_base_qty: int,
     *     qty_variance_base: int,
     *     expected_cost_cents: int,
     *     invoice_amount_cents: int|null,
     *     cost_variance_cents: int,
     *     suggested_debit_memo_cents: int,
     * }
     */
    public function execute(GoodsReceipt $receipt): array
    {
        if ($receipt->purchase_order_id === null) {
            $receipt->update(['match_status' => 'UNLINKED']);

            return [
                'match_status' => 'UNLINKED',
                'ordered_base_qty' => 0,
                'received_base_qty' => (int) $receipt->lines()->sum('received_base_qty'),
                'qty_variance_base' => 0,
                'expected_cost_cents' => 0,
                'invoice_amount_cents' => $receipt->supplier_invoice_amount_cents,
                'cost_variance_cents' => 0,
                'suggested_debit_memo_cents' => 0,
            ];
        }

        /** @var PurchaseOrder $po */
        $po = PurchaseOrder::query()
            ->where('id', $receipt->purchase_order_id)
            ->with(['lines'])
            ->firstOrFail();

        $receipt->loadMissing('lines');

        $totalOrderedBase = (int) $po->lines->sum('ordered_base_qty');
        $totalReceivedBase = (int) $receipt->lines->sum('received_base_qty');
        $qtyVarianceBase = $totalReceivedBase - $totalOrderedBase;

        // Calculate expected value of received items at agreed contractual PO net unit prices
        $expectedCostCents = 0;
        foreach ($receipt->lines as $grLine) {
            $poLine = $po->lines->firstWhere('id', $grLine->purchase_order_line_id)
                ?? $po->lines->firstWhere('product_id', $grLine->product_id);

            if ($poLine !== null) {
                $expectedCostCents += $grLine->received_base_qty * $poLine->net_base_cost_cents;
            }
        }

        $invoiceAmountCents = $receipt->supplier_invoice_amount_cents;
        $costVarianceCents = $invoiceAmountCents !== null ? $invoiceAmountCents - $expectedCostCents : 0;
        $suggestedDebitMemoCents = 0;

        // Determine 3-Way Match Classification
        if ($qtyVarianceBase < 0) {
            $matchStatus = 'SHORT_DELIVERY';
            // Suggested debit memo for missing units based on agreed PO line prices
            $missingBaseQty = abs($qtyVarianceBase);
            $avgNetBaseCost = $totalOrderedBase > 0 ? intdiv($po->total_cents, $totalOrderedBase) : 0;
            $suggestedDebitMemoCents = $missingBaseQty * $avgNetBaseCost;
        } elseif ($qtyVarianceBase > 0) {
            $matchStatus = 'OVER_DELIVERY';
        } elseif ($costVarianceCents !== 0) {
            $matchStatus = 'PRICE_VARIANCE';
            if ($costVarianceCents > 0) {
                $suggestedDebitMemoCents = $costVarianceCents;
            }
        } else {
            $matchStatus = 'PERFECT_MATCH';
        }

        $receipt->update(['match_status' => $matchStatus]);

        return [
            'match_status' => $matchStatus,
            'ordered_base_qty' => $totalOrderedBase,
            'received_base_qty' => $totalReceivedBase,
            'qty_variance_base' => $qtyVarianceBase,
            'expected_cost_cents' => $expectedCostCents,
            'invoice_amount_cents' => $invoiceAmountCents,
            'cost_variance_cents' => $costVarianceCents,
            'suggested_debit_memo_cents' => $suggestedDebitMemoCents,
        ];
    }
}
