<?php

declare(strict_types=1);

namespace App\DTOs;

use App\Models\InventoryLedger;

final class StockMovementResult
{
    public function __construct(
        public readonly InventoryLedger $ledger,
        public readonly int $previousQty,
        public readonly int $newQty,
        public readonly bool $isReplayed = false
    ) {}
}
