<?php

namespace App\Http\Controllers\Customer;

use App\Enums\SellerOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Address;
use App\Models\Order;
use App\Services\CheckoutService;
use App\Services\SellerOrderService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function __construct(
        private CheckoutService $checkout,
        private SellerOrderService $sellerOrders,
    ) {}

    public function index(Request $request)
    {
        $request->validate(['status' => ['nullable', 'string', 'max:30']]);

        $orders = $request->user()->orders()
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->with(['sellerOrders.items', 'sellerOrders.seller.sellerProfile', 'sellerOrders.shipment'])
            ->latest('placed_at')
            ->paginate(10);

        return OrderResource::collection($orders);
    }

    public function show(Request $request, Order $order): OrderResource
    {
        $this->authorize('view', $order);

        return new OrderResource($order->load([
            'sellerOrders.items.review', 'sellerOrders.seller.sellerProfile', 'sellerOrders.shipment', 'payments',
        ]));
    }

    /** Checkout: cart -> parent order + seller orders (COD). */
    public function store(Request $request)
    {
        $data = $request->validate([
            'address_id' => ['required', 'integer'],
            'payment_method' => ['required', 'in:cod'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $address = Address::query()->whereKey($data['address_id'])->where('user_id', $request->user()->id)->first();
        if (! $address) {
            throw ValidationException::withMessages(['address_id' => 'Please choose one of your saved addresses.']);
        }

        $order = $this->checkout->checkout($request->user(), $address, $data['notes'] ?? null);

        return (new OrderResource($order->load(['sellerOrders.items', 'sellerOrders.seller.sellerProfile', 'payments'])))
            ->response()->setStatusCode(201);
    }

    /** Customers may cancel while every seller order is still pending. */
    public function cancel(Request $request, Order $order): OrderResource
    {
        $this->authorize('cancel', $order);
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        $sellerOrders = $order->sellerOrders()->get();
        if ($sellerOrders->contains(fn ($so) => $so->status !== SellerOrderStatus::Pending)) {
            throw ValidationException::withMessages(['order' => 'This order can no longer be cancelled because a seller has started processing it.']);
        }

        foreach ($sellerOrders as $so) {
            $this->sellerOrders->transition($so, SellerOrderStatus::Cancelled, ['reason' => $data['reason'] ?? 'Cancelled by customer']);
        }

        return $this->show($request, $order->fresh());
    }
}
