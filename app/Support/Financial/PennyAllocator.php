<?php

declare(strict_types=1);

namespace App\Support\Financial;

use InvalidArgumentException;

final class PennyAllocator
{
    /**
     * Allocates an exact integer of cents across proportional weights without losing or gaining a cent.
     * Enforces Martin Fowler's Largest Remainder Method (Hare-Niemeyer Algorithm).
     *
     * Invariant: array_sum(return) === $totalCents
     *
     * @param  int  $totalCents  Total integer amount in minor units (cents)
     * @param  array<int|string, int>  $weights  Proportional integer weights (e.g. line subtotals in cents)
     * @return array<int|string, int> Allocated cents keyed identical to $weights
     */
    public static function allocate(int $totalCents, array $weights): array
    {
        if (empty($weights)) {
            return [];
        }

        $sumWeights = array_sum($weights);
        if ($sumWeights === 0) {
            throw new InvalidArgumentException('Sum of allocation weights cannot be zero.');
        }

        $allocated = [];
        $remainders = [];
        $currentSum = 0;

        foreach ($weights as $key => $weight) {
            if ($weight < 0) {
                throw new InvalidArgumentException("Allocation weight cannot be negative: {$weight}");
            }

            // Integer floor division for base share
            $share = intdiv($totalCents * $weight, $sumWeights);
            $allocated[$key] = $share;
            $currentSum += $share;

            // Fractional remainder for deterministic tie-breaking
            $remainders[$key] = ($totalCents * $weight) % $sumWeights;
        }

        $remainderCents = $totalCents - $currentSum;

        // Sort keys by highest fractional remainder descending
        arsort($remainders, SORT_NUMERIC);

        // Distribute remaining cents one-by-one to highest remainders
        foreach (array_keys($remainders) as $key) {
            if ($remainderCents <= 0) {
                break;
            }
            $allocated[$key]++;
            $remainderCents--;
        }

        return $allocated;
    }
}
