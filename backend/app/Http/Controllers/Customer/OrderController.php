<?php

namespace App\Http\Controllers\Customer;

use App\Enums\SellerOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Address;
use App\Models\Order;
use App\Payments\GatewayRegistry;
use App\Services\CheckoutService;
use App\Services\PaymentService;
use App\Services\SellerOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
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

    public function paymentMethods(GatewayRegistry $gateways): JsonResponse
    {
        return response()->json(['data' => $gateways->methods()]);
    }

    /**
     * Checkout: cart -> parent order + seller orders.
     * Send an `Idempotency-Key` header (one per checkout attempt) so retries after a timeout
     * return the original order (200) instead of failing or creating a second one (201).
     */
    public function store(Request $request, GatewayRegistry $gateways)
    {
        $data = $request->validate([
            'address_id' => ['required', 'integer'],
            'payment_method' => ['required', Rule::in(array_column($gateways->methods(), 'code'))],
            'notes' => ['nullable', 'string', 'max:500'],
            'expected_total' => ['nullable', 'numeric', 'min:0'],
        ]);

        $key = $request->header('Idempotency-Key');
        if ($key !== null && ! preg_match('/^[A-Za-z0-9_-]{8,64}$/', $key)) {
            throw ValidationException::withMessages(['idempotency_key' => 'Idempotency-Key must be 8–64 letters, digits, dashes or underscores.']);
        }

        $address = Address::query()->whereKey($data['address_id'])->where('user_id', $request->user()->id)->first();
        if (! $address) {
            throw ValidationException::withMessages(['address_id' => 'Please choose one of your saved addresses.']);
        }

        $order = $this->checkout->checkout($request->user(), $address, $data['notes'] ?? null,
            $data['payment_method'], $key, isset($data['expected_total']) ? (string) $data['expected_total'] : null);

        return (new OrderResource($order->load(['sellerOrders.items', 'sellerOrders.seller.sellerProfile', 'payments'])))
            ->response()->setStatusCode($order->wasRecentlyCreated ? 201 : 200);
    }

    /** Open (or reuse) a payment attempt for an unpaid online order, e.g. after a failed card. */
    public function pay(Request $request, Order $order, PaymentService $payments): JsonResponse
    {
        $this->authorize('view', $order);

        $payment = $payments->startAttempt($order);
        if ($payment->status !== 'pending') {
            throw ValidationException::withMessages(['payment' => $payment->failure_reason ?: 'Could not start the payment.']);
        }

        return response()->json(['data' => [
            'id' => $payment->id,
            'status' => $payment->status,
            'checkout_url' => $payment->checkout_url,
            'expires_at' => $payment->expires_at?->toIso8601String(),
        ]]);
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
