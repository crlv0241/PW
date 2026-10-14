<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'sku' => 'SKU-'.fake()->unique()->numerify('#####'),
            'name' => fake()->words(3, true),
            'category' => fake()->randomElement(['Beverages', 'Snacks', 'Dairy', 'Canned Goods', 'Condiments']),
            'status' => 'ACTIVE',
            'tax_category' => 'STANDARD',
            'tax_rate' => '0.1200',
            'description' => fake()->sentence(),
        ];
    }
}
