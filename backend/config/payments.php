<?php

use App\Payments\SandboxGateway;

return [
    // Unpaid online orders are cancelled and their stock released after this many minutes.
    'online_timeout_minutes' => (int) env('PAYMENT_ONLINE_TIMEOUT_MINUTES', 30),

    // Webhooks signed longer ago than this are refused (replay protection).
    'webhook_tolerance_seconds' => 300,

    /*
     * Online gateways offered at checkout besides Cash on Delivery.
     * "sandbox" is built in: no account, no real money. It sends signed webhooks exactly like a real
     * provider would, so the same webhook code path runs. Add a real gateway (e.g. PayMongo or Xendit
     * in test mode) by implementing App\Payments\PaymentGateway and registering it here.
     */
    'gateways' => [
        'sandbox' => [
            'driver' => SandboxGateway::class,
            'enabled' => (bool) env('PAYMENT_SANDBOX_ENABLED', env('APP_ENV') !== 'production'),
            'label' => 'Online payment (sandbox)',
            'description' => 'Test card or e-wallet flow. No real money is charged.',
            'webhook_secret' => env('PAYMENT_SANDBOX_WEBHOOK_SECRET') ?: env('APP_KEY'),
        ],
    ],
];
