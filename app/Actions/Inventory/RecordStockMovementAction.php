<?php

declare(strict_types=1);

namespace App\Actions\Inventory;

use App\DTOs\StockMovementResult;
use App\Exceptions\InsufficientStockException;
use App\Models\InventoryBalance;
use App\Models\InventoryLedger;
use Illuminate\Support\Facades\DB;

final class RecordStockMovementAction
{
    /**
     * Atomically records an inventory movement (write-ahead ledger + active balance cache).
     * Strictly idempotent via client_uuid.
     *
     * @param  string  $clientUuid  Unique client transaction UUID for deduplication
     * @param  int  $locationId  Location ID where stock is moving
     * @param  int  $productId  Product ID moving in base units
     * @param  int  $qtyChange  Signed integer base units (+ for intake, - for deduction)
     * @param  string  $transactionType  STOCK_IN, TRANSFER_OUT, TRANSFER_IN, SALE, ADJUSTMENT, RETURN
     * @param  int|null  $referenceId  Optional parent reference ID (PO, Sale, Transfer, Count)
     * @param  string|null  $batchNumber  Batch or lot identifier for FIFO tracking
     * @param  string|null  $expiryDate  Expiration date (Y-m-d)
     * @param  string|null  $notes  Audit trail context or reason
     * @param  bool  $allowNegative  Whether balance is permitted to go below zero (default false)
     */
    public function execute(
        string $clientUuid,
        int $locationId,
        int $productId,
        int $qtyChange,
        string $transactionType,
        ?int $referenceId = null,
        ?string $batchNumber = null,
        ?string $expiryDate = null,
        ?string $notes = null,
        bool $allowNegative = false
    ): StockMovementResult {
        // 1. Idempotency Check: return original ledger row if already committed
        $existing = InventoryLedger::query()->where('client_uuid', $clientUuid)->first();
        if ($existing !== null) {
            $currentBalance = InventoryBalance::query()
                ->where('location_id', $locationId)
                ->where('product_id', $productId)
                ->value('current_qty') ?? 0;

            return new StockMovementResult(
                ledger: $existing,
                previousQty: $currentBalance,
                newQty: $currentBalance,
                isReplayed: true
            );
        }

        // 2. Atomic Dual-Write inside strict DB Transaction
        return DB::transaction(function () use (
            $clientUuid,
            $locationId,
            $productId,
            $qtyChange,
            $transactionType,
            $referenceId,
            $batchNumber,
            $expiryDate,
            $notes,
            $allowNegative
        ) {
            // Ensure balance cache row exists, then acquire exclusive row lock
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
            $newQty = $previousQty + $qtyChange;

            // Enforce negative stock prevention unless explicitly overridden
            if (! $allowNegative && $newQty < 0) {
                throw new InsufficientStockException(
                    productId: $productId,
                    locationId: $locationId,
                    requestedQty: abs($qtyChange),
                    availableQty: $previousQty
                );
            }

            // Append immutable write-ahead ledger row
            $ledger = InventoryLedger::create([
                'client_uuid' => $clientUuid,
                'location_id' => $locationId,
                'product_id' => $productId,
                'qty_change' => $qtyChange,
                'transaction_type' => $transactionType,
                'reference_id' => $referenceId,
                'batch_number' => $batchNumber,
                'expiry_date' => $expiryDate,
                'notes' => $notes,
            ]);

            // Synchronously update indexed balance cache
            $lockedBalance->update(['current_qty' => $newQty]);

            return new StockMovementResult(
                ledger: $ledger,
                previousQty: $previousQty,
                newQty: $newQty,
                isReplayed: false
            );
        });
    }
}
