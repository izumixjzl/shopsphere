<?php

namespace App\Payments;

use App\Models\Order;
use App\Models\Payment;

/**
 * What every payment provider adapter must do. The rest of the app (checkout, webhooks,
 * expiry) only talks to this interface, so a real gateway drops in without touching it.
 */
interface PaymentGateway
{
    /**
     * Open a hosted checkout for this attempt. Called outside any DB transaction
     * because real gateways make a network call here.
     */
    public function createCheckout(Payment $payment, Order $order): CheckoutSession;

    /**
     * Verify the signature of a raw webhook body and turn it into a normalised event.
     *
     * @param  array<string, string>  $headers  lower-cased header names
     *
     * @throws InvalidWebhookSignature
     */
    public function parseWebhook(string $payload, array $headers): WebhookEvent;
}
