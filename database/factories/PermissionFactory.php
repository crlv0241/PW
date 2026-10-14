<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Permission;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Permission>
 */
class PermissionFactory extends Factory
{
    protected $model = Permission::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $action = fake()->randomElement(['view', 'create', 'update', 'delete', 'manage']);
        $module = fake()->unique()->word();

        return [
            'name' => "{$module}.{$action}",
            'display_name' => ucfirst($action).' '.ucfirst($module),
            'group' => ucfirst($module),
        ];
    }
}
