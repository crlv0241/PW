<?php

declare(strict_types=1);

namespace App\Actions\Inventory;

use App\Exceptions\InsufficientStockException;
use App\Models\InventoryBalance;
use App\Models\InventoryLedger;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class TransferStockAction
{
    /**
     * Executes an atomic transfer of stock between two locations with deadlock-free ascending row locking.
     *
     * @param  string  $clientUuid  Base client transaction UUID
     * @param  int  $sourceLocationId  Source location ID
     * @param  int  $destinationLocationId  Target destination location ID
     * @param  int  $productId  Product ID transferring in base units
     * @param  int  $quantity  Quantity in whole integer base units (must be > 0)
     * @param  string|null  $batchNumber  Batch / lot identifier
     * @param  string|null  $notes  Contextual notes
     * @return array{sourceLedger: InventoryLedger, destinationLedger: InventoryLedger, isReplayed: bool}
     */
    public function execute(
        string $clientUuid,
        int $sourceLocationId,
        int $destinationLocationId,
        int $productId,
        int $quantity,
        ?string $batchNumber = null,
        ?string $notes = null
    ): array {
        if ($quantity <= 0) {
            throw new InvalidArgumentException("Transfer quantity must be greater than zero, got: {$quantity}");
        }

        if ($sourceLocationId === $destinationLocationId) {
            throw new InvalidArgumentException("Source and destination location cannot be identical: #{$sourceLocationId}");
        }

        $outUuid = "{$clientUuid}-OUT";
        $inUuid = "{$clientUuid}-IN";

        // Idempotency: return existing transfer records if already processed
        $existingOut = InventoryLedger::query()->where('client_uuid', $outUuid)->first();
        $existingIn = InventoryLedger::query()->where('client_uuid', $inUuid)->first();

        if ($existingOut !== null && $existingIn !== null) {
            return [
                'sourceLedger' => $existingOut,
                'destinationLedger' => $existingIn,
                'isReplayed' => true,
            ];
        }

        return DB::transaction(function () use (
            $sourceLocationId,
            $destinationLocationId,
            $productId,
            $quantity,
            $outUuid,
            $inUuid,
            $batchNumber,
            $notes
        ) {
            // Deadlock Prevention: Always acquire locks in ascending order of location_id
            $locationIds = [$sourceLocationId, $destinationLocationId];
            sort($locationIds, SORT_NUMERIC);

            $lockedBalances = [];
            foreach ($locationIds as $locId) {
                $bal = InventoryBalance::query()->firstOrCreate(
                    ['location_id' => $locId, 'product_id' => $productId],
                    ['current_qty' => 0]
                );

                /** @var InventoryBalance $locked */
                $locked = InventoryBalance::query()
                    ->where('id', $bal->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $lockedBalances[$locId] = $locked;
            }

            $sourceBalance = $lockedBalances[$sourceLocationId];
            $destBalance = $lockedBalances[$destinationLocationId];

            if ($sourceBalance->current_qty < $quantity) {
                throw new InsufficientStockException(
                    productId: $productId,
                    locationId: $sourceLocationId,
                    requestedQty: $quantity,
                    availableQty: $sourceBalance->current_qty
                );
            }

            // 1. Deduct source
            $newSourceQty = $sourceBalance->current_qty - $quantity;
            $sourceBalance->update(['current_qty' => $newSourceQty]);

            $sourceLedger = InventoryLedger::create([
                'client_uuid' => $outUuid,
                'location_id' => $sourceLocationId,
                'product_id' => $productId,
                'qty_change' => -$quantity,
                'transaction_type' => 'TRANSFER_OUT',
                'batch_number' => $batchNumber,
                'notes' => $notes ? "Transfer to Location #{$destinationLocationId}: {$notes}" : "Transfer to Location #{$destinationLocationId}",
            ]);

            // 2. Increment destination
            $newDestQty = $destBalance->current_qty + $quantity;
            $destBalance->update(['current_qty' => $newDestQty]);

            $destLedger = InventoryLedger::create([
                'client_uuid' => $inUuid,
                'location_id' => $destinationLocationId,
                'product_id' => $productId,
                'qty_change' => $quantity,
                'transaction_type' => 'TRANSFER_IN',
                'batch_number' => $batchNumber,
                'notes' => $notes ? "Transfer from Location #{$sourceLocationId}: {$notes}" : "Transfer from Location #{$sourceLocationId}",
            ]);

            return [
                'sourceLedger' => $sourceLedger,
                'destinationLedger' => $destLedger,
                'isReplayed' => false,
            ];
        });
    }
}
