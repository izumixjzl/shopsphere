<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OrderStatus;
use App\Enums\SellerOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\SellerOrder;
use App\Services\SellerOrderService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function __construct(private SellerOrderService $sellerOrders) {}

    public function index(Request $request)
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(OrderStatus::class)],
            'q' => ['nullable', 'string', 'max:60'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $orders = Order::query()
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w
                ->where('order_number', 'like', "%{$t}%")
                ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$t}%")->orWhere('email', 'like', "%{$t}%"))))
            ->when($filters['from'] ?? null, fn ($q, $d) => $q->whereDate('placed_at', '>=', $d))
            ->when($filters['to'] ?? null, fn ($q, $d) => $q->whereDate('placed_at', '<=', $d))
            ->with('customer')
            ->withCount('sellerOrders')
            ->latest('placed_at')->paginate(20)->withQueryString();

        return OrderResource::collection($orders);
    }

    public function show(Order $order): OrderResource
    {
        return new OrderResource($order->load([
            'customer', 'sellerOrders.items', 'sellerOrders.seller.sellerProfile', 'sellerOrders.shipment', 'payments',
        ]));
    }

    /** Admin override for a stuck seller order (same transition rules apply). */
    public function updateSellerOrder(Request $request, SellerOrder $sellerOrder): OrderResource
    {
        $data = $request->validate([
            'status' => ['required', Rule::enum(SellerOrderStatus::class)],
            'courier' => ['nullable', 'string', 'max:60'],
            'tracking_number' => ['nullable', 'string', 'max:100'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $this->sellerOrders->transition($sellerOrder, SellerOrderStatus::from($data['status']),
            array_filter(collect($data)->except('status')->all(), fn ($v) => $v !== null));

        return $this->show(Order::findOrFail($sellerOrder->order_id));
    }
}
