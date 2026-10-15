<?php

declare(strict_types=1);

namespace App\Actions\Procurement;

use App\Models\GoodsReceipt;
use App\Models\PurchaseOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class LinkGoodsReceiptToPurchaseOrderAction
{
    public function __construct(
        private readonly ReconcileThreeWayMatchAction $reconcileThreeWayMatch
    ) {}

    /**
     * Link an unlinked Goods Receipt to a Purchase Order and execute 3-Way Match reconciliation.
     *
     * @return array{
     *     receipt: GoodsReceipt,
     *     audit: array{
     *         match_status: string,
     *         ordered_base_qty: int,
     *         received_base_qty: int,
     *         qty_variance_base: int,
     *         expected_cost_cents: int,
     *         invoice_amount_cents: int|null,
     *         cost_variance_cents: int,
     *         suggested_debit_memo_cents: int,
     *     }
     * }
     */
    public function execute(GoodsReceipt $receipt, PurchaseOrder $po): array
    {
        if ($receipt->supplier_id !== $po->supplier_id) {
            throw ValidationException::withMessages([
                'purchase_order_id' => 'The selected purchase order does not belong to the same supplier as this delivery.',
            ]);
        }

        return DB::transaction(function () use ($receipt, $po) {
            $po->loadMissing(['lines']);
            $receipt->loadMissing(['lines']);

            $receipt->update([
                'purchase_order_id' => $po->id,
            ]);

            // Attempt to link lines by matching product_id where unlinked
            foreach ($receipt->lines as $grLine) {
                if ($grLine->purchase_order_line_id === null) {
                    $matchingPoLine = $po->lines->firstWhere('product_id', $grLine->product_id);
                    if ($matchingPoLine !== null) {
                        $grLine->update([
                            'purchase_order_line_id' => $matchingPoLine->id,
                        ]);
                    }
                }
            }

            // Run 3-Way Match
            $audit = $this->reconcileThreeWayMatch->execute($receipt);

            // Reconcile overall PO received status
            $totalOrderedBase = (int) $po->lines->sum('ordered_base_qty');
            $totalReceivedBase = (int) DB::table('goods_receipt_lines')
                ->join('goods_receipts', 'goods_receipt_lines.goods_receipt_id', '=', 'goods_receipts.id')
                ->where('goods_receipts.purchase_order_id', $po->id)
                ->sum('goods_receipt_lines.received_base_qty');

            if ($totalReceivedBase >= $totalOrderedBase && $totalOrderedBase > 0) {
                $po->update(['status' => 'COMPLETED']);
            } elseif ($totalReceivedBase > 0) {
                $po->update(['status' => 'PARTIALLY_RECEIVED']);
            }

            return [
                'receipt' => $receipt->fresh(['purchaseOrder.lines.product', 'lines.product', 'lines.uom', 'supplier']),
                'audit' => $audit,
            ];
        });
    }
}
