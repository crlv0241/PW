<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $po_number
 * @property string|null $supplier_reference
 * @property int $supplier_id
 * @property int $destination_location_id
 * @property string $status
 * @property string|null $tax_type
 * @property Carbon|null $order_date
 * @property Carbon|null $expected_delivery_date
 * @property int $subtotal_cents
 * @property int $line_discount_cents
 * @property int $discount_cents
 * @property int $tax_cents
 * @property int $total_cents
 * @property int $paid_amount_cents
 * @property string $payment_status
 * @property Location|null $destinationLocation
 * @property Collection<int, PurchaseOrderLine> $lines
 */
final class PurchaseOrder extends Model
{
    use SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'po_number',
        'supplier_reference',
        'supplier_id',
        'destination_location_id',
        'status',
        'tax_type',
        'order_date',
        'expected_delivery_date',
        'subtotal_cents',
        'line_discount_cents',
        'order_discount_type',
        'order_discount_formula',
        'order_discount_steps',
        'order_discount_cents',
        'discount_cents',
        'tax_cents',
        'total_cents',
        'paid_amount_cents',
        'payment_status',
        'notes',
        'created_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'order_date' => 'date',
            'expected_delivery_date' => 'date',
            'subtotal_cents' => 'integer',
            'line_discount_cents' => 'integer',
            'order_discount_steps' => 'array',
            'order_discount_cents' => 'integer',
            'discount_cents' => 'integer',
            'tax_cents' => 'integer',
            'total_cents' => 'integer',
            'paid_amount_cents' => 'integer',
        ];
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
    public function destinationLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'destination_location_id');
    }

    /**
     * @return BelongsTo<Location, $this>
     */
    public function destination_location(): BelongsTo
    {
        return $this->destinationLocation();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<PurchaseOrderLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseOrderLine::class);
    }

    /**
     * @return HasMany<GoodsReceipt, $this>
     */
    public function goodsReceipts(): HasMany
    {
        return $this->hasMany(GoodsReceipt::class);
    }

    /**
     * @return HasMany<SupplierPayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(SupplierPayment::class);
    }
}
