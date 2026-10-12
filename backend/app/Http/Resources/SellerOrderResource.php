<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_id' => $this->order_id,
            'reference' => $this->reference,
            'status' => $this->status->value,
            'allowed_next' => array_map(fn ($s) => $s->value, $this->status->allowedNext()),
            'subtotal' => $this->subtotal,
            'shipping_fee' => $this->shipping_fee,
            'commission_rate' => $this->commission_rate,
            'commission_amount' => $this->commission_amount,
            'seller_earnings' => $this->seller_earnings,
            'confirmed_at' => $this->confirmed_at?->toIso8601String(),
            'shipped_at' => $this->shipped_at?->toIso8601String(),
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'seller' => $this->whenLoaded('seller', fn () => [
                'id' => $this->seller->id,
                'store_name' => $this->seller->sellerProfile?->store_name,
                'store_slug' => $this->seller->sellerProfile?->store_slug,
            ]),
            'order' => $this->whenLoaded('order', fn () => [
                'order_number' => $this->order->order_number,
                'shipping_address' => $this->order->shipping_address,
                'payment_method' => $this->order->payment_method,
                'payment_status' => $this->order->payment_status,
                'customer' => $this->order->relationLoaded('customer') ? $this->order->customer?->only(['id', 'name', 'email']) : null,
                'placed_at' => $this->order->placed_at?->toIso8601String(),
            ]),
            'items' => OrderItemResource::collection($this->whenLoaded('items')),
            'items_count' => $this->whenHas('items_count'),
            'shipment' => $this->whenLoaded('shipment', fn () => $this->shipment?->only([
                'courier', 'tracking_number', 'status', 'tracking_events', 'shipped_at', 'delivered_at',
            ])),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
