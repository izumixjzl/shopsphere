<?php

namespace App\Http\Controllers\Seller;

use App\Enums\ProductStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Services\AuditLogger;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    public function __construct(
        private InventoryService $inventory,
        private AuditLogger $audit,
    ) {}

    public function index(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::enum(ProductStatus::class)],
            'stock' => ['nullable', Rule::in(['low', 'out'])],
            'category_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'between:1,100'],
        ]);

        $products = Product::query()
            ->where('seller_id', $request->user()->id)
            ->search($filters['q'] ?? null)
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($filters['category_id'] ?? null, fn ($q, $c) => $q->where('category_id', $c))
            ->when(($filters['stock'] ?? null) === 'low', fn ($q) => $q->whereHas('inventory', fn ($i) => $i->lowStock()))
            ->when(($filters['stock'] ?? null) === 'out', fn ($q) => $q->whereHas('inventory', fn ($i) => $i->where('quantity', 0)))
            ->with(['primaryImage', 'inventory', 'category'])
            ->latest()
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();

        return ProductResource::collection($products);
    }

    public function show(Request $request, Product $product): ProductResource
    {
        $this->authorize('update', $product);

        return new ProductResource($product->load(['images', 'primaryImage', 'inventory', 'category']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules($request));

        $product = DB::transaction(function () use ($request, $data) {
            $product = new Product([
                ...collect($data)->except(['stock', 'low_stock_threshold', 'images'])->all(),
                'slug' => $this->uniqueSlug($data['name']),
            ]);
            $product->seller_id = $request->user()->id;
            $product->save();

            $this->inventory->setQuantity($product, $data['stock'], $data['low_stock_threshold'] ?? config('marketplace.low_stock_threshold'));
            $this->storeImages($product, $request->file('images', []));

            return $product;
        });

        $this->audit->log('product.created', $product, [], $product->only(['name', 'sku', 'price', 'status']));

        return (new ProductResource($product->load(['images', 'primaryImage', 'inventory', 'category'])))
            ->response()->setStatusCode(201);
    }

    public function update(Request $request, Product $product): ProductResource
    {
        $this->authorize('update', $product);
        $data = $request->validate($this->rules($request, $product));

        $old = $product->only(['name', 'sku', 'price', 'status', 'category_id']);

        DB::transaction(function () use ($request, $product, $data) {
            $fields = collect($data)->except(['stock', 'low_stock_threshold', 'images'])->all();
            if (isset($fields['name']) && $fields['name'] !== $product->name) {
                $fields['slug'] = $this->uniqueSlug($fields['name'], $product->id);
            }
            $product->update($fields);

            if (array_key_exists('stock', $data)) {
                $this->inventory->setQuantity($product, $data['stock'], $data['low_stock_threshold'] ?? null);
            }
            $this->storeImages($product, $request->file('images', []));
        });

        $this->audit->log('product.updated', $product, $old, $product->only(array_keys($old)));

        return new ProductResource($product->fresh()->load(['images', 'primaryImage', 'inventory', 'category']));
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        $this->authorize('delete', $product);

        // Soft delete keeps order history intact; it simply disappears from the store.
        $product->update(['status' => ProductStatus::Inactive]);
        $product->delete();
        $this->audit->log('product.deleted', $product);

        return response()->json(['message' => 'Product deleted.']);
    }

    /** Quick stock adjustment from the inventory table. */
    public function updateStock(Request $request, Product $product): ProductResource
    {
        $this->authorize('update', $product);
        $data = $request->validate([
            'stock' => ['required', 'integer', 'between:0,1000000'],
            'low_stock_threshold' => ['nullable', 'integer', 'between:0,100000'],
        ]);

        $old = $product->inventory()->first()?->only(['quantity', 'low_stock_threshold']) ?? [];
        $inv = $this->inventory->setQuantity($product, $data['stock'], $data['low_stock_threshold'] ?? null);
        $this->audit->log('inventory.adjusted', $product, $old, $inv->only(['quantity', 'low_stock_threshold']));

        return new ProductResource($product->load(['primaryImage', 'inventory', 'category']));
    }

    public function uploadImages(Request $request, Product $product): ProductResource
    {
        $this->authorize('update', $product);
        $request->validate([
            'images' => ['required', 'array', 'min:1'],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:'.config('marketplace.max_image_kb')],
        ]);

        $this->storeImages($product, $request->file('images'));

        return new ProductResource($product->load(['images', 'primaryImage', 'inventory', 'category']));
    }

    public function setPrimaryImage(Request $request, Product $product, ProductImage $image): ProductResource
    {
        $this->authorize('update', $product);
        abort_unless($image->product_id === $product->id, 404);

        DB::transaction(function () use ($product, $image) {
            $product->images()->update(['is_primary' => false]);
            $image->update(['is_primary' => true]);
        });

        return new ProductResource($product->load(['images', 'primaryImage', 'inventory', 'category']));
    }

    public function deleteImage(Request $request, Product $product, ProductImage $image): ProductResource
    {
        $this->authorize('update', $product);
        abort_unless($image->product_id === $product->id, 404);

        if ($image->path) {
            Storage::disk($image->disk)->delete($image->path);
        }
        $wasPrimary = $image->is_primary;
        $image->delete();

        if ($wasPrimary) {
            $product->images()->orderBy('sort_order')->first()?->update(['is_primary' => true]);
        }

        return new ProductResource($product->load(['images', 'primaryImage', 'inventory', 'category']));
    }

    // ---------------------------------------------------------------------

    private function rules(Request $request, ?Product $product = null): array
    {
        $required = $product ? 'sometimes' : 'required';
        $sellerId = $request->user()->id;

        return [
            'category_id' => [$required, 'integer', Rule::exists('categories', 'id')->where('is_active', true)],
            'name' => [$required, 'string', 'max:180'],
            'sku' => [$required, 'string', 'max:64', 'regex:/^[A-Za-z0-9._-]+$/',
                Rule::unique('products', 'sku')->where('seller_id', $sellerId)->ignore($product?->id)],
            'short_description' => ['nullable', 'string', 'max:500'],
            'description' => ['nullable', 'string', 'max:20000'],
            'price' => [$required, 'numeric', 'min:1', 'max:9999999'],
            'compare_at_price' => ['nullable', 'numeric', 'gt:price'],
            'status' => [$required, Rule::enum(ProductStatus::class)],
            'stock' => [$product ? 'sometimes' : 'required', 'integer', 'between:0,1000000'],
            'low_stock_threshold' => ['nullable', 'integer', 'between:0,100000'],
            'images' => ['nullable', 'array', 'max:'.config('marketplace.max_product_images')],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:'.config('marketplace.max_image_kb')],
        ];
    }

    private function storeImages(Product $product, array $files): void
    {
        if (! $files) {
            return;
        }

        $existing = $product->images()->count();
        if ($existing + count($files) > config('marketplace.max_product_images')) {
            throw ValidationException::withMessages(['images' => 'A product can have at most '.config('marketplace.max_product_images').' images.']);
        }

        $disk = config('filesystems.default');
        foreach (array_values($files) as $i => $file) {
            $path = $file->store("products/{$product->id}", $disk);
            $image = new ProductImage([
                'url' => Storage::disk($disk)->url($path),
                'disk' => $disk,
                'path' => $path,
                'alt_text' => $product->name,
                'sort_order' => $existing + $i,
                'is_primary' => $existing === 0 && $i === 0,
            ]);
            $product->images()->save($image);
        }
    }

    private function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'product';
        $slug = $base;
        while (Product::withTrashed()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists()) {
            $slug = $base.'-'.Str::lower(Str::random(5));
        }

        return $slug;
    }
}
