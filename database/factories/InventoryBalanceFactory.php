<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryBalance>
 */
class InventoryBalanceFactory extends Factory
{
    protected $model = InventoryBalance::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'location_id' => Location::factory(),
            'product_id' => Product::factory(),
            'current_qty' => fake()->numberBetween(0, 500),
        ];
    }
}
