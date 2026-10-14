<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\InventoryLedger;
use App\Models\Location;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryLedger>
 */
class InventoryLedgerFactory extends Factory
{
    protected $model = InventoryLedger::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'client_uuid' => fake()->unique()->uuid(),
            'location_id' => Location::factory(),
            'product_id' => Product::factory(),
            'qty_change' => fake()->numberBetween(1, 100),
            'transaction_type' => 'STOCK_IN',
            'reference_id' => null,
            'batch_number' => 'BATCH-'.fake()->numerify('####'),
            'expiry_date' => fake()->dateTimeBetween('+6 months', '+2 years'),
            'notes' => fake()->sentence(),
        ];
    }
}
