<?php

declare(strict_types=1);

use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('public');

    $this->superAdminRole = Role::firstOrCreate(
        ['name' => 'super_admin'],
        ['display_name' => 'Super Administrator', 'description' => 'Full administrative access']
    );

    $this->managerRole = Role::firstOrCreate(
        ['name' => 'warehouse_manager'],
        ['display_name' => 'Warehouse Manager', 'description' => 'Supervises warehouse inventory']
    );

    $this->superAdmin = User::factory()->create([
        'name' => 'Root Admin',
        'email' => 'root.settings@poswms.test',
        'is_active' => true,
    ]);
    $this->superAdmin->roles()->sync([$this->superAdminRole->id]);

    $this->regularStaff = User::factory()->create([
        'name' => 'Staff Member',
        'email' => 'staff.settings@poswms.test',
        'is_active' => true,
    ]);
    $this->regularStaff->roles()->sync([$this->managerRole->id]);
});

test('unauthenticated users cannot access system settings', function () {
    $response = $this->get('/admin/settings');

    $response->assertRedirect('/login');
});

test('non-super-admin users are forbidden from system settings', function () {
    $response = $this->actingAs($this->regularStaff)->get('/admin/settings');

    $response->assertForbidden();
});

test('super admin can view system settings page with presets and branding', function () {
    $response = $this->actingAs($this->superAdmin)->get('/admin/settings');

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/settings/index')
            ->has('settings')
            ->has('palettes')
            ->where('settings.company_name', 'APEX POS & WMS')
        );
});

test('super admin can update company branding and theme colors', function () {
    $response = $this->actingAs($this->superAdmin)
        ->post('/admin/settings', [
            'company_name' => 'Global Logistics Inc',
            'tagline' => 'NextGen Supply Chain OS',
            'primary_color' => '#2563eb',
            'accent_color' => '#38bdf8',
            'theme_palette' => 'blue',
            'dark_mode_default' => true,
        ]);

    $response->assertRedirect('/admin/settings');
    $response->assertSessionHas('success');

    $settings = SystemSetting::current();
    expect($settings->company_name)->toBe('Global Logistics Inc');
    expect($settings->tagline)->toBe('NextGen Supply Chain OS');
    expect($settings->primary_color)->toBe('#2563eb');
    expect($settings->accent_color)->toBe('#38bdf8');
    expect($settings->theme_palette)->toBe('blue');
    expect($settings->dark_mode_default)->toBeTrue();
});

test('super admin can upload system logo and favicon', function () {
    $logo = UploadedFile::fake()->image('company_logo.png', 400, 400);
    $favicon = UploadedFile::fake()->create('custom_favicon.ico', 32, 'image/x-icon');

    $response = $this->actingAs($this->superAdmin)
        ->post('/admin/settings', [
            'company_name' => 'APEX Logistics',
            'tagline' => 'Enterprise Core v1.0',
            'primary_color' => '#4f46e5',
            'accent_color' => '#06b6d4',
            'theme_palette' => 'indigo',
            'logo' => $logo,
            'favicon' => $favicon,
        ]);

    $response->assertRedirect('/admin/settings');
    $response->assertSessionHas('success');

    $settings = SystemSetting::current();
    expect($settings->logo_path)->not->toBeNull();
    expect($settings->favicon_path)->not->toBeNull();

    Storage::disk('public')->assertExists($settings->logo_path);
    Storage::disk('public')->assertExists($settings->favicon_path);
});

test('super admin can remove uploaded system logo and favicon', function () {
    $logo = UploadedFile::fake()->image('logo.png');
    $settings = SystemSetting::current();
    $path = $logo->store('branding', 'public');
    $settings->update(['logo_path' => $path]);

    Storage::disk('public')->assertExists($path);

    $response = $this->actingAs($this->superAdmin)
        ->post('/admin/settings', [
            'company_name' => $settings->company_name,
            'tagline' => $settings->tagline,
            'primary_color' => $settings->primary_color,
            'accent_color' => $settings->accent_color,
            'theme_palette' => $settings->theme_palette,
            'remove_logo' => true,
        ]);

    $response->assertRedirect('/admin/settings');
    $settings->refresh();

    expect($settings->logo_path)->toBeNull();
    Storage::disk('public')->assertMissing($path);
});
