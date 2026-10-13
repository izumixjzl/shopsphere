<?php

namespace App\Payments;

final readonly class WebhookEvent
{
    public const PAID = 'paid';
    public const FAILED = 'failed';

    public function __construct(
        public string $id,             // provider's event id: the deduplication key
        public string $type,           // provider's raw event type, kept for the log
        public string $reference,      // matches payments.transaction_reference
        public ?string $outcome,       // PAID, FAILED, or null for events we don't act on
        public int $amountCents,
        public string $currency,
        public ?string $failureReason = null,
        public array $payload = [],
    ) {}
}
