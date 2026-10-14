<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductUomFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class ProductUom extends Model
{
    /** @use HasFactory<ProductUomFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'product_id',
        'name',
        'conversion_factor',
        'barcode',
        'is_base_unit',
        'price_cents',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'conversion_factor' => 'integer',
            'is_base_unit' => 'boolean',
            'price_cents' => 'integer',
        ];
    }

    /**
     * Get the owning product.
     *
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
