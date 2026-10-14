<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ProductUom;
use InvalidArgumentException;

final class UomConversionService
{
    /**
     * Converts a packaged quantity into whole integer base units (pieces/eaches).
     *
     * @param  int  $quantity  The quantity in the specified packaging UOM
     * @param  ProductUom  $uom  The packaging unit of measure
     * @return int Whole integer base units
     */
    public function toBaseUnits(int $quantity, ProductUom $uom): int
    {
        if ($quantity < 0) {
            throw new InvalidArgumentException("Quantity cannot be negative: {$quantity}");
        }

        if ($uom->conversion_factor < 1) {
            throw new InvalidArgumentException("UOM conversion factor must be at least 1: {$uom->conversion_factor}");
        }

        return $quantity * $uom->conversion_factor;
    }

    /**
     * Converts whole integer base units into a target packaging tier,
     * returning the full packaged quantity and any remaining loose base units.
     *
     * @param  int  $baseUnits  Total base units to package
     * @param  ProductUom  $targetUom  The destination packaging tier
     * @return array{packaged: int, remainderBaseUnits: int}
     */
    public function fromBaseUnits(int $baseUnits, ProductUom $targetUom): array
    {
        if ($baseUnits < 0) {
            throw new InvalidArgumentException("Base units cannot be negative: {$baseUnits}");
        }

        if ($targetUom->conversion_factor < 1) {
            throw new InvalidArgumentException("UOM conversion factor must be at least 1: {$targetUom->conversion_factor}");
        }

        $packaged = intdiv($baseUnits, $targetUom->conversion_factor);
        $remainder = $baseUnits % $targetUom->conversion_factor;

        return [
            'packaged' => $packaged,
            'remainderBaseUnits' => $remainder,
        ];
    }

    /**
     * Converts a quantity between two packaging tiers of the same product.
     *
     * @return array{packaged: int, remainderBaseUnits: int}
     */
    public function convertBetweenUoms(int $quantity, ProductUom $sourceUom, ProductUom $targetUom): array
    {
        if ($sourceUom->product_id !== $targetUom->product_id) {
            throw new InvalidArgumentException(
                "Cannot convert UOM between different products: #{$sourceUom->product_id} vs #{$targetUom->product_id}"
            );
        }

        $baseUnits = $this->toBaseUnits($quantity, $sourceUom);

        return $this->fromBaseUnits($baseUnits, $targetUom);
    }
}
