<?php

declare(strict_types=1);

use App\Actions\Inventory\AdjustStockAction;
use App\Actions\Inventory\RecordStockMovementAction;
use App\Actions\Inventory\TransferStockAction;
use App\Exceptions\InsufficientStockException;
use App\Models\InventoryBalance;
use App\Models\InventoryLedger;
use App\Models\Location;
use App\Models\Product;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->recordAction = new RecordStockMovementAction;
    $this->transferAction = new TransferStockAction;
    $this->adjustAction = new AdjustStockAction;

    $this->warehouse = Location::factory()->create(['type' => 'warehouse']);
    $this->truck = Location::factory()->create(['type' => 'truck']);
    $this->product = Product::factory()->create();
});

test('atomically records stock intake and updates balance cache', function () {
    $uuid = (string) Str::uuid();

    $result = $this->recordAction->execute(
        clientUuid: $uuid,
        locationId: $this->warehouse->id,
        productId: $this->product->id,
        qtyChange: 150,
        transactionType: 'STOCK_IN',
        notes: 'Inbound PO #1001'
    );

    expect($result->isReplayed)->toBeFalse()
        ->and($result->previousQty)->toBe(0)
        ->and($result->newQty)->toBe(150);

    // Verify ledger table
    $this->assertDatabaseHas('inventory_ledgers', [
        'client_uuid' => $uuid,
        'location_id' => $this->warehouse->id,
        'product_id' => $this->product->id,
        'qty_change' => 150,
        'transaction_type' => 'STOCK_IN',
    ]);

    // Verify balance cache table
    $this->assertDatabaseHas('inventory_balances', [
        'location_id' => $this->warehouse->id,
        'product_id' => $this->product->id,
        'current_qty' => 150,
    ]);
});

test('enforces strict idempotency via client_uuid on repeated calls', function () {
    $uuid = (string) Str::uuid();

    // First execution
    $first = $this->recordAction->execute(
        clientUuid: $uuid,
        locationId: $this->warehouse->id,
        productId: $this->product->id,
        qtyChange: 50,
        transactionType: 'STOCK_IN'
    );
    expect($first->isReplayed)->toBeFalse();

    // Duplicate submission with same client_uuid
    $second = $this->recordAction->execute(
        clientUuid: $uuid,
        locationId: $this->warehouse->id,
        productId: $this->product->id,
        qtyChange: 50,
        transactionType: 'STOCK_IN'
    );

    expect($second->isReplayed)->toBeTrue()
        ->and($second->newQty)->toBe(50); // Balance NOT incremented to 100!

    // Verify only ONE ledger row exists in database
    expect(InventoryLedger::where('client_uuid', $uuid)->count())->toBe(1);
});

test('strictly throws InsufficientStockException on overdraft when allowNegative is false', function () {
    // Current balance is 0, attempting to deduct 10 pieces
    $uuid = (string) Str::uuid();

    $this->recordAction->execute(
        clientUuid: $uuid,
        locationId: $this->warehouse->id,
        productId: $this->product->id,
        qtyChange: -10,
        transactionType: 'SALE',
        allowNegative: false
    );
})->throws(InsufficientStockException::class);

test('transfers stock atomically between warehouse and truck with dual ledger entries', function () {
    // Initial warehouse stock: 100
    $this->recordAction->execute(
        clientUuid: (string) Str::uuid(),
        locationId: $this->warehouse->id,
        productId: $this->product->id,
        qtyChange: 100,
        transactionType: 'STOCK_IN'
    );

    $transferUuid = (string) Str::uuid();

    $result = $this->transferAction->execute(
        clientUuid: $transferUuid,
        sourceLocationId: $this->warehouse->id,
        destinationLocationId: $this->truck->id,
        productId: $this->product->id,
        quantity: 40,
        notes: 'Morning route loading'
    );

    expect($result['isReplayed'])->toBeFalse();

    // Verify warehouse balance: 100 - 40 = 60
    expect(InventoryBalance::where('location_id', $this->warehouse->id)->where('product_id', $this->product->id)->value('current_qty'))->toBe(60);

    // Verify truck balance: 0 + 40 = 40
    expect(InventoryBalance::where('location_id', $this->truck->id)->where('product_id', $this->product->id)->value('current_qty'))->toBe(40);

    // Verify dual balancing ledger rows
    $this->assertDatabaseHas('inventory_ledgers', [
        'client_uuid' => "{$transferUuid}-OUT",
        'location_id' => $this->warehouse->id,
        'qty_change' => -40,
        'transaction_type' => 'TRANSFER_OUT',
    ]);

    $this->assertDatabaseHas('inventory_ledgers', [
        'client_uuid' => "{$transferUuid}-IN",
        'location_id' => $this->truck->id,
        'qty_change' => 40,
        'transaction_type' => 'TRANSFER_IN',
    ]);
});

test('adjusts stock balance and records reason code delta', function () {
    // Start with 50 units
    $this->recordAction->execute(
        clientUuid: (string) Str::uuid(),
        locationId: $this->warehouse->id,
        productId: $this->product->id,
        qtyChange: 50,
        transactionType: 'STOCK_IN'
    );

    // Physical count found 42 units (8 units lost/damaged)
    $adjustUuid = (string) Str::uuid();
    $result = $this->adjustAction->execute(
        clientUuid: $adjustUuid,
        locationId: $this->warehouse->id,
        productId: $this->product->id,
        newCountInBaseUnits: 42,
        reasonCode: 'DAMAGED_GOODS',
        notes: 'Water leak damaged 8 items'
    );

    expect($result->isReplayed)->toBeFalse()
        ->and($result->previousQty)->toBe(50)
        ->and($result->newQty)->toBe(42)
        ->and($result->ledger->qty_change)->toBe(-8);

    expect(InventoryBalance::where('location_id', $this->warehouse->id)->where('product_id', $this->product->id)->value('current_qty'))->toBe(42);
});
