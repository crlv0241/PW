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
        Schema::create('inventory_ledgers', function (Blueprint $table) {
            $table->id();
            $table->uuid('client_uuid')->unique(); // Unique transaction deduplication key
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('qty_change'); // Signed integer base units (+ for additions, - for deductions)
            $table->string('transaction_type')->index(); // STOCK_IN, TRANSFER_OUT, TRANSFER_IN, SALE, ADJUSTMENT, RETURN
            $table->unsignedBigInteger('reference_id')->nullable(); // Associated PO, Sale, Transfer, or Count ID
            $table->string('batch_number')->nullable()->index();
            $table->date('expiry_date')->nullable()->index();
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent()->index(); // Immutable append-only log: no updated_at

            $table->index(['location_id', 'product_id', 'created_at']);
        });

        Schema::create('inventory_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('current_qty')->default(0); // Cached aggregate balance in whole integer base units
            $table->timestamps();

            $table->unique(['location_id', 'product_id']);
            $table->index(['location_id', 'current_qty']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_balances');
        Schema::dropIfExists('inventory_ledgers');
    }
};
