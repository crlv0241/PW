<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;

test('login screen can be rendered', function () {
    $response = $this->get('/login');

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/login')
        );
});

test('authenticated user visiting login is redirected away', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get('/login');

    $response->assertRedirect('/');
});

test('users can authenticate using the login screen', function () {
    $user = User::factory()->create([
        'email' => 'operator@poswms.test',
        'password' => Hash::make('Password123!'),
        'is_active' => true,
    ]);

    $response = $this->post('/login', [
        'email' => 'operator@poswms.test',
        'password' => 'Password123!',
        'remember' => true,
    ]);

    $this->assertAuthenticatedAs($user);
    $response->assertRedirect('/products');
});

test('users cannot authenticate with invalid password', function () {
    $user = User::factory()->create([
        'email' => 'operator@poswms.test',
        'password' => Hash::make('Password123!'),
        'is_active' => true,
    ]);

    $response = $this->from('/login')->post('/login', [
        'email' => 'operator@poswms.test',
        'password' => 'WrongPassword!',
    ]);

    $this->assertGuest();
    $response->assertSessionHasErrors('email');
});

test('deactivated users cannot authenticate', function () {
    User::factory()->create([
        'email' => 'deactivated@poswms.test',
        'password' => Hash::make('Password123!'),
        'is_active' => false,
    ]);

    $response = $this->from('/login')->post('/login', [
        'email' => 'deactivated@poswms.test',
        'password' => 'Password123!',
    ]);

    $this->assertGuest();
    $response->assertSessionHasErrors('email');
});

test('users can logout', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/logout');

    $this->assertGuest();
    $response->assertRedirect('/login');
});
