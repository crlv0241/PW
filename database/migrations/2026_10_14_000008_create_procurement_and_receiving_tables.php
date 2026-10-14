<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Purchase Orders
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('po_number', 32)->unique();
            $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
            $table->foreignId('destination_location_id')->constrained('locations');
            $table->string('status', 32)->default('APPROVED')->index(); // DRAFT, APPROVED, PARTIALLY_RECEIVED, COMPLETED, CANCELLED
            $table->date('order_date');
            $table->date('expected_delivery_date')->nullable();
            $table->unsignedBigInteger('subtotal_cents')->default(0);
            $table->unsignedBigInteger('discount_cents')->default(0);
            $table->unsignedBigInteger('tax_cents')->default(0);
            $table->unsignedBigInteger('total_cents')->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        // 2. Purchase Order Lines
        Schema::create('purchase_order_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products');
            $table->foreignId('product_uom_id')->constrained('product_uoms');
            $table->unsignedInteger('ordered_qty');
            $table->unsignedInteger('conversion_factor');
            $table->unsignedInteger('ordered_base_qty');
            $table->unsignedBigInteger('unit_cost_cents');
            $table->decimal('discount_percent', 6, 4)->default(0);
            $table->unsignedBigInteger('discount_amount_cents')->default(0);
            $table->unsignedBigInteger('net_unit_cost_cents');
            $table->unsignedBigInteger('net_base_cost_cents');
            $table->unsignedBigInteger('line_total_cents');
            $table->unsignedInteger('received_base_qty')->default(0);
            $table->timestamps();

            $table->index(['purchase_order_id', 'product_id']);
        });

        // 3. Goods Receipts (Inbound Physical Intake)
        Schema::create('goods_receipts', function (Blueprint $table) {
            $table->id();
            $table->string('gr_number', 32)->unique();
            $table->foreignId('purchase_order_id')->nullable()->constrained('purchase_orders')->nullOnDelete();
            $table->foreignId('supplier_id')->constrained('suppliers');
            $table->foreignId('location_id')->constrained('locations');
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 32)->default('COMPLETED')->index(); // COMPLETED, VOID
            $table->string('match_status', 32)->default('PENDING')->index(); // PENDING, PERFECT_MATCH, SHORT_DELIVERY, OVER_DELIVERY, PRICE_VARIANCE
            $table->string('supplier_invoice_number', 64)->nullable();
            $table->string('supplier_delivery_note', 64)->nullable();
            $table->unsignedBigInteger('supplier_invoice_amount_cents')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('received_at')->useCurrent();
            $table->timestamps();
        });

        // 4. Goods Receipt Lines
        Schema::create('goods_receipt_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('goods_receipt_id')->constrained('goods_receipts')->cascadeOnDelete();
            $table->foreignId('purchase_order_line_id')->nullable()->constrained('purchase_order_lines')->nullOnDelete();
            $table->foreignId('product_id')->constrained('products');
            $table->foreignId('product_uom_id')->constrained('product_uoms');
            $table->unsignedInteger('scanned_qty');
            $table->unsignedInteger('conversion_factor');
            $table->unsignedInteger('received_base_qty');
            $table->unsignedInteger('rejected_base_qty')->default(0);
            $table->string('batch_number', 64)->nullable();
            $table->date('expiry_date')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->index(['goods_receipt_id', 'product_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('goods_receipt_lines');
        Schema::dropIfExists('goods_receipts');
        Schema::dropIfExists('purchase_order_lines');
        Schema::dropIfExists('purchase_orders');
    }
};
