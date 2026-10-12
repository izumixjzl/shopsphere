<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\SellerOrderStatus;
use App\Models\Address;
use App\Models\Cart;
use App\Models\CommissionRecord;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\SellerOrder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Turns a customer's cart into:
 *   1 parent order  ->  N seller orders (one per seller)  ->  order items
 * plus a pending COD payment and a pending commission record per seller order,
 * all inside one transaction with inventory rows locked.
 */
class CheckoutService
{
    public function __construct(
        private InventoryService $inventory,
        private NotificationService $notifications,
        private AuditLogger $audit,
    ) {}

    public function checkout(User $customer, Address $address, ?string $notes = null): Order
    {
        if ($address->user_id !== $customer->id) {
            throw ValidationException::withMessages(['address_id' => 'Invalid address.']);
        }

        $order = DB::transaction(function () use ($customer, $address, $notes) {
            /** @var Cart|null $cart */
            $cart = Cart::query()->where('user_id', $customer->id)->lockForUpdate()->first();
            $items = $cart?->items()->with(['product.seller.sellerProfile', 'product.primaryImage'])->get() ?? collect();

            if ($items->isEmpty()) {
                throw ValidationException::withMessages(['cart' => 'Your cart is empty.']);
            }

            foreach ($items as $item) {
                if (! $item->product || ! $item->product->isPurchasable()) {
                    $name = $item->product->name ?? 'An item';
                    throw ValidationException::withMessages(['cart' => "{$name} is no longer available. Please remove it from your cart."]);
                }
                if ($item->product->seller_id === $customer->id) {
                    throw ValidationException::withMessages(['cart' => 'You cannot buy your own products.']);
                }
            }

            // Lock every affected inventory row, then deduct.
            $locked = $this->inventory->lockForProducts($items->pluck('product_id')->all());
            foreach ($items as $item) {
                $inv = $locked->get($item->product_id);
                if (! $inv) {
                    throw ValidationException::withMessages(['cart' => "{$item->product->name} has no stock record."]);
                }
                $this->inventory->deduct($inv, $item->quantity, $item->product->name);
            }

            $bySeller = $items->groupBy(fn ($i) => $i->product->seller_id);
            $shippingCents = Money::toCents(config('marketplace.shipping_fee_per_seller'));

            $subtotalCents = $items->sum(fn ($i) => Money::toCents($i->product->price) * $i->quantity);
            $shippingTotalCents = $shippingCents * $bySeller->count();

            $order = Order::create([
                'order_number' => $this->newOrderNumber(),
                'user_id' => $customer->id,
                'status' => OrderStatus::Pending,
                'payment_method' => 'cod',
                'payment_status' => 'unpaid',
                'subtotal' => Money::fromCents($subtotalCents),
                'shipping_total' => Money::fromCents($shippingTotalCents),
                'grand_total' => Money::fromCents($subtotalCents + $shippingTotalCents),
                'shipping_address' => $address->toSnapshot(),
                'notes' => $notes,
                'placed_at' => now(),
            ]);

            $n = 0;
            foreach ($bySeller as $sellerId => $sellerItems) {
                $n++;
                $seller = $sellerItems->first()->product->seller;
                $rate = $seller->sellerProfile->effectiveCommissionRate();

                $sellerSubtotal = $sellerItems->sum(fn ($i) => Money::toCents($i->product->price) * $i->quantity);
                // Commission is taken on merchandise only; shipping goes to the seller.
                $commission = Money::percentOf($sellerSubtotal, $rate);
                $earnings = $sellerSubtotal + $shippingCents - $commission;

                $sellerOrder = SellerOrder::create([
                    'order_id' => $order->id,
                    'seller_id' => $sellerId,
                    'reference' => $order->order_number.'-'.$n,
                    'status' => SellerOrderStatus::Pending,
                    'subtotal' => Money::fromCents($sellerSubtotal),
                    'shipping_fee' => Money::fromCents($shippingCents),
                    'commission_rate' => $rate,
                    'commission_amount' => Money::fromCents($commission),
                    'seller_earnings' => Money::fromCents($earnings),
                ]);

                foreach ($sellerItems as $item) {
                    $p = $item->product;
                    $unit = Money::toCents($p->price);
                    OrderItem::create([
                        'order_id' => $order->id,
                        'seller_order_id' => $sellerOrder->id,
                        'product_id' => $p->id,
                        'seller_id' => $sellerId,
                        'product_name' => $p->name,          // snapshot
                        'product_sku' => $p->sku,            // snapshot
                        'product_image_url' => $p->primaryImage?->url,
                        'unit_price' => Money::fromCents($unit), // snapshot
                        'quantity' => $item->quantity,
                        'line_total' => Money::fromCents($unit * $item->quantity),
                    ]);
                    $p->increment('sales_count', $item->quantity);
                }

                CommissionRecord::create([
                    'seller_order_id' => $sellerOrder->id,
                    'seller_id' => $sellerId,
                    'gross_amount' => Money::fromCents($sellerSubtotal),
                    'commission_rate' => $rate,
                    'commission_amount' => Money::fromCents($commission),
                    'net_amount' => Money::fromCents($earnings),
                    'status' => 'pending',
                ]);
            }

            Payment::create([
                'order_id' => $order->id,
                'method' => 'cod',
                'amount' => $order->grand_total,
                'status' => 'pending',
            ]);

            $cart->items()->delete();

            return $order;
        }, attempts: 3); // retry on deadlock

        $this->afterCheckout($order);

        return $order->load(['sellerOrders.items', 'payments']);
    }

    private function afterCheckout(Order $order): void
    {
        $this->audit->log('order.placed', $order, [], [
            'grand_total' => $order->grand_total,
            'seller_orders' => $order->sellerOrders()->count(),
        ]);

        $this->notifications->send(
            $order->user_id, 'order.placed', 'Order placed',
            "Your order {$order->order_number} was placed. Pay ₱{$order->grand_total} on delivery.",
            ['order_id' => $order->id],
        );

        foreach ($order->sellerOrders()->get() as $so) {
            $this->notifications->send(
                $so->seller_id, 'seller_order.new', 'New order',
                "New order {$so->reference} worth ₱{$so->subtotal}.",
                ['seller_order_id' => $so->id],
            );
        }
    }

    private function newOrderNumber(): string
    {
        do {
            $number = 'SS'.now()->format('ymd').strtoupper(Str::random(6));
        } while (Order::where('order_number', $number)->exists());

        return $number;
    }
}
