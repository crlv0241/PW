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
            $table->string('order_discount_formula', 255)->nullable()->change();
            $table->json('order_discount_steps')->nullable()->after('order_discount_formula');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn('order_discount_steps');
            $table->string('order_discount_formula', 64)->nullable()->change();
        });
    }
};
