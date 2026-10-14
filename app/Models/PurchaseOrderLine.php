<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class PurchaseOrderLine extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'purchase_order_id',
        'product_id',
        'product_uom_id',
        'ordered_qty',
        'conversion_factor',
        'ordered_base_qty',
        'unit_cost_cents',
        'discount_type',
        'discount_formula',
        'discount_percent',
        'discount_amount_cents',
        'net_unit_cost_cents',
        'net_base_cost_cents',
        'line_total_cents',
        'received_base_qty',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'ordered_qty' => 'integer',
            'conversion_factor' => 'integer',
            'ordered_base_qty' => 'integer',
            'unit_cost_cents' => 'integer',
            'discount_percent' => 'decimal:4',
            'discount_amount_cents' => 'integer',
            'net_unit_cost_cents' => 'integer',
            'net_base_cost_cents' => 'integer',
            'line_total_cents' => 'integer',
            'received_base_qty' => 'integer',
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
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return BelongsTo<ProductUom, $this>
     */
    public function uom(): BelongsTo
    {
        return $this->belongsTo(ProductUom::class, 'product_uom_id');
    }

    /**
     * @return HasMany<GoodsReceiptLine, $this>
     */
    public function goodsReceiptLines(): HasMany
    {
        return $this->hasMany(GoodsReceiptLine::class);
    }
}
