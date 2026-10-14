<?php

declare(strict_types=1);

use App\Models\ProductUom;
use App\Services\UomConversionService;

beforeEach(function () {
    $this->service = new UomConversionService;
});

test('converts packaged tiers to whole integer base units', function () {
    $uom = new ProductUom([
        'conversion_factor' => 24, // 1 Case = 24 Pieces
    ]);

    expect($this->service->toBaseUnits(5, $uom))->toBe(120);
});

test('converts base units to packaging tier with remainder pieces', function () {
    $caseUom = new ProductUom([
        'conversion_factor' => 12, // 1 Dozen/Pack = 12 Pieces
    ]);

    // 25 pieces = 2 packs + 1 loose piece
    $result = $this->service->fromBaseUnits(25, $caseUom);

    expect($result)->toBe([
        'packaged' => 2,
        'remainderBaseUnits' => 1,
    ]);
});

test('converts between different packaging tiers of same product', function () {
    $pallet = new ProductUom([
        'product_id' => 1,
        'conversion_factor' => 240, // 240 pieces per pallet
    ]);

    $case = new ProductUom([
        'product_id' => 1,
        'conversion_factor' => 24, // 24 pieces per case
    ]);

    // 3 Pallets = 720 pieces -> 720 / 24 = 30 Cases, 0 loose pieces
    $result = $this->service->convertBetweenUoms(3, $pallet, $case);

    expect($result)->toBe([
        'packaged' => 30,
        'remainderBaseUnits' => 0,
    ]);
});

test('throws on negative quantity conversion', function () {
    $uom = new ProductUom(['conversion_factor' => 1]);
    $this->service->toBaseUnits(-5, $uom);
})->throws(InvalidArgumentException::class);
