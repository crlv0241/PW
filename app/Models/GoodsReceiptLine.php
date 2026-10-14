<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class GoodsReceiptLine extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'goods_receipt_id',
        'purchase_order_line_id',
        'product_id',
        'product_uom_id',
        'scanned_qty',
        'conversion_factor',
        'received_base_qty',
        'rejected_base_qty',
        'batch_number',
        'expiry_date',
        'remarks',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'scanned_qty' => 'integer',
            'conversion_factor' => 'integer',
            'received_base_qty' => 'integer',
            'rejected_base_qty' => 'integer',
            'expiry_date' => 'date',
        ];
    }

    /**
     * @return BelongsTo<GoodsReceipt, $this>
     */
    public function goodsReceipt(): BelongsTo
    {
        return $this->belongsTo(GoodsReceipt::class);
    }

    /**
     * @return BelongsTo<PurchaseOrderLine, $this>
     */
    public function purchaseOrderLine(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderLine::class);
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
}
