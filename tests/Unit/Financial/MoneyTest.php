<?php

declare(strict_types=1);

use App\Support\Financial\Money;

test('executes precise addition avoiding binary float drift', function () {
    // 0.10 + 0.20 === 0.30
    $m1 = new Money('0.10', 'PHP');
    $m2 = new Money('0.20', 'PHP');
    $result = $m1->add($m2);

    expect($result->toDecimalString())->toBe('0.30')
        ->and($result->toMinorUnits())->toBe(30);
});

test('multiplies high precision rates and converts to minor units deterministically', function () {
    // 15 units * 12.3456 unit price = 185.184 -> rounded half up = 185.18 (18518 cents)
    $unitPrice = new Money('12.3456', 'PHP');
    $total = $unitPrice->multiply(15);

    expect($total->toDecimalString(4))->toBe('185.1840')
        ->and($total->toMinorUnits())->toBe(18518);
});

test('handles fromCents creation and zero evaluation', function () {
    $money = Money::fromCents(1250, 'PHP');

    expect($money->toDecimalString())->toBe('12.50')
        ->and($money->toMinorUnits())->toBe(1250)
        ->and($money->isZero())->toBeFalse();

    $zero = Money::zero('PHP');
    expect($zero->isZero())->toBeTrue();
});

test('prevents arithmetic on conflicting currencies', function () {
    $php = new Money('100.00', 'PHP');
    $usd = new Money('100.00', 'USD');

    $php->add($usd);
})->throws(InvalidArgumentException::class);
