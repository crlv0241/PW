<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductUom;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductUom>
 */
class ProductUomFactory extends Factory
{
    protected $model = ProductUom::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'name' => 'Piece',
            'conversion_factor' => 1,
            'barcode' => fake()->unique()->ean13(),
            'is_base_unit' => true,
            'price_cents' => 1000,
        ];
    }
}
