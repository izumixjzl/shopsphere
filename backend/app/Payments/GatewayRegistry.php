<?php

namespace App\Payments;

use Illuminate\Validation\ValidationException;

/** Resolves the gateways configured in config/payments.php. */
class GatewayRegistry
{
    /** @return array<string, array> enabled gateways keyed by code */
    public function enabled(): array
    {
        return array_filter(config('payments.gateways'), fn ($g) => $g['enabled'] ?? false);
    }

    public function isEnabled(string $code): bool
    {
        return array_key_exists($code, $this->enabled());
    }

    public function get(string $code): PaymentGateway
    {
        $config = $this->enabled()[$code]
            ?? throw ValidationException::withMessages(['payment_method' => 'This payment method is not available.']);

        return new $config['driver']((string) $config['webhook_secret'], (int) config('payments.webhook_tolerance_seconds'));
    }

    /** Checkout options shown to customers. Cash on Delivery is always first. */
    public function methods(): array
    {
        return [
            ['code' => 'cod', 'label' => 'Cash on delivery', 'description' => 'Pay each courier when your parcel from that store arrives.', 'online' => false],
            ...collect($this->enabled())->map(fn ($g, $code) => [
                'code' => $code, 'label' => $g['label'], 'description' => $g['description'], 'online' => true,
            ])->values(),
        ];
    }
}
