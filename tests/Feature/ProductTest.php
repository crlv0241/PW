<?php

declare(strict_types=1);

use App\Models\Product;
use App\Models\ProductUom;
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

test('creates a new product with its base UOM via store action', function () {
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
