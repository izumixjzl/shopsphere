<?php

namespace App\Http\Controllers\Seller;

use App\Enums\SellerOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\SellerOrderResource;
use App\Models\SellerOrder;
use App\Services\Couriers;
use App\Services\SellerOrderService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function __construct(private SellerOrderService $service) {}

    public function index(Request $request)
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(SellerOrderStatus::class)],
            'q' => ['nullable', 'string', 'max:60'],
            'per_page' => ['nullable', 'integer', 'between:1,100'],
        ]);

        $orders = SellerOrder::query()
            ->where('seller_id', $request->user()->id)
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($filters['q'] ?? null, fn ($q, $term) => $q->where(fn ($w) => $w
                ->where('reference', 'like', "%{$term}%")
                ->orWhereHas('order.customer', fn ($c) => $c->where('name', 'like', "%{$term}%"))))
            ->with(['order.customer', 'shipment'])
            ->withCount('items')
            ->latest()
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();

        return SellerOrderResource::collection($orders);
    }

    public function show(Request $request, SellerOrder $sellerOrder): SellerOrderResource
    {
        $this->authorize('view', $sellerOrder);

        return new SellerOrderResource($sellerOrder->load(['order.customer', 'items', 'shipment']));
    }

    public function updateStatus(Request $request, SellerOrder $sellerOrder): SellerOrderResource
    {
        $this->authorize('update', $sellerOrder);

        $data = $request->validate([
            'status' => ['required', Rule::enum(SellerOrderStatus::class)],
            'courier_code' => ['nullable', Rule::in(Couriers::codes())],
            'courier' => ['nullable', 'string', 'max:60'], // display name; required when courier_code is "other"
            'tracking_number' => ['nullable', 'string', 'max:100'],
            'note' => ['nullable', 'string', 'max:255'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $this->service->transition(
            $sellerOrder,
            SellerOrderStatus::from($data['status']),
            array_filter(collect($data)->except('status')->all(), fn ($v) => $v !== null),
        );

        return new SellerOrderResource($sellerOrder->fresh()->load(['order.customer', 'items', 'shipment']));
    }
}
