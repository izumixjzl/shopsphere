<?php

namespace App\Services;

/** The marketplace courier list (config/marketplace.php) and turning seller input into a clean code + name. */
class Couriers
{
    public const OTHER = 'other';

    /** @return array<string, string> code => display name */
    public static function all(): array
    {
        return array_map(fn ($c) => $c['name'], config('marketplace.couriers'));
    }

    public static function codes(): array
    {
        return [...array_keys(config('marketplace.couriers')), self::OTHER];
    }

    /**
     * A known code wins; "other" keeps the typed name. With no code, a typed name is matched
     * against names and aliases so "J&T" or "lbc" still land on the right courier.
     *
     * @return array{0: ?string, 1: ?string} [code, name]
     */
    public static function resolve(?string $code, ?string $name): array
    {
        $name = filled($name) ? trim($name) : null;
        $list = config('marketplace.couriers');

        if ($code && isset($list[$code])) {
            return [$code, $list[$code]['name']];
        }
        if (! $name) {
            return [null, null];
        }

        $needle = strtolower($name);
        foreach ($list as $key => $courier) {
            if ($needle === strtolower($courier['name']) || in_array($needle, $courier['aliases'], true)) {
                return [$key, $courier['name']];
            }
        }

        return [self::OTHER, $name];
    }
}
