<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\SellerOrderStatus;
use App\Models\Payment;
use App\Models\SellerOrder;
use App\Models\Shipment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Moves seller orders through their lifecycle and keeps everything that hangs
 * off them consistent: shipment tracking, stock, commission, payment, and the
 * parent order status.
 */
class SellerOrderService
{
    private const CUSTOMER_MESSAGES = [
        'confirmed' => 'The seller confirmed your order.',
        'packed' => 'Your items are packed and ready to ship.',
        'shipped' => 'Your items are on the way.',
        'delivered' => 'Your items were delivered.',
        'cancelled' => 'Part of your order was cancelled.',
        'returned' => 'Your return was processed.',
    ];

    public function __construct(
        private InventoryService $inventory,
        private NotificationService $notifications,
        private AuditLogger $audit,
    ) {}

    /**
     * @param  array{courier_code?:string,courier?:string,tracking_number?:string,note?:string,reason?:string}  $details
     */
    public function transition(SellerOrder $sellerOrder, SellerOrderStatus $next, array $details = [], bool $notify = true): SellerOrder
    {
        $old = $sellerOrder->status;

        DB::transaction(function () use ($sellerOrder, $next, &$details) {
            /** @var SellerOrder $so */
            $so = SellerOrder::query()->whereKey($sellerOrder->id)->lockForUpdate()->firstOrFail();

            if (! $so->status->canTransitionTo($next)) {
                throw ValidationException::withMessages([
                    'status' => "Cannot change order from {$so->status->value} to {$next->value}.",
                ]);
            }
            // Online orders: nothing ships before the gateway confirms payment. Cancelling is still allowed.
            if ($next !== SellerOrderStatus::Cancelled) {
                $order = $so->order()->first(['payment_method', 'payment_status']);
                if ($order->payment_method !== 'cod' && $order->payment_status !== 'paid') {
                    throw ValidationException::withMessages(['status' => 'Wait until the customer has paid before processing this order.']);
                }
            }
            if ($next === SellerOrderStatus::Shipped) {
                [$code, $name] = Couriers::resolve($details['courier_code'] ?? null, $details['courier'] ?? null);
                if (! $name) {
                    throw ValidationException::withMessages(['courier' => ($details['courier_code'] ?? null) === Couriers::OTHER
                        ? 'Enter the courier name.' : 'Courier is required when shipping.']);
                }
                $details['courier_code'] = $code;
                $details['courier'] = $name;
            }

            $so->status = $next;
            match ($next) {
                SellerOrderStatus::Confirmed => $so->confirmed_at = now(),
                SellerOrderStatus::Shipped => $so->shipped_at = now(),
                SellerOrderStatus::Delivered => $so->delivered_at = now(),
                SellerOrderStatus::Cancelled => [$so->cancelled_at = now(), $so->cancel_reason = $details['reason'] ?? null],
                default => null,
            };
            $so->save();

            $this->syncShipment($so, $next, $details);

            // Stock goes back on cancellation / return.
            if (in_array($next, [SellerOrderStatus::Cancelled, SellerOrderStatus::Returned], true)) {
                foreach ($so->items()->get() as $item) {
                    if ($item->product_id) {
                        $this->inventory->restock($item->product_id, $item->quantity);
                    }
                }
            }

            // Commission lifecycle.
            $commission = $so->commissionRecord()->first();
            if ($commission) {
                if ($next === SellerOrderStatus::Delivered && $commission->status === 'pending') {
                    $commission->update(['status' => 'payable']);
                } elseif (in_array($next, [SellerOrderStatus::Cancelled, SellerOrderStatus::Returned], true) && $commission->status !== 'paid') {
                    $commission->update(['status' => 'reversed']);
                }
            }

            $order = $so->order()->first();
            $order->syncStatus();
            $order->payment_method === 'cod'
                ? $this->syncPayment($order->fresh())
                : $this->syncOnlinePayment($order->fresh(), $so, $next);
        });

        $sellerOrder->refresh();

        $this->audit->log('seller_order.status_changed', $sellerOrder, ['status' => $old->value], ['status' => $next->value] + $details);

        if (! $notify) {
            return $sellerOrder;
        }

        $this->notifications->send(
            (int) $sellerOrder->order()->value('user_id'),
            'order.'.$next->value,
            'Order '.$sellerOrder->reference.' '.str_replace('_', ' ', $next->value),
            self::CUSTOMER_MESSAGES[$next->value] ?? 'Your order was updated.',
            ['order_id' => $sellerOrder->order_id, 'seller_order_id' => $sellerOrder->id],
        );

        return $sellerOrder;
    }

    private function syncShipment(SellerOrder $so, SellerOrderStatus $next, array $details): void
    {
        $shipment = $so->shipment()->first();

        if (! $shipment && ! in_array($next, [SellerOrderStatus::Packed, SellerOrderStatus::Shipped], true)) {
            return;
        }

        $shipment ??= new Shipment(['tracking_events' => []]);
        $shipment->seller_order_id = $so->id;

        match ($next) {
            SellerOrderStatus::Packed => $shipment->addEvent('pending', $details['note'] ?? 'Parcel packed by seller'),
            SellerOrderStatus::Shipped => (function () use ($shipment, $details) {
                $shipment->courier_code = $details['courier_code'];
                $shipment->courier = $details['courier'];
                $shipment->tracking_number = $details['tracking_number'] ?? null;
                $shipment->shipped_at = now();
                $shipment->addEvent('in_transit', $details['note'] ?? "Handed to {$details['courier']}");
            })(),
            SellerOrderStatus::Delivered => (function () use ($shipment, $details) {
                $shipment->delivered_at = now();
                $shipment->addEvent('delivered', $details['note'] ?? 'Delivered to customer');
            })(),
            SellerOrderStatus::Cancelled => $shipment->addEvent('failed', 'Shipment cancelled'),
            default => null,
        };

        $shipment->save();
    }

    /** COD: the order counts as paid once every non-cancelled part is delivered. */
    private function syncPayment($order): void
    {
        $payment = Payment::query()->where('order_id', $order->id)->where('method', 'cod')->lockForUpdate()->first();
        if (! $payment) {
            return;
        }

        if ($order->status === OrderStatus::Completed && $payment->status === 'pending') {
            $collected = $order->sellerOrders()->whereIn('status', ['delivered', 'returned'])
                ->get()->sum(fn ($so) => Money::toCents($so->subtotal) + Money::toCents($so->shipping_fee));

            $payment->update([
                'status' => 'paid',
                'amount' => Money::fromCents($collected),
                'paid_at' => now(),
                'transaction_reference' => 'COD-'.$order->order_number,
                'meta' => ['simulated' => true, 'note' => 'Cash collected on delivery'],
            ]);
            $order->update(['payment_status' => 'paid']);
        } elseif ($order->status === OrderStatus::Cancelled && $payment->status === 'pending') {
            $payment->update(['status' => 'failed', 'meta' => ['note' => 'Order cancelled before delivery']]);
        }
    }

    /**
     * Online orders when a seller order is cancelled:
     *  - unpaid: open attempts for the old total are closed so the customer pays the new total;
     *  - paid: the cancelled part was already charged, so admins are told to refund it.
     */
    private function syncOnlinePayment($order, SellerOrder $so, SellerOrderStatus $next): void
    {
        if ($next !== SellerOrderStatus::Cancelled) {
            return;
        }

        if ($order->payment_status === 'unpaid') {
            $payable = $order->payableAmount();
            $order->payments()->where('status', 'pending')->where('amount', '!=', $payable)->update([
                'status' => 'cancelled',
                'failure_reason' => $order->status === OrderStatus::Cancelled ? 'Order cancelled.' : 'Order total changed.',
            ]);

            return;
        }

        $amount = Money::fromCents(Money::toCents($so->subtotal) + Money::toCents($so->shipping_fee));
        $this->audit->log('payment.needs_refund', $so, [], ['amount' => $amount]);
        $this->notifications->sendToAdmins('payment.needs_refund', 'Refund needed',
            "{$so->reference} was cancelled after the customer paid online. Refund ₱{$amount} for order {$order->order_number}.",
            ['order_id' => $order->id]);
    }
}
