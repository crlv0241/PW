<?php

declare(strict_types=1);

use App\Models\Location;
use App\Models\Product;
use App\Models\ProductUom;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\Supplier;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

test('renders products index page with paginated master catalog', function () {
    $product = Product::factory()->create([
        'sku' => 'TEST-SKU-001',
        'name' => 'Premium Cola 330ml',
        'category' => 'Beverages',
    ]);

    ProductUom::factory()->create([
        'product_id' => $product->id,
        'name' => 'Piece',
        'conversion_factor' => 1,
        'is_base_unit' => true,
    ]);

    $response = $this->get('/products');

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('products/index')
            ->has('products.data')
            ->has('categories')
            ->where('filters.search', '')
        );
});

test('filters products by search term', function () {
    Product::factory()->create([
        'sku' => 'SEARCHABLE-COLA',
        'name' => 'Special Sparkling Cola',
    ]);

    Product::factory()->create([
        'sku' => 'OTHER-CHIPS',
        'name' => 'Potato Crisps',
    ]);

    $response = $this->get('/products?search=SEARCHABLE');

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('products/index')
            ->where('filters.search', 'SEARCHABLE')
            ->has('products.data', 1)
            ->where('products.data.0.sku', 'SEARCHABLE-COLA')
        );
});

test('creates a new product with legacy base UOM payload via store action', function () {
    $payload = [
        'sku' => 'NEW-SKU-999',
        'name' => 'Artisanal Bread 500g',
        'category' => 'Bakery',
        'tax_category' => 'STANDARD',
        'tax_rate' => 0.1200,
        'description' => 'Fresh whole wheat loaf.',
        'base_uom_name' => 'Loaf',
        'base_uom_barcode' => '4809999999999',
        'base_uom_price_cents' => 8500,
    ];

    $response = $this->post('/products', $payload);

    $response->assertRedirect('/products');

    $this->assertDatabaseHas('products', [
        'sku' => 'NEW-SKU-999',
        'name' => 'Artisanal Bread 500g',
        'category' => 'Bakery',
    ]);

    $this->assertDatabaseHas('product_uoms', [
        'name' => 'Loaf',
        'conversion_factor' => 1,
        'barcode' => '4809999999999',
        'is_base_unit' => true,
        'price_cents' => 8500,
    ]);
});

test('creates a product with multi-tier packaging UOMs', function () {
    $payload = [
        'sku' => 'MULTI-UOM-001',
        'name' => 'Orange Juice 1L',
        'category' => 'Beverages',
        'tax_category' => 'STANDARD',
        'tax_rate' => 0.1200,
        'description' => 'Pure orange juice carton.',
        'status' => 'ACTIVE',
        'uoms' => [
            [
                'name' => 'Bottle',
                'conversion_factor' => 1,
                'barcode' => 'BAR-BOTTLE-001',
                'is_base_unit' => true,
                'price_cents' => 4500,
            ],
            [
                'name' => 'Pack',
                'conversion_factor' => 6,
                'barcode' => 'BAR-PACK-006',
                'is_base_unit' => false,
                'price_cents' => 26000,
            ],
            [
                'name' => 'Case',
                'conversion_factor' => 24,
                'barcode' => 'BAR-CASE-024',
                'is_base_unit' => false,
                'price_cents' => 100000,
            ],
        ],
    ];

    $response = $this->post('/products', $payload);
    $response->assertRedirect('/products');

    $product = Product::where('sku', 'MULTI-UOM-001')->firstOrFail();
    expect($product->uoms)->toHaveCount(3);

    $this->assertDatabaseHas('product_uoms', [
        'product_id' => $product->id,
        'name' => 'Bottle',
        'conversion_factor' => 1,
        'is_base_unit' => true,
        'price_cents' => 4500,
    ]);

    $this->assertDatabaseHas('product_uoms', [
        'product_id' => $product->id,
        'name' => 'Case',
        'conversion_factor' => 24,
        'is_base_unit' => false,
        'price_cents' => 100000,
    ]);
});

test('updates product metadata and synchronizes UOM tiers', function () {
    $product = Product::factory()->create([
        'sku' => 'ORIGINAL-SKU',
        'name' => 'Original Name',
        'category' => 'Snacks',
    ]);

    $baseUom = ProductUom::factory()->create([
        'product_id' => $product->id,
        'name' => 'Piece',
        'conversion_factor' => 1,
        'is_base_unit' => true,
        'price_cents' => 2000,
        'barcode' => 'BAR-PC-1',
    ]);

    $oldTier = ProductUom::factory()->create([
        'product_id' => $product->id,
        'name' => 'OldBox',
        'conversion_factor' => 10,
        'is_base_unit' => false,
        'price_cents' => 19000,
        'barcode' => 'BAR-BOX-10',
    ]);

    $updatePayload = [
        'sku' => 'UPDATED-SKU',
        'name' => 'Updated Product Name',
        'category' => 'Premium Snacks',
        'status' => 'ACTIVE',
        'tax_category' => 'ZERO_RATED',
        'tax_rate' => 0.0000,
        'description' => 'Updated description.',
        'uoms' => [
            // Updated existing base unit
            [
                'id' => $baseUom->id,
                'name' => 'Piece',
                'conversion_factor' => 1,
                'barcode' => 'BAR-PC-1-EDITED',
                'is_base_unit' => true,
                'price_cents' => 2500,
            ],
            // New tier added (Pack of 5)
            [
                'name' => 'Pack',
                'conversion_factor' => 5,
                'barcode' => 'BAR-PACK-5',
                'is_base_unit' => false,
                'price_cents' => 12000,
            ],
            // Note: OldBox is omitted, should be deleted
        ],
    ];

    $response = $this->put("/products/{$product->id}", $updatePayload);
    $response->assertRedirect('/products');

    $product->refresh();
    expect($product->sku)->toBe('UPDATED-SKU')
        ->and($product->name)->toBe('Updated Product Name')
        ->and($product->category)->toBe('Premium Snacks')
        ->and($product->tax_category)->toBe('ZERO_RATED');

    // Base unit updated
    $this->assertDatabaseHas('product_uoms', [
        'id' => $baseUom->id,
        'barcode' => 'BAR-PC-1-EDITED',
        'price_cents' => 2500,
    ]);

    // New tier created
    $this->assertDatabaseHas('product_uoms', [
        'product_id' => $product->id,
        'name' => 'Pack',
        'conversion_factor' => 5,
        'price_cents' => 12000,
    ]);

    // Omitted unreferenced old tier deleted
    $this->assertDatabaseMissing('product_uoms', [
        'id' => $oldTier->id,
    ]);
});

test('prevents deleting a packaging tier that is referenced in purchase orders', function () {
    $supplier = Supplier::factory()->create();
    $location = Location::factory()->create();

    $product = Product::factory()->create(['sku' => 'PO-REF-PROD']);
    $baseUom = ProductUom::factory()->create([
        'product_id' => $product->id,
        'name' => 'Piece',
        'conversion_factor' => 1,
        'is_base_unit' => true,
    ]);
    $boxUom = ProductUom::factory()->create([
        'product_id' => $product->id,
        'name' => 'Box',
        'conversion_factor' => 12,
        'is_base_unit' => false,
    ]);

    // Create a PO referencing the box UOM
    $po = PurchaseOrder::create([
        'po_number' => 'PO-TEST-001',
        'supplier_id' => $supplier->id,
        'destination_location_id' => $location->id,
        'status' => 'DRAFT',
        'order_date' => now()->toDateString(),
        'subtotal_cents' => 12000,
        'discount_cents' => 0,
        'tax_cents' => 0,
        'total_cents' => 12000,
        'created_by' => $this->user->id,
    ]);

    PurchaseOrderLine::create([
        'purchase_order_id' => $po->id,
        'product_id' => $product->id,
        'product_uom_id' => $boxUom->id,
        'ordered_qty' => 10,
        'conversion_factor' => 12,
        'ordered_base_qty' => 120,
        'received_base_qty' => 0,
        'unit_cost_cents' => 1200,
        'discount_percent' => '0',
        'discount_amount_cents' => 0,
        'net_unit_cost_cents' => 1200,
        'net_base_cost_cents' => 100,
        'line_total_cents' => 12000,
    ]);

    // Attempt to update product without the Box UOM (trying to delete it)
    $updatePayload = [
        'sku' => $product->sku,
        'name' => $product->name,
        'category' => $product->category,
        'status' => 'ACTIVE',
        'tax_category' => 'STANDARD',
        'tax_rate' => 0.12,
        'uoms' => [
            [
                'id' => $baseUom->id,
                'name' => 'Piece',
                'conversion_factor' => 1,
                'is_base_unit' => true,
            ],
        ],
    ];

    $response = $this->put("/products/{$product->id}", $updatePayload);
    $response->assertSessionHasErrors('uoms');

    // Box UOM must still exist
    $this->assertDatabaseHas('product_uoms', [
        'id' => $boxUom->id,
        'name' => 'Box',
    ]);
});

test('rejects duplicate UOM names on the same product', function () {
    $payload = [
        'sku' => 'DUP-UOM-001',
        'name' => 'Duplicate UOM Test',
        'category' => 'Beverages',
        'tax_category' => 'STANDARD',
        'tax_rate' => 0.1200,
        'uoms' => [
            [
                'name' => 'Piece',
                'conversion_factor' => 1,
                'is_base_unit' => true,
            ],
            [
                'name' => 'Box',
                'conversion_factor' => 6,
                'is_base_unit' => false,
            ],
            [
                'name' => 'box', // Case-insensitive duplicate
                'conversion_factor' => 12,
                'is_base_unit' => false,
            ],
        ],
    ];

    $response = $this->post('/products', $payload);
    $response->assertSessionHasErrors('uoms.2.name');
});

test('toggles product status between active and inactive', function () {
    $product = Product::factory()->create([
        'status' => 'ACTIVE',
    ]);

    $response = $this->patch("/products/{$product->id}/toggle-status");
    $response->assertRedirect('/products');

    expect($product->fresh()->status)->toBe('INACTIVE');

    $this->patch("/products/{$product->id}/toggle-status");
    expect($product->fresh()->status)->toBe('ACTIVE');
});
