<?php

declare(strict_types=1);

use App\Actions\Inventory\RecordStockMovementAction;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);

    $this->warehouse = Location::factory()->create(['code' => 'WH-TEST', 'type' => 'warehouse']);
    $this->truck = Location::factory()->create(['code' => 'TRK-TEST', 'type' => 'truck']);
    $this->product = Product::factory()->create(['sku' => 'SKU-INV-01']);

    app(RecordStockMovementAction::class)->execute(
        clientUuid: (string) Str::uuid(),
        locationId: $this->warehouse->id,
        productId: $this->product->id,
        qtyChange: 200,
        transactionType: 'STOCK_IN'
    );
});

test('renders inventory balances dashboard with active stock cache', function () {
    $response = $this->get('/inventory');

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('inventory/index')
            ->has('balances.data', 1)
            ->where('balances.data.0.current_qty', 200)
            ->has('locations')
            ->has('products')
        );
});

test('renders ledger audit log with immutable movement history', function () {
    $response = $this->get('/inventory/ledger');

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('inventory/ledger')
            ->has('ledgers.data', 1)
            ->where('ledgers.data.0.transaction_type', 'STOCK_IN')
            ->where('ledgers.data.0.qty_change', 200)
        );
});

test('executes stock transfer via web endpoint and updates balances', function () {
    $payload = [
        'client_uuid' => (string) Str::uuid(),
        'source_location_id' => $this->warehouse->id,
        'destination_location_id' => $this->truck->id,
        'product_id' => $this->product->id,
        'quantity' => 50,
        'batch_number' => 'BATCH-TEST-01',
        'notes' => 'Route truck dispatch',
    ];

    $response = $this->post('/inventory/transfer', $payload);

    $response->assertRedirect();

    expect(InventoryBalance::where('location_id', $this->warehouse->id)->where('product_id', $this->product->id)->value('current_qty'))->toBe(150);
    expect(InventoryBalance::where('location_id', $this->truck->id)->where('product_id', $this->product->id)->value('current_qty'))->toBe(50);
});

test('executes stock adjustment via web endpoint and logs reason', function () {
    $payload = [
        'client_uuid' => (string) Str::uuid(),
        'location_id' => $this->warehouse->id,
        'product_id' => $this->product->id,
        'new_count' => 180,
        'reason_code' => 'DAMAGED_GOODS',
        'notes' => '20 units damaged during forklift transit',
    ];

    $response = $this->post('/inventory/adjust', $payload);

    $response->assertRedirect();

    expect(InventoryBalance::where('location_id', $this->warehouse->id)->where('product_id', $this->product->id)->value('current_qty'))->toBe(180);
});
