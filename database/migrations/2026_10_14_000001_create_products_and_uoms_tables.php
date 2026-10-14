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
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('sku')->unique();
            $table->string('name');
            $table->string('category')->index();
            $table->string('status')->default('ACTIVE')->index();
            $table->string('tax_category')->default('STANDARD');
            $table->decimal('tax_rate', 6, 4)->default(0.1200);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('product_uoms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('name'); // e.g., Piece, Pack, Case, Pallet
            $table->unsignedInteger('conversion_factor'); // Integer multiplier to base unit (1 for base unit)
            $table->string('barcode')->nullable()->unique();
            $table->boolean('is_base_unit')->default(false);
            $table->unsignedBigInteger('price_cents')->nullable(); // Explicit tier price in minor units if defined
            $table->timestamps();

            $table->unique(['product_id', 'name']);
            $table->index(['product_id', 'is_base_unit']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_uoms');
        Schema::dropIfExists('products');
    }
};
