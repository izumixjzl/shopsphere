<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\Wishlist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    public function index(Request $request)
    {
        $products = Product::query()
            ->whereIn('id', Wishlist::where('user_id', $request->user()->id)->select('product_id'))
            ->with(['primaryImage', 'inventory', 'seller.sellerProfile'])
            ->get();

        return ProductResource::collection($products);
    }

    public function ids(Request $request): JsonResponse
    {
        return response()->json(['data' => Wishlist::where('user_id', $request->user()->id)->pluck('product_id')]);
    }

    public function toggle(Request $request, Product $product): JsonResponse
    {
        $existing = Wishlist::where('user_id', $request->user()->id)->where('product_id', $product->id)->first();

        if ($existing) {
            $existing->delete();

            return response()->json(['wishlisted' => false]);
        }

        Wishlist::create(['user_id' => $request->user()->id, 'product_id' => $product->id]);

        return response()->json(['wishlisted' => true], 201);
    }
}
