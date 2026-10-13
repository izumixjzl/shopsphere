<?php

namespace App\Payments;

use Carbon\CarbonInterface;

final readonly class CheckoutSession
{
    public function __construct(
        public string $reference,      // provider's id for this attempt (stored as transaction_reference)
        public string $url,            // where the customer completes payment
        public ?CarbonInterface $expiresAt = null,
    ) {}
}
