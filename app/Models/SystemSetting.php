<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\SystemSettingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property string $company_name
 * @property string $tagline
 * @property string|null $logo_path
 * @property string|null $favicon_path
 * @property string $primary_color
 * @property string $accent_color
 * @property string $theme_palette
 * @property bool $dark_mode_default
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read string|null $logo_url
 * @property-read string|null $favicon_url
 */
final class SystemSetting extends Model
{
    /** @use HasFactory<SystemSettingFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'company_name',
        'tagline',
        'logo_path',
        'favicon_path',
        'primary_color',
        'accent_color',
        'theme_palette',
        'dark_mode_default',
    ];

    /**
     * @var list<string>
     */
    protected $appends = [
        'logo_url',
        'favicon_url',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'dark_mode_default' => 'boolean',
        ];
    }

    /**
     * Get or initialize the active system settings singleton.
     */
    public static function current(): self
    {
        /** @var self $setting */
        $setting = self::firstOrCreate(
            ['id' => 1],
            [
                'company_name' => 'APEX POS & WMS',
                'tagline' => 'Enterprise Core v1.0',
                'primary_color' => '#4f46e5',
                'accent_color' => '#06b6d4',
                'theme_palette' => 'indigo',
                'dark_mode_default' => false,
            ]
        );

        return $setting;
    }

    /**
     * Get public URL for system logo.
     */
    public function getLogoUrlAttribute(): ?string
    {
        return $this->logo_path ? Storage::url($this->logo_path) : null;
    }

    /**
     * Get public URL for favicon.
     */
    public function getFaviconUrlAttribute(): ?string
    {
        return $this->favicon_path ? Storage::url($this->favicon_path) : null;
    }
}
