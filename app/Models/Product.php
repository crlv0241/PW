<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory, SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'sku',
        'name',
        'category',
        'status',
        'tax_category',
        'tax_rate',
        'description',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tax_rate' => 'decimal:4',
        ];
    }

    /**
     * Get all UOM packaging tiers defined for this product.
     *
     * @return HasMany<ProductUom, $this>
     */
    public function uoms(): HasMany
    {
        return $this->hasMany(ProductUom::class);
    }

    /**
     * Get the base indivisible unit (conversion_factor = 1) for this product.
     *
     * @return HasOne<ProductUom, $this>
     */
    public function baseUom(): HasOne
    {
        return $this->hasOne(ProductUom::class)->where('is_base_unit', true);
    }

    /**
     * Get inventory stock balances across warehouse locations.
     *
     * @return HasMany<InventoryBalance, $this>
     */
    public function balances(): HasMany
    {
        return $this->hasMany(InventoryBalance::class);
    }
}
