<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('tax_type', 32)->default('NON_VAT')->change();
            $table->unsignedBigInteger('line_discount_cents')->default(0)->after('subtotal_cents');
            $table->string('order_discount_type', 32)->default('PERCENTAGE')->after('discount_cents');
            $table->string('order_discount_formula', 64)->nullable()->after('order_discount_type');
            $table->unsignedBigInteger('order_discount_cents')->default(0)->after('order_discount_formula');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('tax_type', 32)->default('VAT_EXCLUSIVE')->change();
            $table->dropColumn([
                'line_discount_cents',
                'order_discount_type',
                'order_discount_formula',
                'order_discount_cents',
            ]);
        });
    }
};
