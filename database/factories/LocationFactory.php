<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Location;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Location>
 */
class LocationFactory extends Factory
{
    protected $model = Location::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => 'LOC-'.fake()->unique()->numerify('####'),
            'name' => fake()->city().' Warehouse',
            'type' => fake()->randomElement(['warehouse', 'truck', 'damage', 'staging']),
            'address' => fake()->address(),
            'is_active' => true,
        ];
    }
}
