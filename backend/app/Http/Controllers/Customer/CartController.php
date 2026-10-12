<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Services\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CartController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json($this->payload($this->cartFor($request)));
    }

    public function add(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'between:1,99'],
        ]);

        $product = Product::query()->visible()->with('inventory')->find($data['product_id']);
        if (! $product) {
            throw ValidationException::withMessages(['product_id' => 'This product is not available.']);
        }
        if ($product->seller_id === $request->user()->id) {
            throw ValidationException::withMessages(['product_id' => 'You cannot buy your own product.']);
        }

        $cart = $this->cartFor($request);
        $item = $cart->items()->firstOrNew(['product_id' => $product->id]);
        $newQty = ($item->exists ? $item->quantity : 0) + $data['quantity'];

        $this->assertStock($product, $newQty);

        $item->quantity = $newQty;
        $item->save();

        return response()->json($this->payload($cart), 201);
    }

    public function update(Request $request, CartItem $item): JsonResponse
    {
        $cart = $this->cartFor($request);
        abort_unless($item->cart_id === $cart->id, 404);

        $data = $request->validate(['quantity' => ['required', 'integer', 'between:1,99']]);

        $product = $item->product()->with('inventory')->first();
        $this->assertStock($product, $data['quantity']);

        $item->update(['quantity' => $data['quantity']]);

        return response()->json($this->payload($cart));
    }

    public function remove(Request $request, CartItem $item): JsonResponse
    {
        $cart = $this->cartFor($request);
        abort_unless($item->cart_id === $cart->id, 404);
        $item->delete();

        return response()->json($this->payload($cart));
    }

    public function clear(Request $request): JsonResponse
    {
        $cart = $this->cartFor($request);
        $cart->items()->delete();

        return response()->json($this->payload($cart));
    }

    private function cartFor(Request $request): Cart
    {
        return Cart::firstOrCreate(['user_id' => $request->user()->id]);
    }

    private function assertStock(?Product $product, int $qty): void
    {
        $available = $product?->inventory?->quantity ?? 0;
        if ($qty > $available) {
            throw ValidationException::withMessages([
                'quantity' => $available > 0 ? "Only {$available} left in stock." : 'This product is out of stock.',
            ]);
        }
    }

    /** Cart grouped by seller, with per-item availability so the UI can warn early. */
    private function payload(Cart $cart): array
    {
        $items = $cart->items()
            ->with(['product' => fn ($q) => $q->withTrashed()->with(['primaryImage', 'inventory', 'seller.sellerProfile'])])
            ->orderBy('id')->get();

        $shippingCents = Money::toCents(config('marketplace.shipping_fee_per_seller'));
        $groups = [];
        $subtotal = 0;

        foreach ($items as $item) {
            $p = $item->product;
            $available = $p && ! $p->trashed() && $p->isPurchasable();
            $stock = $p?->inventory?->quantity ?? 0;
            $lineCents = $available ? Money::toCents($p->price) * $item->quantity : 0;
            $subtotal += $lineCents;

            $sellerId = $p?->seller_id ?? 0;
            $groups[$sellerId] ??= [
                'seller_id' => $sellerId,
                'store_name' => $p?->seller?->sellerProfile?->store_name ?? 'Unavailable',
                'store_slug' => $p?->seller?->sellerProfile?->store_slug,
                'items' => [],
                'subtotal_cents' => 0,
            ];
            $groups[$sellerId]['subtotal_cents'] += $lineCents;
            $groups[$sellerId]['items'][] = [
                'id' => $item->id,
                'quantity' => $item->quantity,
                'line_total' => Money::fromCents($lineCents),
                'is_available' => $available,
                'has_enough_stock' => $stock >= $item->quantity,
                'product' => $p ? new ProductResource($p) : null,
            ];
        }

        $groups = array_values(array_map(function ($g) {
            $g['subtotal'] = Money::fromCents($g['subtotal_cents']);
            unset($g['subtotal_cents']);

            return $g;
        }, $groups));

        $sellerCount = count(array_filter($groups, fn ($g) => $g['subtotal'] !== '0.00'));
        $shipping = $shippingCents * $sellerCount;

        return [
            'groups' => $groups,
            'item_count' => (int) $items->sum('quantity'),
            'subtotal' => Money::fromCents($subtotal),
            'shipping_total' => Money::fromCents($shipping),
            'grand_total' => Money::fromCents($subtotal + $shipping),
            'can_checkout' => $items->isNotEmpty() && collect($groups)->flatMap(fn ($g) => $g['items'])
                ->every(fn ($i) => $i['is_available'] && $i['has_enough_stock']),
        ];
    }
}
