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
            $table->index('order_date', 'purchase_orders_order_date_index');
            $table->index(['supplier_id', 'order_date'], 'purchase_orders_supplier_order_date_index');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropIndex('purchase_orders_order_date_index');
            $table->dropIndex('purchase_orders_supplier_order_date_index');
        });
    }
};
