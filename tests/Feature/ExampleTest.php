<?php

declare(strict_types=1);

use App\Models\User;

test('unauthenticated users are redirected from home to login', function () {
    $response = $this->get('/');

    $response->assertRedirect('/login');
});

test('authenticated users are redirected from home to products', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get('/');

    $response->assertRedirect('/products');
});
