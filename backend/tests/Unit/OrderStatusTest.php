<?php

namespace Tests\Unit;

use App\Enums\OrderStatus;
use App\Enums\SellerOrderStatus as S;
use PHPUnit\Framework\TestCase;

class OrderStatusTest extends TestCase
{
    public function test_parent_status_is_derived_from_seller_orders(): void
    {
        $this->assertSame(OrderStatus::Pending, OrderStatus::fromSellerOrders([S::Pending, S::Pending]));
        $this->assertSame(OrderStatus::Processing, OrderStatus::fromSellerOrders([S::Confirmed, S::Pending]));
        $this->assertSame(OrderStatus::PartiallyShipped, OrderStatus::fromSellerOrders([S::Shipped, S::Packed]));
        $this->assertSame(OrderStatus::Shipped, OrderStatus::fromSellerOrders([S::Shipped, S::Delivered]));
        $this->assertSame(OrderStatus::Completed, OrderStatus::fromSellerOrders([S::Delivered, S::Cancelled]));
        $this->assertSame(OrderStatus::Cancelled, OrderStatus::fromSellerOrders([S::Cancelled, S::Cancelled]));
    }

    public function test_transitions_are_one_way(): void
    {
        $this->assertTrue(S::Pending->canTransitionTo(S::Confirmed));
        $this->assertFalse(S::Pending->canTransitionTo(S::Shipped));
        $this->assertFalse(S::Shipped->canTransitionTo(S::Cancelled));
        $this->assertFalse(S::Delivered->canTransitionTo(S::Pending));
    }
}
