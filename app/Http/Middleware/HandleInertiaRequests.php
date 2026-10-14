<?php

namespace App\Http\Middleware;

use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();
        if ($user) {
            $user->loadMissing('roles');
        }

        $settings = SystemSetting::current();

        return [
            ...parent::share($request),
            'name' => $settings->company_name,
            'branding' => [
                'company_name' => $settings->company_name,
                'tagline' => $settings->tagline,
                'logo_url' => $settings->logo_url,
                'favicon_url' => $settings->favicon_url,
                'primary_color' => $settings->primary_color,
                'accent_color' => $settings->accent_color,
                'theme_palette' => $settings->theme_palette,
                'dark_mode_default' => (bool) $settings->dark_mode_default,
            ],
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_active' => (bool) $user->is_active,
                    'is_super_admin' => $user->isSuperAdmin(),
                    'primary_role' => $user->primaryRoleName(),
                    'roles' => $user->roles->pluck('name')->all(),
                ] : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }
}
