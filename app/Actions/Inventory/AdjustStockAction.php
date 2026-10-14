<?php

declare(strict_types=1);

namespace App\Actions\Inventory;

use App\DTOs\StockMovementResult;
use App\Models\InventoryBalance;
use App\Models\InventoryLedger;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class AdjustStockAction
{
    /**
     * Executes a supervisor-approved stock adjustment with reason codes and audit trail.
     *
     * @param  int  $newCountInBaseUnits  Counted physical stock
     * @param  string  $reasonCode  e.g. DAMAGED_GOODS, EXPIRED, COUNT_VARIANCE, SHRINKAGE
     * @param  string|null  $notes  Supervisor override notes
     */
    public function execute(
        string $clientUuid,
        int $locationId,
        int $productId,
        int $newCountInBaseUnits,
        string $reasonCode,
        ?string $notes = null
    ): StockMovementResult {
        if ($newCountInBaseUnits < 0) {
            throw new InvalidArgumentException("Stock count cannot be negative: {$newCountInBaseUnits}");
        }

        // Idempotency check
        $existing = InventoryLedger::query()->where('client_uuid', $clientUuid)->first();
        if ($existing !== null) {
            $current = InventoryBalance::query()
                ->where('location_id', $locationId)
                ->where('product_id', $productId)
                ->value('current_qty') ?? 0;

            return new StockMovementResult(
                ledger: $existing,
                previousQty: $current,
                newQty: $current,
                isReplayed: true
            );
        }

        return DB::transaction(function () use (
            $clientUuid,
            $locationId,
            $productId,
            $newCountInBaseUnits,
            $reasonCode,
            $notes
        ) {
            $balance = InventoryBalance::query()->firstOrCreate(
                ['location_id' => $locationId, 'product_id' => $productId],
                ['current_qty' => 0]
            );

            /** @var InventoryBalance $lockedBalance */
            $lockedBalance = InventoryBalance::query()
                ->where('id', $balance->id)
                ->lockForUpdate()
                ->firstOrFail();

            $previousQty = $lockedBalance->current_qty;
            $qtyChange = $newCountInBaseUnits - $previousQty;

            $auditNote = "Reason: [{$reasonCode}]".($notes ? " - {$notes}" : '');

            $ledger = InventoryLedger::create([
                'client_uuid' => $clientUuid,
                'location_id' => $locationId,
                'product_id' => $productId,
                'qty_change' => $qtyChange,
                'transaction_type' => 'ADJUSTMENT',
                'notes' => $auditNote,
            ]);

            $lockedBalance->update(['current_qty' => $newCountInBaseUnits]);

            return new StockMovementResult(
                ledger: $ledger,
                previousQty: $previousQty,
                newQty: $newCountInBaseUnits,
                isReplayed: false
            );
        });
    }
}
