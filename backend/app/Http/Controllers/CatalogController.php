<?php

namespace App\Http\Controllers;

use App\Enums\SellerStatus;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\SellerProfileResource;
use App\Models\Category;
use App\Models\Product;
use App\Models\Review;
use App\Models\SellerProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Public, unauthenticated storefront endpoints. */
class CatalogController extends Controller
{
    private const SORTS = [
        'newest' => ['created_at', 'desc'],
        'price_asc' => ['price', 'asc'],
        'price_desc' => ['price', 'desc'],
        'popular' => ['sales_count', 'desc'],
        'rating' => ['rating_avg', 'desc'],
    ];

    public function categories()
    {
        $categories = Category::query()
            ->whereNull('parent_id')
            ->where('is_active', true)
            ->with(['children' => fn ($q) => $q->where('is_active', true)])
            ->orderBy('sort_order')->orderBy('name')
            ->get();

        return CategoryResource::collection($categories);
    }

    public function products(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:120'],
            'store' => ['nullable', 'string', 'max:140'],
            'min_price' => ['nullable', 'numeric', 'min:0'],
            'max_price' => ['nullable', 'numeric', 'min:0'],
            'min_rating' => ['nullable', 'integer', 'between:1,5'],
            'in_stock' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(array_keys(self::SORTS))],
            'per_page' => ['nullable', 'integer', 'between:1,60'],
        ]);

        $query = Product::query()
            ->visible()
            ->search($filters['q'] ?? null)
            ->with(['primaryImage', 'inventory', 'category', 'seller.sellerProfile']);

        if (! empty($filters['category'])) {
            $category = Category::where('slug', $filters['category'])->first();
            $query->whereIn('category_id', $category ? $category->selfAndChildIds() : [0]);
        }
        if (! empty($filters['store'])) {
            $query->whereHas('seller.sellerProfile', fn ($q) => $q->where('store_slug', $filters['store']));
        }
        if (isset($filters['min_price'])) {
            $query->where('price', '>=', $filters['min_price']);
        }
        if (isset($filters['max_price'])) {
            $query->where('price', '<=', $filters['max_price']);
        }
        if (! empty($filters['min_rating'])) {
            $query->where('rating_avg', '>=', $filters['min_rating']);
        }
        if (! empty($filters['in_stock'])) {
            $query->whereHas('inventory', fn ($q) => $q->where('quantity', '>', 0));
        }

        [$column, $dir] = self::SORTS[$filters['sort'] ?? 'newest'];
        $query->orderBy($column, $dir)->orderByDesc('id');

        return ProductResource::collection($query->paginate($filters['per_page'] ?? 20)->withQueryString());
    }

    public function product(string $slug)
    {
        $product = Product::query()
            ->visible()
            ->where('slug', $slug)
            ->with(['images', 'primaryImage', 'inventory', 'category', 'seller.sellerProfile'])
            ->firstOrFail();

        $breakdown = Review::query()
            ->where('product_id', $product->id)->where('is_visible', true)
            ->selectRaw('rating, COUNT(*) as total')->groupBy('rating')
            ->pluck('total', 'rating');

        $related = Product::query()->visible()
            ->where('category_id', $product->category_id)
            ->whereKeyNot($product->id)
            ->with(['primaryImage', 'inventory', 'seller.sellerProfile'])
            ->orderByDesc('sales_count')->limit(8)->get();

        return response()->json([
            'product' => new ProductResource($product),
            'rating_breakdown' => collect(range(5, 1))->mapWithKeys(fn ($r) => [$r => (int) ($breakdown[$r] ?? 0)]),
            'related' => ProductResource::collection($related),
        ]);
    }

    public function productReviews(string $slug)
    {
        $product = Product::query()->visible()->where('slug', $slug)->firstOrFail();

        $reviews = Review::query()
            ->where('product_id', $product->id)->where('is_visible', true)
            ->with('author:id,name,avatar_url')
            ->latest()->paginate(10);

        return response()->json([
            'data' => $reviews->getCollection()->map(fn ($r) => [
                'id' => $r->id,
                'rating' => $r->rating,
                'title' => $r->title,
                'body' => $r->body,
                'author' => $r->author?->name,
                'verified_purchase' => true,
                'created_at' => $r->created_at->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $reviews->currentPage(),
                'last_page' => $reviews->lastPage(),
                'total' => $reviews->total(),
            ],
        ]);
    }

    public function store(string $slug): JsonResponse
    {
        $profile = SellerProfile::query()
            ->where('store_slug', $slug)
            ->where('status', SellerStatus::Approved)
            ->firstOrFail();

        $stats = Product::query()->visible()->where('seller_id', $profile->user_id)
            ->selectRaw('COUNT(*) as products, COALESCE(SUM(sales_count),0) as sold')
            ->first();

        return response()->json([
            'store' => new SellerProfileResource($profile),
            'stats' => [
                'products' => (int) $stats->products,
                'units_sold' => (int) $stats->sold,
                // Every review counted here is tied to a delivered order item.
                'rating' => (float) $profile->rating_avg,
                'rating_count' => (int) $profile->rating_count,
            ],
        ]);
    }

    /** Latest verified-purchase reviews across all of a store's products. */
    public function storeReviews(string $slug): JsonResponse
    {
        $profile = SellerProfile::query()
            ->where('store_slug', $slug)
            ->where('status', SellerStatus::Approved)
            ->firstOrFail();

        $reviews = Review::query()
            ->where('is_visible', true)
            ->whereHas('orderItem', fn ($q) => $q->where('seller_id', $profile->user_id))
            ->with(['author:id,name', 'product:id,name,slug'])
            ->latest()->paginate(10);

        return response()->json([
            'data' => $reviews->getCollection()->map(fn ($r) => [
                'id' => $r->id,
                'rating' => $r->rating,
                'title' => $r->title,
                'body' => $r->body,
                'author' => $r->author?->name,
                'product' => $r->product?->only(['name', 'slug']),
                'verified_purchase' => true,
                'created_at' => $r->created_at->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $reviews->currentPage(),
                'last_page' => $reviews->lastPage(),
                'total' => $reviews->total(),
            ],
        ]);
    }
}
