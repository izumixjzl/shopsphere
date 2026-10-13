<?php

namespace App\Payments;

use App\Models\Order;
use App\Models\Payment;
use App\Services\Money;
use Illuminate\Support\Str;

/**
 * Built-in test gateway. The hosted "checkout page" is a page in our own SPA
 * (/sandbox-pay/{reference}); completing it produces a webhook signed the same
 * way Stripe/PayMongo sign theirs: header `t=<unix>,v1=<hmac_sha256("t.body")>`.
 */
class SandboxGateway implements PaymentGateway
{
    public const SIGNATURE_HEADER = 'x-sandbox-signature';

    public function __construct(private string $secret, private int $toleranceSeconds = 300) {}

    public function createCheckout(Payment $payment, Order $order): CheckoutSession
    {
        $reference = 'sbx_'.Str::lower(Str::random(24));

        return new CheckoutSession($reference, '/sandbox-pay/'.$reference, $order->payment_due_at);
    }

    public function parseWebhook(string $payload, array $headers): WebhookEvent
    {
        $parts = [];
        foreach (explode(',', $headers[self::SIGNATURE_HEADER] ?? '') as $pair) {
            [$k, $v] = array_pad(explode('=', trim($pair), 2), 2, '');
            $parts[$k] = $v;
        }
        $timestamp = (int) ($parts['t'] ?? 0);
        $signature = (string) ($parts['v1'] ?? '');

        if (! $timestamp || abs(time() - $timestamp) > $this->toleranceSeconds) {
            throw new InvalidWebhookSignature('Webhook timestamp is missing or outside the allowed window.');
        }
        if (! hash_equals($this->sign($timestamp, $payload), $signature)) {
            throw new InvalidWebhookSignature('Webhook signature does not match.');
        }

        $body = json_decode($payload, true);
        if (! is_array($body) || empty($body['id']) || empty($body['data']['reference'])) {
            throw new InvalidWebhookSignature('Webhook body is malformed.');
        }

        return new WebhookEvent(
            id: (string) $body['id'],
            type: (string) ($body['type'] ?? 'unknown'),
            reference: (string) $body['data']['reference'],
            outcome: match ($body['type'] ?? null) {
                'payment.paid' => WebhookEvent::PAID,
                'payment.failed' => WebhookEvent::FAILED,
                default => null,
            },
            amountCents: (int) ($body['data']['amount'] ?? 0),
            currency: (string) ($body['data']['currency'] ?? ''),
            failureReason: $body['data']['failure_reason'] ?? null,
            payload: $body,
        );
    }

    /**
     * What the sandbox "provider" would POST to us when the customer finishes the test checkout.
     *
     * @return array{0: string, 1: array<string, string>} [raw body, headers]
     */
    public function simulateWebhook(Payment $payment, string $outcome, ?int $amountCents = null): array
    {
        $body = json_encode([
            'id' => 'evt_'.Str::lower(Str::random(24)),
            'type' => $outcome === WebhookEvent::PAID ? 'payment.paid' : 'payment.failed',
            'created' => time(),
            'data' => [
                'reference' => $payment->transaction_reference,
                'amount' => $amountCents ?? Money::toCents($payment->amount),
                'currency' => config('marketplace.currency'),
                'failure_reason' => $outcome === WebhookEvent::PAID ? null : 'Card declined (sandbox)',
            ],
        ]);

        return [$body, $this->headersFor($body)];
    }

    /** @return array<string, string> */
    public function headersFor(string $body, ?int $timestamp = null): array
    {
        $t = $timestamp ?? time();

        return [self::SIGNATURE_HEADER => "t={$t},v1=".$this->sign($t, $body)];
    }

    private function sign(int $timestamp, string $payload): string
    {
        return hash_hmac('sha256', $timestamp.'.'.$payload, $this->secret);
    }
}
