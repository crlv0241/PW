<?php

declare(strict_types=1);

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
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
        'email' => 'root@poswms.test',
        'is_active' => true,
    ]);
    $this->superAdmin->roles()->sync([$this->superAdminRole->id]);

    $this->regularStaff = User::factory()->create([
        'name' => 'Staff Member',
        'email' => 'staff@poswms.test',
        'is_active' => true,
    ]);
    $this->regularStaff->roles()->sync([$this->managerRole->id]);
});

test('unauthenticated users cannot access admin user management', function () {
    $response = $this->get('/admin/users');

    $response->assertRedirect('/login');
});

test('non-super-admin users are forbidden from admin user management', function () {
    $response = $this->actingAs($this->regularStaff)->get('/admin/users');

    $response->assertForbidden();
});

test('super admin can view user management listing with roles and pagination', function () {
    $response = $this->actingAs($this->superAdmin)->get('/admin/users');

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/users/index')
            ->has('users.data')
            ->has('roles')
            ->where('filters.search', '')
            ->where('filters.role', '')
        );
});

test('super admin can search and filter users by role', function () {
    $response = $this->actingAs($this->superAdmin)
        ->get('/admin/users?search=Staff&role=warehouse_manager');

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/users/index')
            ->where('filters.search', 'Staff')
            ->where('filters.role', 'warehouse_manager')
            ->has('users.data', 1)
            ->where('users.data.0.email', 'staff@poswms.test')
        );
});

test('super admin can register a new system user with assigned role', function () {
    $response = $this->actingAs($this->superAdmin)
        ->post('/admin/users', [
            'name' => 'New Scanner Operator',
            'email' => 'new.scanner@poswms.test',
            'password' => 'SecurePass123!',
            'role_id' => $this->managerRole->id,
            'is_active' => true,
        ]);

    $response->assertRedirect('/admin/users');
    $response->assertSessionHas('success');

    $newUser = User::where('email', 'new.scanner@poswms.test')->first();
    expect($newUser)->not->toBeNull();
    expect($newUser->name)->toBe('New Scanner Operator');
    expect($newUser->is_active)->toBeTrue();
    expect(Hash::check('SecurePass123!', $newUser->password))->toBeTrue();
    expect($newUser->roles->pluck('id')->all())->toContain($this->managerRole->id);
});

test('super admin can update user profile and assigned role', function () {
    $response = $this->actingAs($this->superAdmin)
        ->put("/admin/users/{$this->regularStaff->id}", [
            'name' => 'Updated Staff Name',
            'email' => 'updated.staff@poswms.test',
            'role_id' => $this->managerRole->id,
            'is_active' => true,
        ]);

    $response->assertRedirect('/admin/users');
    $response->assertSessionHas('success');

    $this->regularStaff->refresh();
    expect($this->regularStaff->name)->toBe('Updated Staff Name');
    expect($this->regularStaff->email)->toBe('updated.staff@poswms.test');
});

test('super admin can toggle user active status', function () {
    expect($this->regularStaff->is_active)->toBeTrue();

    $response = $this->actingAs($this->superAdmin)
        ->patch("/admin/users/{$this->regularStaff->id}/toggle-active");

    $response->assertRedirect('/admin/users');
    $response->assertSessionHas('success');

    $this->regularStaff->refresh();
    expect($this->regularStaff->is_active)->toBeFalse();

    // Toggle back to active
    $this->actingAs($this->superAdmin)
        ->patch("/admin/users/{$this->regularStaff->id}/toggle-active");

    $this->regularStaff->refresh();
    expect($this->regularStaff->is_active)->toBeTrue();
});

test('super admin cannot deactivate their own administrative account', function () {
    $response = $this->actingAs($this->superAdmin)
        ->patch("/admin/users/{$this->superAdmin->id}/toggle-active");

    $response->assertSessionHas('error');
    $this->superAdmin->refresh();
    expect($this->superAdmin->is_active)->toBeTrue();
});

test('super admin cannot remove their own super admin role', function () {
    $response = $this->actingAs($this->superAdmin)
        ->put("/admin/users/{$this->superAdmin->id}", [
            'name' => 'Root Admin',
            'email' => 'root@poswms.test',
            'role_id' => $this->managerRole->id, // Attempting to demote self
            'is_active' => true,
        ]);

    $response->assertSessionHas('error');
    $this->superAdmin->refresh();
    expect($this->superAdmin->isSuperAdmin())->toBeTrue();
});
