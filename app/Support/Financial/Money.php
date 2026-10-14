<?php

declare(strict_types=1);

namespace App\Support\Financial;

use BcMath\Number;
use InvalidArgumentException;
use RoundingMode;

final class Money
{
    private Number $amount;

    private string $currency;

    /**
     * @param  int|numeric-string|Number  $amount
     */
    public function __construct(int|string|Number $amount, string $currency = 'PHP')
    {
        $this->amount = $amount instanceof Number ? $amount : new Number($amount);
        $this->currency = strtoupper($currency);
    }

    public static function fromCents(int $cents, string $currency = 'PHP'): self
    {
        $amount = (new Number((string) $cents))->div(new Number('100'), 4);

        return new self($amount, $currency);
    }

    public static function zero(string $currency = 'PHP'): self
    {
        return new self('0', $currency);
    }

    public function getCurrency(): string
    {
        return $this->currency;
    }

    public function getAmount(): Number
    {
        return $this->amount;
    }

    public function add(self $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->amount + $other->amount, $this->currency);
    }

    public function subtract(self $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->amount - $other->amount, $this->currency);
    }

    /**
     * @param  int|numeric-string|Number  $factor
     */
    public function multiply(int|string|Number $factor): self
    {
        $multiplier = $factor instanceof Number ? $factor : new Number($factor);

        return new self($this->amount * $multiplier, $this->currency);
    }

    /**
     * @param  int|numeric-string|Number  $divisor
     */
    public function divide(int|string|Number $divisor, int $scale = 4): self
    {
        $div = $divisor instanceof Number ? $divisor : new Number($divisor);

        return new self($this->amount->div($div, $scale), $this->currency);
    }

    public function round(int $scale = 2, RoundingMode $mode = RoundingMode::HalfAwayFromZero): self
    {
        return new self($this->amount->round($scale, $mode), $this->currency);
    }

    public function toMinorUnits(): int
    {
        $rounded = $this->amount->round(2, RoundingMode::HalfAwayFromZero);

        return (int) (string) ($rounded * new Number('100'));
    }

    public function toDecimalString(int $scale = 2): string
    {
        $rounded = (string) $this->amount->round($scale, RoundingMode::HalfAwayFromZero);
        if ($scale <= 0) {
            return $rounded;
        }

        $parts = explode('.', $rounded, 2);
        $integerPart = $parts[0];
        $fractionPart = $parts[1] ?? '';

        return $integerPart.'.'.str_pad($fractionPart, $scale, '0');
    }

    public function isNegative(): bool
    {
        return $this->amount < new Number('0');
    }

    public function isZero(): bool
    {
        return $this->amount == new Number('0');
    }

    private function assertSameCurrency(self $other): void
    {
        if ($this->currency !== $other->currency) {
            throw new InvalidArgumentException(
                "Currency mismatch: cannot operate on {$this->currency} and {$other->currency}"
            );
        }
    }
}
