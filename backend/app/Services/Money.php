<?php

namespace App\Services;

/**
 * Tiny helper so money math is done in integer centavos, never floats.
 */
final class Money
{
    public static function toCents(string|int|float $amount): int
    {
        return (int) round(((float) $amount) * 100);
    }

    public static function fromCents(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }

    /** Percentage of an amount, rounded half-up to the centavo. */
    public static function percentOf(int $cents, float $rate): int
    {
        return (int) round($cents * $rate / 100);
    }
}
