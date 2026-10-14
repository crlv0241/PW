<?php

declare(strict_types=1);

use App\Models\GoodsReceipt;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductUom;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);

    $this->warehouse = Location::factory()->create([
        'code' => 'WH-MAIN-TEST',
        'type' => 'warehouse',
        'is_active' => true,
    ]);

    $this->damageBay = Location::factory()->create([
        'code' => 'DMG-BAY-TEST',
        'type' => 'damage',
        'is_active' => true,
    ]);

    $this->supplier = Supplier::query()->firstOrCreate(
        ['supplier_code' => 'SUPP-TEST-01'],
        [
            'name' => 'Apex Test Supplier Corp',
            'contact_name' => 'John Doe',
            'email' => 'supplier@test.com',
            'payment_terms_days' => 30,
            'is_active' => true,
        ]
    );

    $this->product = Product::factory()->create(['sku' => 'SKU-PO-TEST-01', 'name' => 'Test Premium Juice']);

    // Create Base UOM (Piece, x1) and Carton UOM (Case, x12)
    $this->baseUom = ProductUom::create([
        'product_id' => $this->product->id,
        'name' => 'Piece',
        'conversion_factor' => 1,
        'barcode' => '8801234567890',
        'is_base_unit' => true,
        'price_cents' => 2500, // ₱25.00
    ]);

    $this->caseUom = ProductUom::create([
        'product_id' => $this->product->id,
        'name' => 'Case 12s',
        'conversion_factor' => 12,
        'barcode' => '8801234567899',
        'is_base_unit' => false,
        'price_cents' => 28000, // ₱280.00
    ]);
});

test('renders purchase orders index page with Inertia', function () {
    $response = $this->get('/procurement/orders');

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('procurement/orders/index')
            ->has('orders')
            ->has('suppliers')
            ->has('locations')
            ->has('products')
        );
});

test('creates purchase order with multi-uom conversion and integer penny amounts', function () {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'order_date' => '2026-10-14',
        'expected_delivery_date' => '2026-10-18',
        'notes' => 'Contractual weekly replenishment',
        'lines' => [
            [
                'product_id' => $this->product->id,
                'product_uom_id' => $this->caseUom->id,
                'ordered_qty' => 10, // 10 cases = 120 base units
                'unit_cost_cents' => 24000, // ₱240.00 gross per case
                'discount_percent' => 0.05, // 5% trade discount
            ],
        ],
    ];

    $response = $this->post('/procurement/orders', $payload);

    $response->assertRedirect();

    $po = PurchaseOrder::query()->where('supplier_id', $this->supplier->id)->latest('id')->first();
    expect($po)->not->toBeNull();
    expect($po->status)->toBe('APPROVED');
    expect($po->lines)->toHaveCount(1);

    $line = $po->lines->first();
    expect($line->ordered_qty)->toBe(10);
    expect($line->ordered_base_qty)->toBe(120);
    expect($line->unit_cost_cents)->toBe(24000);
    expect($line->discount_amount_cents)->toBe(1200); // 5% of 24000 = 1200 cents
    expect($line->net_unit_cost_cents)->toBe(22800);
    expect($line->net_base_cost_cents)->toBe(1900); // 22800 / 12 = 1900 cents per base unit
    expect($line->line_total_cents)->toBe(228000); // 22800 * 10 = 228,000 cents (₱2,280.00)
});

test('creates purchase order with stacked cascading trade discounts e.g. 10+5+2%', function () {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'order_date' => '2026-10-14',
        'lines' => [
            [
                'product_id' => $this->product->id,
                'product_uom_id' => $this->baseUom->id,
                'ordered_qty' => 10,
                'unit_cost_cents' => 10000, // ₱100.00
                'discount_type' => 'STACKED_PERCENT',
                'discount_formula' => '10+5+2', // 10% + 5% + 2% cascading
            ],
        ],
    ];

    $response = $this->post('/procurement/orders', $payload);
    $response->assertRedirect();

    $po = PurchaseOrder::query()->where('supplier_id', $this->supplier->id)->latest('id')->first();
    expect($po)->not->toBeNull();
    $line = $po->lines->first();

    // 10000 -> 9000 -> 8550 -> 8379 cents
    expect($line->unit_cost_cents)->toBe(10000);
    expect($line->discount_type)->toBe('STACKED_PERCENT');
    expect($line->discount_formula)->toBe('10+5+2');
    expect($line->discount_amount_cents)->toBe(1621);
    expect($line->net_unit_cost_cents)->toBe(8379);
    expect($line->line_total_cents)->toBe(83790); // 8379 * 10
});

test('creates purchase order with fixed amount discount e.g. ₱20.00 off per packaging unit', function () {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'order_date' => '2026-10-14',
        'lines' => [
            [
                'product_id' => $this->product->id,
                'product_uom_id' => $this->caseUom->id,
                'ordered_qty' => 5,
                'unit_cost_cents' => 24000, // ₱240.00
                'discount_type' => 'FIXED_AMOUNT',
                'discount_formula' => '20.00',
                'discount_amount_cents' => 2000, // ₱20.00 off per case
            ],
        ],
    ];

    $response = $this->post('/procurement/orders', $payload);
    $response->assertRedirect();

    $po = PurchaseOrder::query()->where('supplier_id', $this->supplier->id)->latest('id')->first();
    expect($po)->not->toBeNull();
    $line = $po->lines->first();

    expect($line->unit_cost_cents)->toBe(24000);
    expect($line->discount_type)->toBe('FIXED_AMOUNT');
    expect($line->discount_amount_cents)->toBe(2000);
    expect($line->net_unit_cost_cents)->toBe(22000); // 24000 - 2000
    expect($line->line_total_cents)->toBe(110000); // 22000 * 5
});

test('creates purchase order with compound discount combining stacked percentages and exact allowance', function () {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'order_date' => '2026-10-14',
        'lines' => [
            [
                'product_id' => $this->product->id,
                'product_uom_id' => $this->baseUom->id,
                'ordered_qty' => 10,
                'unit_cost_cents' => 100000, // ₱1,000.00
                'discount_type' => 'COMPOUND',
                'discount_formula' => '10+5|50', // 10% + 5% stacked, less ₱50.00 promo allowance
            ],
        ],
    ];

    $response = $this->post('/procurement/orders', $payload);
    $response->assertRedirect();

    $po = PurchaseOrder::query()->where('supplier_id', $this->supplier->id)->latest('id')->first();
    expect($po)->not->toBeNull();
    $line = $po->lines->first();

    // 100000 -> 90000 (after 10%) -> 85500 (after 5%) -> 80500 (after less 5000 cents)
    expect($line->unit_cost_cents)->toBe(100000);
    expect($line->discount_type)->toBe('COMPOUND');
    expect($line->discount_formula)->toBe('10+5|50');
    expect($line->discount_amount_cents)->toBe(19500); // ₱195.00 discount per unit
    expect($line->net_unit_cost_cents)->toBe(80500); // ₱805.00 net cost per unit
    expect($line->line_total_cents)->toBe(805000); // 80500 * 10 = ₱8,050.00
    expect((float) $line->discount_percent)->toBe(0.1950);
});

test('renders goods receiving blind scan intake page with Inertia', function () {
    $response = $this->get('/procurement/receiving');

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('procurement/receiving/index')
            ->has('receipts')
            ->has('openPurchaseOrders')
            ->has('locations')
            ->has('suppliers')
        );
});

test('executes blind intake and dual writes accepted stock to warehouse and damaged stock to damage bay', function () {
    // 1. Create approved Purchase Order
    $po = PurchaseOrder::create([
        'po_number' => 'PO-TEST-0099',
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'status' => 'APPROVED',
        'order_date' => '2026-10-14',
        'subtotal_cents' => 240000,
        'discount_cents' => 12000,
        'tax_cents' => 27360,
        'total_cents' => 228000,
    ]);

    $poLine = $po->lines()->create([
        'product_id' => $this->product->id,
        'product_uom_id' => $this->caseUom->id,
        'ordered_qty' => 10,
        'conversion_factor' => 12,
        'ordered_base_qty' => 120,
        'received_base_qty' => 0,
        'unit_cost_cents' => 24000,
        'discount_percent' => '0.0500',
        'discount_amount_cents' => 1200,
        'net_unit_cost_cents' => 22800,
        'net_base_cost_cents' => 1900,
        'line_total_cents' => 228000,
    ]);

    // 2. Physical Receiving: 10 cases received, but 2 cases are crushed/damaged!
    // Accepted: 8 cases (96 pcs) -> WH-MAIN-TEST
    // Rejected: 2 cases (24 pcs) -> DMG-BAY-TEST
    $payload = [
        'purchase_order_id' => $po->id,
        'supplier_id' => $this->supplier->id,
        'location_id' => $this->warehouse->id,
        'supplier_invoice_number' => 'INV-SUPP-9871',
        'supplier_invoice_amount_cents' => 228000,
        'lines' => [
            [
                'purchase_order_line_id' => $poLine->id,
                'product_id' => $this->product->id,
                'product_uom_id' => $this->caseUom->id,
                'scanned_qty' => 10,
                'rejected_qty' => 2,
                'batch_number' => 'LOT-2026-A1',
                'expiry_date' => '2027-10-14',
                'remarks' => '2 crushed cartons inspected at dock',
            ],
        ],
    ];

    $response = $this->post('/procurement/receiving', $payload);

    $response->assertRedirect();

    // Check Destination Warehouse Balance (accepted: 96 pcs)
    $whBalance = InventoryBalance::query()
        ->where('location_id', $this->warehouse->id)
        ->where('product_id', $this->product->id)
        ->value('current_qty');

    expect($whBalance)->toBe(96);

    // Check Damage Quarantine Balance (damaged: 24 pcs)
    $dmgBalance = InventoryBalance::query()
        ->where('location_id', $this->damageBay->id)
        ->where('product_id', $this->product->id)
        ->value('current_qty');

    expect($dmgBalance)->toBe(24);

    // Check PO status is COMPLETED because 120 base units total were physically received & accounted for
    $po->refresh();
    expect($po->status)->toBe('COMPLETED');
    expect($poLine->fresh()->received_base_qty)->toBe(120);
});

test('reconciles 3-way match as PERFECT_MATCH when physical count and invoice match PO', function () {
    $po = PurchaseOrder::create([
        'po_number' => 'PO-PERFECT-01',
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'status' => 'APPROVED',
        'order_date' => '2026-10-14',
        'subtotal_cents' => 120000,
        'discount_cents' => 0,
        'tax_cents' => 14400,
        'total_cents' => 120000,
    ]);

    $poLine = $po->lines()->create([
        'product_id' => $this->product->id,
        'product_uom_id' => $this->baseUom->id,
        'ordered_qty' => 50,
        'conversion_factor' => 1,
        'ordered_base_qty' => 50,
        'received_base_qty' => 0,
        'unit_cost_cents' => 2400,
        'discount_percent' => '0.0000',
        'discount_amount_cents' => 0,
        'net_unit_cost_cents' => 2400,
        'net_base_cost_cents' => 2400,
        'line_total_cents' => 120000,
    ]);

    $receipt = GoodsReceipt::create([
        'gr_number' => 'GR-PERFECT-01',
        'purchase_order_id' => $po->id,
        'supplier_id' => $this->supplier->id,
        'location_id' => $this->warehouse->id,
        'status' => 'COMPLETED',
        'match_status' => 'PENDING',
        'supplier_invoice_number' => 'INV-PERFECT-01',
        'supplier_invoice_amount_cents' => 120000,
        'received_at' => now(),
    ]);

    $receipt->lines()->create([
        'purchase_order_line_id' => $poLine->id,
        'product_id' => $this->product->id,
        'product_uom_id' => $this->baseUom->id,
        'scanned_qty' => 50,
        'conversion_factor' => 1,
        'received_base_qty' => 50,
        'rejected_base_qty' => 0,
    ]);

    $response = $this->get("/procurement/receiving/{$receipt->id}/reconcile");

    $response->assertOk()
        ->assertJsonPath('audit.match_status', 'PERFECT_MATCH')
        ->assertJsonPath('audit.ordered_base_qty', 50)
        ->assertJsonPath('audit.received_base_qty', 50)
        ->assertJsonPath('audit.qty_variance_base', 0)
        ->assertJsonPath('audit.expected_cost_cents', 120000)
        ->assertJsonPath('audit.cost_variance_cents', 0)
        ->assertJsonPath('audit.suggested_debit_memo_cents', 0);
});

test('reconciles 3-way match as SHORT_DELIVERY with suggested debit memo when physical count is short', function () {
    $po = PurchaseOrder::create([
        'po_number' => 'PO-SHORT-01',
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'status' => 'APPROVED',
        'order_date' => '2026-10-14',
        'subtotal_cents' => 100000,
        'discount_cents' => 0,
        'tax_cents' => 12000,
        'total_cents' => 100000,
    ]);

    $poLine = $po->lines()->create([
        'product_id' => $this->product->id,
        'product_uom_id' => $this->baseUom->id,
        'ordered_qty' => 100,
        'conversion_factor' => 1,
        'ordered_base_qty' => 100,
        'received_base_qty' => 0,
        'unit_cost_cents' => 1000, // ₱10.00 each
        'discount_percent' => '0.0000',
        'discount_amount_cents' => 0,
        'net_unit_cost_cents' => 1000,
        'net_base_cost_cents' => 1000,
        'line_total_cents' => 100000,
    ]);

    // Physical delivery is only 80 units (20 units short!)
    $receipt = GoodsReceipt::create([
        'gr_number' => 'GR-SHORT-01',
        'purchase_order_id' => $po->id,
        'supplier_id' => $this->supplier->id,
        'location_id' => $this->warehouse->id,
        'status' => 'COMPLETED',
        'match_status' => 'PENDING',
        'supplier_invoice_number' => 'INV-SHORT-01',
        'supplier_invoice_amount_cents' => 100000, // Supplier billed full ₱1,000.00!
        'received_at' => now(),
    ]);

    $receipt->lines()->create([
        'purchase_order_line_id' => $poLine->id,
        'product_id' => $this->product->id,
        'product_uom_id' => $this->baseUom->id,
        'scanned_qty' => 80,
        'conversion_factor' => 1,
        'received_base_qty' => 80,
        'rejected_base_qty' => 0,
    ]);

    $response = $this->get("/procurement/receiving/{$receipt->id}/reconcile");

    $response->assertOk()
        ->assertJsonPath('audit.match_status', 'SHORT_DELIVERY')
        ->assertJsonPath('audit.ordered_base_qty', 100)
        ->assertJsonPath('audit.received_base_qty', 80)
        ->assertJsonPath('audit.qty_variance_base', -20)
        ->assertJsonPath('audit.expected_cost_cents', 80000)
        ->assertJsonPath('audit.suggested_debit_memo_cents', 20000); // 20 units * 1000 = 20,000 cents (₱200.00)
});

test('creates purchase order with VAT-Exclusive tax treatment (12% added to net taxable base)', function () {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'tax_type' => 'VAT_EXCLUSIVE',
        'order_date' => '2026-10-14',
        'lines' => [
            [
                'product_id' => $this->product->id,
                'product_uom_id' => $this->baseUom->id,
                'ordered_qty' => 1,
                'unit_cost_cents' => 10000, // ₱100.00
                'discount_type' => 'PERCENTAGE',
                'discount_formula' => '50', // 50% discount
            ],
        ],
    ];

    $response = $this->post('/procurement/orders', $payload);
    $response->assertRedirect();

    $po = PurchaseOrder::query()->where('supplier_id', $this->supplier->id)->latest('id')->first();
    expect($po)->not->toBeNull();
    expect($po->tax_type)->toBe('VAT_EXCLUSIVE');
    expect($po->subtotal_cents)->toBe(10000); // ₱100.00 gross
    expect($po->discount_cents)->toBe(5000); // -₱50.00 discount
    expect($po->tax_cents)->toBe(600); // 12% of ₱50.00 = ₱6.00
    expect($po->total_cents)->toBe(5600); // ₱50.00 net + ₱6.00 VAT = ₱56.00 payable
});

test('creates purchase order with VAT-Inclusive tax treatment (12% VAT extracted from net payable)', function () {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'tax_type' => 'VAT_INCLUSIVE',
        'order_date' => '2026-10-14',
        'lines' => [
            [
                'product_id' => $this->product->id,
                'product_uom_id' => $this->baseUom->id,
                'ordered_qty' => 1,
                'unit_cost_cents' => 10000, // ₱100.00 VAT-Inclusive
                'discount_type' => 'PERCENTAGE',
                'discount_formula' => '50', // 50% discount
            ],
        ],
    ];

    $response = $this->post('/procurement/orders', $payload);
    $response->assertRedirect();

    $po = PurchaseOrder::query()->where('supplier_id', $this->supplier->id)->latest('id')->first();
    expect($po)->not->toBeNull();
    expect($po->tax_type)->toBe('VAT_INCLUSIVE');
    expect($po->subtotal_cents)->toBe(10000); // ₱100.00 gross
    expect($po->discount_cents)->toBe(5000); // -₱50.00 discount
    expect($po->tax_cents)->toBe(536); // (₱50.00 / 1.12) * 0.12 = ₱5.36
    expect($po->total_cents)->toBe(5000); // ₱50.00 final payable
});

test('creates purchase order with Non-VAT tax treatment (0% tax)', function () {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'tax_type' => 'NON_VAT',
        'order_date' => '2026-10-14',
        'lines' => [
            [
                'product_id' => $this->product->id,
                'product_uom_id' => $this->baseUom->id,
                'ordered_qty' => 1,
                'unit_cost_cents' => 10000,
                'discount_type' => 'PERCENTAGE',
                'discount_formula' => '50',
            ],
        ],
    ];

    $response = $this->post('/procurement/orders', $payload);
    $response->assertRedirect();

    $po = PurchaseOrder::query()->where('supplier_id', $this->supplier->id)->latest('id')->first();
    expect($po)->not->toBeNull();
    expect($po->tax_type)->toBe('NON_VAT');
    expect($po->subtotal_cents)->toBe(10000);
    expect($po->discount_cents)->toBe(5000);
    expect($po->tax_cents)->toBe(0);
    expect($po->total_cents)->toBe(5000);
});

test('creates purchase order defaulting to NON_VAT when tax_type is omitted', function () {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'order_date' => '2026-10-14',
        'lines' => [
            [
                'product_id' => $this->product->id,
                'product_uom_id' => $this->baseUom->id,
                'ordered_qty' => 2,
                'unit_cost_cents' => 5000, // ₱50.00 each = ₱100.00 gross
            ],
        ],
    ];

    $response = $this->post('/procurement/orders', $payload);
    $response->assertRedirect();

    $po = PurchaseOrder::query()->where('supplier_id', $this->supplier->id)->latest('id')->first();
    expect($po)->not->toBeNull();
    expect($po->tax_type)->toBe('NON_VAT');
    expect($po->subtotal_cents)->toBe(10000);
    expect($po->tax_cents)->toBe(0);
    expect($po->total_cents)->toBe(10000);
});

test('creates purchase order with both line trade discounts and overall PO discount combined', function () {
    // 2 units @ ₱100.00 = ₱200.00 gross (200,000 cents)
    // Line discount: 10% trade discount -> ₱20.00 off (2,000 cents) -> Line total ₱180.00 (18,000 cents)
    // Net after line discounts: ₱180.00 (18,000 cents)
    // Overall PO discount: 5% early order discount -> 5% of ₱180.00 = ₱9.00 (900 cents)
    // Total discounts: ₱20.00 + ₱9.00 = ₱29.00 (2,900 cents)
    // Non-VAT payable: ₱200.00 - ₱29.00 = ₱171.00 (17,100 cents)
    $payload = [
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'order_date' => '2026-10-14',
        'order_discount_type' => 'PERCENTAGE',
        'order_discount_formula' => '5',
        'lines' => [
            [
                'product_id' => $this->product->id,
                'product_uom_id' => $this->baseUom->id,
                'ordered_qty' => 2,
                'unit_cost_cents' => 10000,
                'discount_type' => 'PERCENTAGE',
                'discount_formula' => '10',
            ],
        ],
    ];

    $response = $this->post('/procurement/orders', $payload);
    $response->assertRedirect();

    $po = PurchaseOrder::query()->where('supplier_id', $this->supplier->id)->latest('id')->first();
    expect($po)->not->toBeNull();
    expect($po->tax_type)->toBe('NON_VAT');
    expect($po->subtotal_cents)->toBe(20000);
    expect($po->line_discount_cents)->toBe(2000);
    expect($po->order_discount_cents)->toBe(900);
    expect($po->discount_cents)->toBe(2900);
    expect($po->tax_cents)->toBe(0);
    expect($po->total_cents)->toBe(17100);
});

test('creates purchase order with compound combination overall PO discount (% plus fixed peso)', function () {
    // 4 units @ ₱250.00 = ₱1,000.00 gross (100,000 cents)
    // Compound discount formula: "10|50" -> 10% off (₱100.00), then ₱50.00 fixed allowance off the remainder
    // ₱1,000 - 10% = ₱900.00. ₱900.00 - ₱50.00 = ₱850.00 net.
    // Order discount = ₱150.00 (15,000 cents).
    // Final payable = ₱850.00 (85,000 cents).
    $payload = [
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'order_date' => '2026-10-14',
        'order_discount_type' => 'COMPOUND',
        'order_discount_formula' => '10|50',
        'lines' => [
            [
                'product_id' => $this->product->id,
                'product_uom_id' => $this->baseUom->id,
                'ordered_qty' => 4,
                'unit_cost_cents' => 25000,
            ],
        ],
    ];

    $response = $this->post('/procurement/orders', $payload);
    $response->assertRedirect();

    $po = PurchaseOrder::query()->where('supplier_id', $this->supplier->id)->latest('id')->first();
    expect($po)->not->toBeNull();
    expect($po->tax_type)->toBe('NON_VAT');
    expect($po->subtotal_cents)->toBe(100000);
    expect($po->line_discount_cents)->toBe(0);
    expect($po->order_discount_type)->toBe('COMPOUND');
    expect($po->order_discount_formula)->toBe('10|50');
    expect($po->order_discount_cents)->toBe(15000);
    expect($po->discount_cents)->toBe(15000);
    expect($po->tax_cents)->toBe(0);
    expect($po->total_cents)->toBe(85000);
});

test('creates purchase order with ordered discount pipeline: percentage then fixed price then percentage', function () {
    // 10 units @ ₱1,000.00 = ₱10,000.00 gross (1,000,000 cents)
    // Pipeline:
    // Step 1: 10% -> ₱1,000.00 off -> Remaining: ₱9,000.00
    // Step 2: ₱500.00 fixed allowance off -> Remaining: ₱8,500.00
    // Step 3: 2% terms discount -> 2% of ₱8,500.00 = ₱170.00 off -> Remaining: ₱8,330.00
    // Total order discount = ₱1,000 + ₱500 + ₱170 = ₱1,670.00 (167,000 cents)
    // Grand Total Payable (Non-VAT) = ₱8,330.00 (833,000 cents)
    $payload = [
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'order_date' => '2026-10-14',
        'order_discount_type' => 'PIPELINE',
        'order_discount_steps' => [
            ['type' => 'PERCENT', 'value' => 10],
            ['type' => 'FIXED', 'value' => 500],
            ['type' => 'PERCENT', 'value' => 2],
        ],
        'lines' => [
            [
                'product_id' => $this->product->id,
                'product_uom_id' => $this->baseUom->id,
                'ordered_qty' => 10,
                'unit_cost_cents' => 100000, // ₱1,000.00 each
            ],
        ],
    ];

    $response = $this->post('/procurement/orders', $payload);
    $response->assertRedirect();

    $po = PurchaseOrder::query()->where('supplier_id', $this->supplier->id)->latest('id')->first();
    expect($po)->not->toBeNull();
    expect($po->tax_type)->toBe('NON_VAT');
    expect($po->subtotal_cents)->toBe(1000000);
    expect($po->order_discount_type)->toBe('PIPELINE');
    expect($po->order_discount_formula)->toBe('10% → ₱500.00 → 2%');
    expect($po->order_discount_cents)->toBe(167000);
    expect($po->discount_cents)->toBe(167000);
    expect($po->total_cents)->toBe(833000);
    expect($po->order_discount_steps)->toHaveCount(3);
});

test('creates purchase order with different sequence producing different payable: percentage then percentage then fixed price', function () {
    // 10 units @ ₱1,000.00 = ₱10,000.00 gross (1,000,000 cents)
    // Pipeline:
    // Step 1: 10% -> ₱1,000.00 off -> Remaining: ₱9,000.00
    // Step 2: 2% -> 2% of ₱9,000.00 = ₱180.00 off -> Remaining: ₱8,820.00
    // Step 3: ₱500.00 fixed allowance off -> Remaining: ₱8,320.00
    // Total order discount = ₱1,000 + ₱180 + ₱500 = ₱1,680.00 (168,000 cents)
    // Grand Total Payable (Non-VAT) = ₱8,320.00 (832,000 cents)
    $payload = [
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'order_date' => '2026-10-14',
        'order_discount_type' => 'PIPELINE',
        'order_discount_steps' => [
            ['type' => 'PERCENT', 'value' => 10],
            ['type' => 'PERCENT', 'value' => 2],
            ['type' => 'FIXED', 'value' => 500],
        ],
        'lines' => [
            [
                'product_id' => $this->product->id,
                'product_uom_id' => $this->baseUom->id,
                'ordered_qty' => 10,
                'unit_cost_cents' => 100000,
            ],
        ],
    ];

    $response = $this->post('/procurement/orders', $payload);
    $response->assertRedirect();

    $po = PurchaseOrder::query()->where('supplier_id', $this->supplier->id)->latest('id')->first();
    expect($po)->not->toBeNull();
    expect($po->subtotal_cents)->toBe(1000000);
    expect($po->order_discount_type)->toBe('PIPELINE');
    expect($po->order_discount_formula)->toBe('10% → 2% → ₱500.00');
    expect($po->order_discount_cents)->toBe(168000);
    expect($po->discount_cents)->toBe(168000);
    expect($po->total_cents)->toBe(832000);
    // Verified ₱10.00 difference proving execution sequence sensitivity
    expect($po->total_cents)->not->toBe(833000);
});
