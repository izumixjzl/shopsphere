<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_number' => $this->order_number,
            'status' => $this->status->value,
            'payment_method' => $this->payment_method,
            'payment_status' => $this->payment_status,
            'subtotal' => $this->subtotal,
            'shipping_total' => $this->shipping_total,
            'grand_total' => $this->grand_total,
            'shipping_address' => $this->shipping_address,
            'notes' => $this->notes,
            'placed_at' => $this->placed_at?->toIso8601String(),
            'customer' => $this->whenLoaded('customer', fn () => $this->customer?->only(['id', 'name', 'email'])),
            'seller_orders' => SellerOrderResource::collection($this->whenLoaded('sellerOrders')),
            'seller_orders_count' => $this->whenHas('seller_orders_count'),
            'payment_due_at' => $this->payment_due_at?->toIso8601String(),
            // Every attempt, newest first; checkout_url only while the attempt can still be paid.
            'payments' => $this->whenLoaded('payments', fn () => $this->payments->sortByDesc('id')->values()->map(fn ($p) => [
                'id' => $p->id,
                'method' => $p->method,
                'provider' => $p->provider,
                'amount' => $p->amount,
                'status' => $p->status,
                'transaction_reference' => $p->transaction_reference,
                'failure_reason' => $p->failure_reason,
                'checkout_url' => $p->status === 'pending' ? $p->checkout_url : null,
                'needs_refund' => (bool) ($p->meta['needs_refund'] ?? false),
                'paid_at' => $p->paid_at?->toIso8601String(),
                'created_at' => $p->created_at?->toIso8601String(),
            ])),
            'can_cancel' => $this->whenLoaded('sellerOrders', fn () => $this->sellerOrders->every(fn ($so) => $so->status->value === 'pending')),
        ];
    }
}
