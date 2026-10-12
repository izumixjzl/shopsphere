<?php

namespace App\Enums;

enum OrderStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case PartiallyShipped = 'partially_shipped';
    case Shipped = 'shipped';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    /**
     * Derive the parent order status from its seller orders.
     *
     * @param  array<SellerOrderStatus>  $children
     */
    public static function fromSellerOrders(array $children): self
    {
        $active = array_values(array_filter($children, fn ($s) => $s !== SellerOrderStatus::Cancelled));

        if ($active === []) {
            return self::Cancelled;
        }

        $done = fn ($s) => in_array($s, [SellerOrderStatus::Delivered, SellerOrderStatus::Returned], true);
        $shippedOrDone = fn ($s) => $s === SellerOrderStatus::Shipped || $done($s);

        if (count(array_filter($active, $done)) === count($active)) {
            return self::Completed;
        }
        if (count(array_filter($active, $shippedOrDone)) === count($active)) {
            return self::Shipped;
        }
        if (count(array_filter($active, $shippedOrDone)) > 0) {
            return self::PartiallyShipped;
        }
        if (count(array_filter($active, fn ($s) => $s !== SellerOrderStatus::Pending)) > 0) {
            return self::Processing;
        }

        return self::Pending;
    }
}
