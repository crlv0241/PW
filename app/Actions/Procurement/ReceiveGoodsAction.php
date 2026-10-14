<?php

declare(strict_types=1);

namespace App\Actions\Procurement;

use App\Actions\Inventory\RecordStockMovementAction;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptLine;
use App\Models\Location;
use App\Models\ProductUom;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ReceiveGoodsAction
{
    public function __construct(
        private readonly RecordStockMovementAction $recordStockMovement,
        private readonly ReconcileThreeWayMatchAction $reconcileThreeWayMatch
    ) {}

    /**
     * Executes physical goods intake into warehouse ledgers and balances.
     *
     * @param array{
     *     purchase_order_id?: int|null,
     *     supplier_id: int,
     *     location_id: int,
     *     received_by?: int|null,
     *     supplier_invoice_number?: string|null,
     *     supplier_delivery_note?: string|null,
     *     supplier_invoice_amount_cents?: int|null,
     *     notes?: string|null,
     *     lines: list<array{
     *         purchase_order_line_id?: int|null,
     *         product_id: int,
     *         product_uom_id: int,
     *         scanned_qty: int,
     *         rejected_qty?: int|null,
     *         batch_number?: string|null,
     *         expiry_date?: string|null,
     *         remarks?: string|null,
     *     }>
     * } $data
     */
    public function execute(array $data): GoodsReceipt
    {
        return DB::transaction(function () use ($data) {
            $year = date('Y');
            $latestGr = GoodsReceipt::query()
                ->whereYear('created_at', (int) $year)
                ->latest('id')
                ->lockForUpdate()
                ->first();

            $sequence = $latestGr !== null ? ((int) substr($latestGr->gr_number, -4)) + 1 : 1;
            $grNumber = sprintf('GR-%s-%04d', $year, $sequence);

            $goodsReceipt = GoodsReceipt::create([
                'gr_number' => $grNumber,
                'purchase_order_id' => $data['purchase_order_id'] ?? null,
                'supplier_id' => $data['supplier_id'],
                'location_id' => $data['location_id'],
                'received_by' => $data['received_by'] ?? null,
                'status' => 'COMPLETED',
                'match_status' => 'PENDING',
                'supplier_invoice_number' => $data['supplier_invoice_number'] ?? null,
                'supplier_delivery_note' => $data['supplier_delivery_note'] ?? null,
                'supplier_invoice_amount_cents' => $data['supplier_invoice_amount_cents'] ?? null,
                'notes' => $data['notes'] ?? null,
                'received_at' => now(),
            ]);

            // Locate damage quarantine location if available
            $damageLocation = Location::query()->where('type', 'damage')->first();

            foreach ($data['lines'] as $lineInput) {
                $uom = ProductUom::query()
                    ->where('id', $lineInput['product_uom_id'])
                    ->where('product_id', $lineInput['product_id'])
                    ->firstOrFail();

                $conversionFactor = max(1, $uom->conversion_factor);
                $scannedQty = max(1, $lineInput['scanned_qty']);
                $rejectedPackages = max(0, (int) ($lineInput['rejected_qty'] ?? 0));

                $receivedBaseQty = $scannedQty * $conversionFactor;
                $rejectedBaseQty = min($receivedBaseQty, $rejectedPackages * $conversionFactor);
                $acceptedBaseQty = $receivedBaseQty - $rejectedBaseQty;

                $grLine = GoodsReceiptLine::create([
                    'goods_receipt_id' => $goodsReceipt->id,
                    'purchase_order_line_id' => $lineInput['purchase_order_line_id'] ?? null,
                    'product_id' => $lineInput['product_id'],
                    'product_uom_id' => $lineInput['product_uom_id'],
                    'scanned_qty' => $scannedQty,
                    'conversion_factor' => $conversionFactor,
                    'received_base_qty' => $receivedBaseQty,
                    'rejected_base_qty' => $rejectedBaseQty,
                    'batch_number' => $lineInput['batch_number'] ?? null,
                    'expiry_date' => $lineInput['expiry_date'] ?? null,
                    'remarks' => $lineInput['remarks'] ?? null,
                ]);

                // 1. Post Accepted Stock to Destination Warehouse
                if ($acceptedBaseQty > 0) {
                    $this->recordStockMovement->execute(
                        clientUuid: (string) Str::uuid(),
                        locationId: $data['location_id'],
                        productId: $lineInput['product_id'],
                        qtyChange: $acceptedBaseQty,
                        transactionType: 'STOCK_IN',
                        referenceId: $goodsReceipt->id,
                        batchNumber: $lineInput['batch_number'] ?? null,
                        expiryDate: $lineInput['expiry_date'] ?? null,
                        notes: sprintf('Goods Receipt %s intake (accepted)', $grNumber)
                    );
                }

                // 2. Post Damaged Stock to Damage Quarantine Bay if present
                if ($rejectedBaseQty > 0 && $damageLocation !== null) {
                    $this->recordStockMovement->execute(
                        clientUuid: (string) Str::uuid(),
                        locationId: $damageLocation->id,
                        productId: $lineInput['product_id'],
                        qtyChange: $rejectedBaseQty,
                        transactionType: 'STOCK_IN',
                        referenceId: $goodsReceipt->id,
                        batchNumber: $lineInput['batch_number'] ?? null,
                        expiryDate: $lineInput['expiry_date'] ?? null,
                        notes: sprintf('Goods Receipt %s intake (damaged quarantine)', $grNumber)
                    );
                }

                // 3. Update PO Line Progress if linked
                if (! empty($lineInput['purchase_order_line_id'])) {
                    $poLine = PurchaseOrderLine::query()
                        ->where('id', $lineInput['purchase_order_line_id'])
                        ->lockForUpdate()
                        ->first();

                    if ($poLine !== null) {
                        $poLine->increment('received_base_qty', $receivedBaseQty);
                    }
                }
            }

            // 4. Update Parent PO status if present
            if ($goodsReceipt->purchase_order_id !== null) {
                /** @var PurchaseOrder $po */
                $po = PurchaseOrder::query()
                    ->where('id', $goodsReceipt->purchase_order_id)
                    ->with('lines')
                    ->lockForUpdate()
                    ->firstOrFail();

                $allReceived = true;
                foreach ($po->lines as $line) {
                    if ($line->received_base_qty < $line->ordered_base_qty) {
                        $allReceived = false;
                        break;
                    }
                }

                $po->update([
                    'status' => $allReceived ? 'COMPLETED' : 'PARTIALLY_RECEIVED',
                ]);

                // Run automatic 3-Way Match evaluation
                $this->reconcileThreeWayMatch->execute($goodsReceipt);
            }

            return $goodsReceipt->fresh(['lines.product', 'lines.uom', 'supplier', 'location', 'purchaseOrder']);
        });
    }
}
