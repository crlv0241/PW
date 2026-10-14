<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\SystemSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SystemSetting>
 */
final class SystemSettingFactory extends Factory
{
    protected $model = SystemSetting::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_name' => 'APEX POS & WMS',
            'tagline' => 'Enterprise Core v1.0',
            'logo_path' => null,
            'favicon_path' => null,
            'primary_color' => '#4f46e5',
            'accent_color' => '#06b6d4',
            'theme_palette' => 'indigo',
            'dark_mode_default' => false,
        ];
    }
}
