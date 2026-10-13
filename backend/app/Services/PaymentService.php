<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\SellerOrderStatus;
use App\Models\Order;
use App\Models\Payment;
use App\Models\WebhookLog;
use App\Payments\GatewayRegistry;
use App\Payments\WebhookEvent;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Online payment lifecycle. Every attempt is its own `payments` row:
 *
 *   pending ──webhook paid──▶ paid
 *      ├────webhook failed──▶ failed     (customer may start a new attempt)
 *      ├────order expired───▶ expired
 *      └────order cancelled─▶ cancelled
 *
 * Only webhooks can mark an attempt paid: never the browser redirect, which a customer could fake.
 */
class PaymentService
{
    public function __construct(
        private GatewayRegistry $gateways,
        private SellerOrderService $sellerOrders,
        private NotificationService $notifications,
        private AuditLogger $audit,
    ) {}

    /**
     * Returns a payable attempt for an unpaid online order, reusing one that is still open
     * so a double-clicked "Pay now" never opens two charges.
     */
    public function startAttempt(Order $order): Payment
    {
        $payment = DB::transaction(function () use ($order) {
            $order = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();

            if ($order->payment_method === 'cod') {
                throw ValidationException::withMessages(['payment' => 'This order is paid in cash on delivery.']);
            }
            if ($order->payment_status !== 'unpaid' || $order->status === OrderStatus::Cancelled) {
                throw ValidationException::withMessages(['payment' => 'This order no longer needs payment.']);
            }
            if ($order->payment_due_at?->isPast()) {
                throw ValidationException::withMessages(['payment' => 'The payment window for this order has closed.']);
            }

            $open = $order->payments()->where('status', 'pending')->latest('id')->first();
            if ($open && $open->checkout_url) {
                return $open;
            }

            return $open ?? $order->payments()->create([
                'method' => $order->payment_method,
                'provider' => $order->payment_method,
                'amount' => $order->payableAmount(),
                'status' => 'pending',
            ]);
        });

        if ($payment->checkout_url) {
            return $payment;
        }

        // The gateway call happens outside the transaction: a slow provider must not hold row locks.
        try {
            $session = $this->gateways->get($payment->provider)->createCheckout($payment, $order->fresh());
            $payment->update([
                'transaction_reference' => $session->reference,
                'checkout_url' => $session->url,
                'expires_at' => $session->expiresAt,
            ]);
        } catch (Throwable $e) {
            report($e);
            $payment->update(['status' => 'failed', 'failure_reason' => 'Could not reach the payment provider. Please try again.']);
        }

        return $payment->fresh();
    }

    /**
     * Apply a verified webhook exactly once. Returns what happened, for the log and the HTTP reply.
     * Safe against redelivery (same event id), out-of-order events, wrong amounts and payments
     * that arrive after the order already expired.
     */
    public function handleWebhook(string $provider, WebhookEvent $event): string
    {
        try {
            $log = WebhookLog::create([
                'provider' => $provider,
                'event_id' => $event->id,
                'type' => $event->type,
                'status' => 'received',
                'payload' => $event->payload,
            ]);
        } catch (UniqueConstraintViolationException) {
            return 'duplicate';
        }

        try {
            [$status, $note, $after] = $this->applyWebhook($provider, $event, $log);
        } catch (Throwable $e) {
            // Forget the event so the provider's retry is processed instead of skipped as a duplicate.
            $log->delete();
            throw $e;
        }

        $log->forceFill(['status' => $status, 'note' => $note, 'processed_at' => now()])->save();

        if ($after) {
            $this->afterWebhook($after, Payment::with('order')->find($log->payment_id), $note);
        }

        return $status;
    }

    /** @return array{0: string, 1: string, 2: ?string} [log status, note, follow-up] */
    private function applyWebhook(string $provider, WebhookEvent $event, WebhookLog $log): array
    {
        return DB::transaction(function () use ($provider, $event, $log) {
            $payment = Payment::where('provider', $provider)->where('transaction_reference', $event->reference)
                ->lockForUpdate()->first();
            $log->payment_id = $payment?->id;

            if (! $payment) {
                return ['ignored', 'No payment with this reference.', null];
            }
            if ($event->outcome === null) {
                return ['ignored', "Event type {$event->type} is not handled.", null];
            }
            if ($event->amountCents !== Money::toCents($payment->amount) || strcasecmp($event->currency, config('marketplace.currency')) !== 0) {
                return ['rejected', "Amount mismatch: got {$event->amountCents} {$event->currency}, expected ".Money::toCents($payment->amount), 'mismatch'];
            }

            $order = Order::whereKey($payment->order_id)->lockForUpdate()->first();

            if ($event->outcome === WebhookEvent::FAILED) {
                if ($payment->status !== 'pending') {
                    return ['ignored', "Payment is already {$payment->status}.", null];
                }
                $payment->update(['status' => 'failed', 'failure_reason' => $event->failureReason ?: 'Payment was declined.']);

                return ['processed', 'Payment failed.', 'failed'];
            }

            // PAID
            if ($payment->status === 'paid') {
                return ['ignored', 'Payment is already paid.', null];
            }
            $payment->update([
                'status' => 'paid',
                'paid_at' => now(),
                'failure_reason' => null,
                'meta' => array_merge($payment->meta ?? [], ['webhook_event' => $event->id]),
            ]);

            // Money arrived but the order is gone (expired/cancelled) or was already paid by another attempt.
            if ($order->status === OrderStatus::Cancelled || $order->payment_status !== 'unpaid') {
                $payment->update(['meta' => array_merge($payment->meta ?? [], ['needs_refund' => true])]);

                return ['processed', 'Paid, but the order was already cancelled or paid. Refund needed.', 'needs_refund'];
            }

            $order->update(['payment_status' => 'paid', 'payment_due_at' => null]);
            // Close any other open attempt so it can't be charged too.
            $order->payments()->whereKeyNot($payment->id)->where('status', 'pending')
                ->update(['status' => 'cancelled', 'failure_reason' => 'Another attempt was paid.']);

            return ['processed', 'Payment captured.', 'paid'];
        });
    }

    /** Cancel online orders whose payment window passed; their stock goes back on sale. */
    public function expireUnpaidOrders(): int
    {
        $expired = 0;

        Order::query()
            ->where('payment_method', '!=', 'cod')
            ->where('payment_status', 'unpaid')
            ->where('status', OrderStatus::Pending)
            ->where('payment_due_at', '<', now())
            ->pluck('id')
            ->each(function ($orderId) use (&$expired) {
                $didExpire = DB::transaction(function () use ($orderId) {
                    $order = Order::whereKey($orderId)->lockForUpdate()->first();
                    // Re-check under the lock: a webhook may have paid it a moment ago.
                    if (! $order || $order->payment_status !== 'unpaid' || $order->status !== OrderStatus::Pending) {
                        return false;
                    }

                    $order->payments()->where('status', 'pending')
                        ->update(['status' => 'expired', 'failure_reason' => 'Payment window closed.']);

                    foreach ($order->sellerOrders()->where('status', SellerOrderStatus::Pending)->get() as $so) {
                        $this->sellerOrders->transition($so, SellerOrderStatus::Cancelled, ['reason' => 'Payment not completed in time'], notify: false);
                    }

                    return true;
                });

                if ($didExpire) {
                    $expired++;
                    $order = Order::find($orderId);
                    $this->audit->log('order.payment_expired', $order);
                    $this->notifications->send($order->user_id, 'order.payment_expired', 'Order cancelled',
                        "We didn't receive payment for {$order->order_number} in time, so it was cancelled.", ['order_id' => $order->id]);
                }
            });

        return $expired;
    }

    private function afterWebhook(string $what, Payment $payment, string $note): void
    {
        $order = $payment->order;
        $this->audit->log('payment.'.$what, $payment, [], ['order_id' => $order->id, 'note' => $note]);

        match ($what) {
            'paid' => $this->paid($order),
            'failed' => $this->notifications->send($order->user_id, 'order.payment_failed', 'Payment failed',
                "Your payment for {$order->order_number} didn't go through ({$payment->failure_reason}). You can try again from your order page.",
                ['order_id' => $order->id]),
            'needs_refund' => $this->notifications->sendToAdmins('payment.needs_refund', 'Refund needed',
                "₱{$payment->amount} was received for {$order->order_number}, which was already cancelled or paid. Refund reference {$payment->transaction_reference}.",
                ['order_id' => $order->id]),
            'mismatch' => $this->notifications->sendToAdmins('payment.amount_mismatch', 'Payment amount mismatch',
                "A webhook for {$order->order_number} reported a different amount and was rejected. Check reference {$payment->transaction_reference}.",
                ['order_id' => $order->id]),
        };
    }

    /** Sellers hear about an online order only once it is actually paid. */
    private function paid(Order $order): void
    {
        $this->notifications->send($order->user_id, 'order.paid', 'Payment received',
            "We received ₱{$order->grand_total} for {$order->order_number}. The sellers will now prepare your items.",
            ['order_id' => $order->id]);

        foreach ($order->sellerOrders()->get() as $so) {
            $this->notifications->send($so->seller_id, 'seller_order.new', 'New paid order',
                "New order {$so->reference} worth ₱{$so->subtotal} has been paid. You can confirm it now.",
                ['seller_order_id' => $so->id]);
        }
    }
}
