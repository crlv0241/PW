<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

final class InsufficientStockException extends RuntimeException
{
    public function __construct(
        public readonly int $productId,
        public readonly int $locationId,
        public readonly int $requestedQty,
        public readonly int $availableQty,
        string $message = ''
    ) {
        $msg = $message !== ''
            ? $message
            : "Insufficient stock for Product #{$productId} at Location #{$locationId}. Requested: {$requestedQty}, Available: {$availableQty}.";

        parent::__construct($msg);
    }
}
