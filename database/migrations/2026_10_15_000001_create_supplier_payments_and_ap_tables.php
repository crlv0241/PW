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
        // 1. Add payment tracking columns to purchase_orders
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->unsignedBigInteger('paid_amount_cents')->default(0)->after('total_cents');
            $table->string('payment_status', 32)->default('UNPAID')->index()->after('paid_amount_cents'); // UNPAID, PARTIALLY_PAID, PAID
        });

        // 2. Create supplier_payments table (Accounts Payable transactions)
        Schema::create('supplier_payments', function (Blueprint $table) {
            $table->id();
            $table->string('payment_number', 32)->unique(); // e.g. AP-PAY-2026-0001
            $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
            $table->foreignId('purchase_order_id')->nullable()->constrained('purchase_orders')->nullOnDelete();
            $table->unsignedBigInteger('amount_cents');
            $table->string('payment_method', 32); // CASH, CHEQUE, BANK_TRANSFER
            $table->date('payment_date');

            // Tender-Specific Audit Information
            $table->string('cheque_number', 64)->nullable();
            $table->string('bank_name', 100)->nullable();
            $table->date('cheque_date')->nullable();
            $table->date('clearing_date')->nullable();
            $table->string('payee_name', 255)->nullable();
            $table->string('reference_number', 100)->nullable(); // Bank transfer ref # or Cash voucher
            $table->string('voucher_number', 64)->nullable();

            $table->string('status', 32)->default('COMPLETED')->index(); // COMPLETED, PENDING_CLEARING, BOUNCED, VOID
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['supplier_id', 'payment_date']);
            $table->index(['purchase_order_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('supplier_payments');

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropIndex(['payment_status']);
            $table->dropColumn(['paid_amount_cents', 'payment_status']);
        });
    }
};
