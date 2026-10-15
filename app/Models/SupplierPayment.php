<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class SupplierPayment extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'payment_number',
        'supplier_id',
        'purchase_order_id',
        'amount_cents',
        'payment_method',
        'payment_date',
        'cheque_number',
        'bank_name',
        'cheque_date',
        'clearing_date',
        'payee_name',
        'reference_number',
        'voucher_number',
        'status',
        'notes',
        'recorded_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount_cents' => 'integer',
            'payment_date' => 'date',
            'cheque_date' => 'date',
            'clearing_date' => 'date',
        ];
    }

    /**
     * Get the owning supplier.
     *
     * @return BelongsTo<Supplier, $this>
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /**
     * Get the purchase order this payment is allocated to (if applicable).
     *
     * @return BelongsTo<PurchaseOrder, $this>
     */
    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    /**
     * Get the user who recorded this payment.
     *
     * @return BelongsTo<User, $this>
     */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
