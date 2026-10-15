<?php

declare(strict_types=1);

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptLine;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductUom;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);

    $this->warehouse = Location::factory()->create([
        'code' => 'WH-AP-TEST',
        'type' => 'warehouse',
        'is_active' => true,
    ]);

    $this->supplier = Supplier::query()->firstOrCreate(
        ['supplier_code' => 'SUPP-AP-01'],
        [
            'name' => 'Metro Beverage Distributors Inc.',
            'contact_name' => 'Juan Dela Cruz',
            'email' => 'metro@beverage.ph',
            'phone' => '09171234567',
            'payment_terms_days' => 30,
            'is_active' => true,
        ]
    );

    $this->product = Product::factory()->create([
        'sku' => 'SKU-AP-COLA',
        'name' => 'Apex Cola 330ml',
    ]);

    $this->uomPiece = ProductUom::create([
        'product_id' => $this->product->id,
        'name' => 'Piece',
        'conversion_factor' => 1,
        'barcode' => '480000000001',
        'is_base_unit' => true,
        'price_cents' => 3000,
    ]);

    // Create an approved PO with ₱100,000.00 value
    $this->purchaseOrder = PurchaseOrder::create([
        'po_number' => 'PO-AP-2026-0001',
        'supplier_reference' => 'SO-METRO-9981',
        'supplier_id' => $this->supplier->id,
        'destination_location_id' => $this->warehouse->id,
        'status' => 'APPROVED',
        'tax_type' => 'VAT_INCLUSIVE',
        'order_date' => '2026-10-10',
        'expected_delivery_date' => '2026-10-15',
        'subtotal_cents' => 10000000,
        'line_discount_cents' => 0,
        'order_discount_cents' => 0,
        'discount_cents' => 0,
        'tax_cents' => 1071429,
        'total_cents' => 10000000, // ₱100,000.00
        'paid_amount_cents' => 0,
        'payment_status' => 'UNPAID',
        'created_by' => $this->user->id,
    ]);

    $this->poLine = PurchaseOrderLine::create([
        'purchase_order_id' => $this->purchaseOrder->id,
        'product_id' => $this->product->id,
        'product_uom_id' => $this->uomPiece->id,
        'ordered_qty' => 4000,
        'conversion_factor' => 1,
        'ordered_base_qty' => 4000,
        'received_base_qty' => 0,
        'unit_cost_cents' => 2500,
        'discount_percent' => '0',
        'discount_amount_cents' => 0,
        'net_unit_cost_cents' => 2500,
        'net_base_cost_cents' => 2500,
        'line_total_cents' => 10000000,
    ]);
});

test('supplier payables index displays summary metrics and suppliers list', function () {
    $response = $this->get('/procurement/payables');

    $response->assertOk();
    $response->assertInertia(
        fn (Assert $page) => $page
            ->component('procurement/payables/index')
            ->has('suppliers.data')
            ->has('metrics', fn (Assert $m) => $m
                ->has('total_outstanding_cents')
                ->has('pending_cheques_cents')
                ->has('total_paid_cents')
                ->has('overdue_payables_cents')
            )
            ->where('metrics.total_outstanding_cents', 10000000)
    );
});

test('supplier payables dissection view displays supplier profile, open POs, and payment history', function () {
    $response = $this->get("/procurement/payables/{$this->supplier->id}");

    $response->assertOk();
    $response->assertInertia(
        fn (Assert $page) => $page
            ->component('procurement/payables/show')
            ->has('supplier')
            ->has('orders')
            ->has('payments')
            ->where('supplier.id', $this->supplier->id)
            ->where('supplier.outstanding_balance_cents', 10000000)
    );
});

test('recording cash payment updates PO paid amount, remaining balance, and creates payment record', function () {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'purchase_order_id' => $this->purchaseOrder->id,
        'payment_method' => 'CASH',
        'amount_cents' => 4000000, // ₱40,000.00 partial
        'payment_date' => '2026-10-15',
        'voucher_number' => 'PCV-2026-0042',
        'notes' => 'Petty cash partial disbursement',
    ];

    $response = $this->post('/procurement/payables/payments', $payload);

    $response->assertRedirect();

    $this->assertDatabaseHas('supplier_payments', [
        'supplier_id' => $this->supplier->id,
        'purchase_order_id' => $this->purchaseOrder->id,
        'payment_method' => 'CASH',
        'amount_cents' => 4000000,
        'voucher_number' => 'PCV-2026-0042',
        'status' => 'COMPLETED',
        'recorded_by' => $this->user->id,
    ]);

    $this->purchaseOrder->refresh();
    expect($this->purchaseOrder->paid_amount_cents)->toBe(4000000);
    expect($this->purchaseOrder->payment_status)->toBe('PARTIALLY_PAID');

    // Make second payment completing the balance
    $secondPayload = [
        'supplier_id' => $this->supplier->id,
        'purchase_order_id' => $this->purchaseOrder->id,
        'payment_method' => 'CASH',
        'amount_cents' => 6000000, // ₱60,000.00 to complete
        'payment_date' => '2026-10-15',
        'voucher_number' => 'PCV-2026-0043',
    ];

    $this->post('/procurement/payables/payments', $secondPayload)->assertRedirect();

    $this->purchaseOrder->refresh();
    expect($this->purchaseOrder->paid_amount_cents)->toBe(10000000);
    expect($this->purchaseOrder->payment_status)->toBe('PAID');
});

test('recording cheque payment stores bank details and clearing date', function () {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'purchase_order_id' => $this->purchaseOrder->id,
        'payment_method' => 'CHEQUE',
        'amount_cents' => 5000000, // ₱50,000.00
        'payment_date' => '2026-10-15',
        'cheque_number' => 'CHK-BDO-0099124',
        'bank_name' => 'BDO Unibank Inc.',
        'cheque_date' => '2026-10-15',
        'clearing_date' => '2026-10-18', // Future clearing date
        'payee_name' => 'Metro Beverage Distributors Inc.',
        'notes' => 'Post-dated cheque for 3-day clearing',
    ];

    $response = $this->post('/procurement/payables/payments', $payload);

    $response->assertRedirect();

    $payment = SupplierPayment::query()
        ->where('cheque_number', 'CHK-BDO-0099124')
        ->first();

    expect($payment)->not->toBeNull();
    expect($payment->supplier_id)->toBe($this->supplier->id);
    expect($payment->payment_method)->toBe('CHEQUE');
    expect($payment->amount_cents)->toBe(5000000);
    expect($payment->bank_name)->toBe('BDO Unibank Inc.');
    expect($payment->status)->toBe('PENDING_CLEARING');
    expect($payment->clearing_date?->format('Y-m-d'))->toBe('2026-10-18');
});

test('recording bank transfer stores reference trace number and marks completed', function () {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'purchase_order_id' => $this->purchaseOrder->id,
        'payment_method' => 'BANK_TRANSFER',
        'amount_cents' => 10000000, // Full ₱100,000.00
        'payment_date' => '2026-10-15',
        'reference_number' => 'INSTAPAY-TXN-20261015-88912',
        'bank_name' => 'Bank of the Philippine Islands (BPI)',
        'notes' => 'InstaPay settling PO-AP-2026-0001',
    ];

    $response = $this->post('/procurement/payables/payments', $payload);

    $response->assertRedirect();

    $this->assertDatabaseHas('supplier_payments', [
        'supplier_id' => $this->supplier->id,
        'purchase_order_id' => $this->purchaseOrder->id,
        'payment_method' => 'BANK_TRANSFER',
        'reference_number' => 'INSTAPAY-TXN-20261015-88912',
        'status' => 'COMPLETED',
    ]);

    $this->purchaseOrder->refresh();
    expect($this->purchaseOrder->paid_amount_cents)->toBe(10000000);
    expect($this->purchaseOrder->payment_status)->toBe('PAID');
});

test('payment amount cannot exceed remaining balance on the purchase order', function () {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'purchase_order_id' => $this->purchaseOrder->id,
        'payment_method' => 'CASH',
        'amount_cents' => 15000000, // ₱150,000.00 exceeds ₱100,000.00
        'payment_date' => '2026-10-15',
        'voucher_number' => 'PCV-ERR-001',
    ];

    $response = $this->post('/procurement/payables/payments', $payload);

    $response->assertSessionHasErrors(['amount_cents']);
});

test('retroactive linking connects unlinked goods receipt to PO and executes 3-way match', function () {
    // 1. Create an unlinked direct receipt (delivery arrived before PO was encoded)
    $goodsReceipt = GoodsReceipt::create([
        'gr_number' => 'GR-UNLINKED-2026-001',
        'supplier_id' => $this->supplier->id,
        'location_id' => $this->warehouse->id,
        'received_by' => $this->user->id,
        'purchase_order_id' => null,
        'supplier_delivery_note' => 'DN-9981-A',
        'supplier_invoice_number' => 'INV-METRO-0045',
        'supplier_invoice_amount_cents' => 10000000,
        'match_status' => 'UNLINKED',
        'received_at' => '2026-10-15 08:00:00',
    ]);

    $grLine = GoodsReceiptLine::create([
        'goods_receipt_id' => $goodsReceipt->id,
        'purchase_order_line_id' => null,
        'product_id' => $this->product->id,
        'product_uom_id' => $this->uomPiece->id,
        'conversion_factor' => 1,
        'scanned_qty' => 4000,
        'received_base_qty' => 4000,
        'rejected_base_qty' => 0,
        'unit_cost_cents' => 2500,
        'subtotal_cents' => 10000000,
    ]);

    expect($goodsReceipt->purchase_order_id)->toBeNull();
    expect($goodsReceipt->match_status)->toBe('UNLINKED');

    // 2. Retroactively link to the PO
    $response = $this->post("/procurement/receiving/{$goodsReceipt->id}/link-po", [
        'purchase_order_id' => $this->purchaseOrder->id,
    ]);

    $response->assertRedirect();

    $goodsReceipt->refresh();
    $grLine->refresh();

    expect($goodsReceipt->purchase_order_id)->toBe($this->purchaseOrder->id);
    expect($grLine->purchase_order_line_id)->toBe($this->poLine->id);
    // Since received 4000 pcs matches ordered 4000 pcs and invoice ₱100,000 matches PO ₱100,000
    expect($goodsReceipt->match_status)->toBe('PERFECT_MATCH');
});
