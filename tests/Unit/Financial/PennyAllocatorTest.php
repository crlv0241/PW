<?php

declare(strict_types=1);

use App\Support\Financial\PennyAllocator;

test('allocates odd cents proportionally with zero leakage (Fowler invariant)', function () {
    // 1000 cents split evenly across 3 items: 334, 333, 333
    $allocated = PennyAllocator::allocate(1000, [1, 1, 1]);

    expect(array_sum($allocated))->toBe(1000)
        ->and($allocated)->toBe([334, 333, 333]);
});

test('allocates across unequal weights with exact total sum conservation', function () {
    $total = 10000; // 100.00
    $weights = [
        'item_a' => 1250,
        'item_b' => 3750,
        'item_c' => 5000,
    ];

    $allocated = PennyAllocator::allocate($total, $weights);

    expect(array_sum($allocated))->toBe($total)
        ->and($allocated['item_a'])->toBe(1250)
        ->and($allocated['item_b'])->toBe(3750)
        ->and($allocated['item_c'])->toBe(5000);
});

test('handles complex discount distribution without losing a single cent', function () {
    $discountCents = 1537; // 15.37 discount
    $weights = [
        'line_1' => 1999,
        'line_2' => 3499,
        'line_3' => 899,
        'line_4' => 4500,
    ];

    $allocated = PennyAllocator::allocate($discountCents, $weights);

    expect(array_sum($allocated))->toBe($discountCents);
});

test('throws exception when weights sum to zero', function () {
    PennyAllocator::allocate(100, [0, 0, 0]);
})->throws(InvalidArgumentException::class);
