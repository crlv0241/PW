<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'account_code' => 'CUST-'.fake()->unique()->numerify('#####'),
            'company_name' => fake()->company(),
            'contact_person' => fake()->name(),
            'email' => fake()->safeEmail(),
            'phone' => fake()->phoneNumber(),
            'delivery_address' => fake()->address(),
            'credit_limit_cents' => 5000000, // 50,000.00
            'current_balance_cents' => 0,
            'payment_terms_days' => 30,
            'is_active' => true,
        ];
    }
}
