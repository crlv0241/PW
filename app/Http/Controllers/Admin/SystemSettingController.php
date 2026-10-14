<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateSystemSettingsRequest;
use App\Models\SystemSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

final class SystemSettingController extends Controller
{
    /**
     * Display the system settings console.
     */
    public function index(): Response
    {
        Gate::authorize('access-admin');

        $settings = SystemSetting::current();

        return Inertia::render('admin/settings/index', [
            'settings' => [
                'id' => $settings->id,
                'company_name' => $settings->company_name,
                'tagline' => $settings->tagline,
                'logo_url' => $settings->logo_url,
                'favicon_url' => $settings->favicon_url,
                'primary_color' => $settings->primary_color,
                'accent_color' => $settings->accent_color,
                'theme_palette' => $settings->theme_palette,
                'dark_mode_default' => (bool) $settings->dark_mode_default,
            ],
            'palettes' => [
                [
                    'id' => 'indigo',
                    'name' => 'Midnight Indigo',
                    'primary' => '#4f46e5',
                    'accent' => '#06b6d4',
                    'description' => 'Default enterprise palette with deep indigo and vibrant cyan accents.',
                ],
                [
                    'id' => 'violet',
                    'name' => 'Imperial Violet',
                    'primary' => '#7c3aed',
                    'accent' => '#ec4899',
                    'description' => 'Royal deep violet with high-contrast fuchsia accents.',
                ],
                [
                    'id' => 'blue',
                    'name' => 'Cobalt Logistics',
                    'primary' => '#2563eb',
                    'accent' => '#38bdf8',
                    'description' => 'Clean corporate cobalt blue with sky-blue accents.',
                ],
                [
                    'id' => 'emerald',
                    'name' => 'Emerald Supply',
                    'primary' => '#059669',
                    'accent' => '#10b981',
                    'description' => 'Modern forest emerald with vibrant mint highlights.',
                ],
                [
                    'id' => 'amber',
                    'name' => 'Solar Industrial',
                    'primary' => '#d97706',
                    'accent' => '#f59e0b',
                    'description' => 'Warm industrial gold and amber high-visibility tone.',
                ],
                [
                    'id' => 'rose',
                    'name' => 'Crimson Velocity',
                    'primary' => '#e11d48',
                    'accent' => '#f43f5e',
                    'description' => 'Dynamic crimson rose with crisp modern contrast.',
                ],
                [
                    'id' => 'slate',
                    'name' => 'Titanium Monolith',
                    'primary' => '#334155',
                    'accent' => '#64748b',
                    'description' => 'Minimalist monochrome titanium slate architecture.',
                ],
            ],
        ]);
    }

    /**
     * Update system settings, branding assets, and theme colors.
     */
    public function update(UpdateSystemSettingsRequest $request): RedirectResponse
    {
        $settings = SystemSetting::current();
        $validated = $request->validated();

        // 1. Handle Logo Upload or Removal
        if ($request->boolean('remove_logo')) {
            if ($settings->logo_path !== null && Storage::disk('public')->exists($settings->logo_path)) {
                Storage::disk('public')->delete($settings->logo_path);
            }
            $settings->logo_path = null;
        } elseif ($request->hasFile('logo')) {
            /** @var UploadedFile $logoFile */
            $logoFile = $request->file('logo');
            if ($settings->logo_path !== null && Storage::disk('public')->exists($settings->logo_path)) {
                Storage::disk('public')->delete($settings->logo_path);
            }
            $storedLogo = $logoFile->store('branding', 'public');
            if (is_string($storedLogo)) {
                $settings->logo_path = $storedLogo;
            }
        }

        // 2. Handle Favicon Upload or Removal
        if ($request->boolean('remove_favicon')) {
            if ($settings->favicon_path !== null && Storage::disk('public')->exists($settings->favicon_path)) {
                Storage::disk('public')->delete($settings->favicon_path);
            }
            $settings->favicon_path = null;
        } elseif ($request->hasFile('favicon')) {
            /** @var UploadedFile $faviconFile */
            $faviconFile = $request->file('favicon');
            if ($settings->favicon_path !== null && Storage::disk('public')->exists($settings->favicon_path)) {
                Storage::disk('public')->delete($settings->favicon_path);
            }
            $storedFavicon = $faviconFile->store('branding', 'public');
            if (is_string($storedFavicon)) {
                $settings->favicon_path = $storedFavicon;
            }
        }

        // 3. Update Text and Theme Properties
        $settings->company_name = $validated['company_name'];
        $settings->tagline = $validated['tagline'];
        $settings->primary_color = $validated['primary_color'];
        $settings->accent_color = $validated['accent_color'];
        $settings->theme_palette = $validated['theme_palette'];
        $settings->dark_mode_default = (bool) ($validated['dark_mode_default'] ?? false);

        $settings->save();

        return redirect()->route('admin.settings.index')
            ->with('success', 'System branding, assets, and theme color palette updated successfully.');
    }
}
