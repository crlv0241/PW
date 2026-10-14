<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class GoodsReceipt extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'gr_number',
        'purchase_order_id',
        'supplier_id',
        'location_id',
        'received_by',
        'status',
        'match_status',
        'supplier_invoice_number',
        'supplier_delivery_note',
        'supplier_invoice_amount_cents',
        'notes',
        'received_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'supplier_invoice_amount_cents' => 'integer',
            'received_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<PurchaseOrder, $this>
     */
    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    /**
     * @return BelongsTo<Supplier, $this>
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /**
     * @return BelongsTo<Location, $this>
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    /**
     * @return HasMany<GoodsReceiptLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(GoodsReceiptLine::class);
    }
}
