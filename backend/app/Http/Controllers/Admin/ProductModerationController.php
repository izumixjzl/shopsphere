<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Services\AuditLogger;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductModerationController extends Controller
{
    public function __construct(
        private AuditLogger $audit,
        private NotificationService $notifications,
    ) {}

    public function index(Request $request)
    {
        $filters = $request->validate([
            'moderation_status' => ['nullable', Rule::in(['approved', 'flagged', 'removed'])],
            'q' => ['nullable', 'string', 'max:100'],
            'seller_id' => ['nullable', 'integer'],
        ]);

        $products = Product::query()
            ->search($filters['q'] ?? null)
            ->when($filters['moderation_status'] ?? null, fn ($q, $s) => $q->where('moderation_status', $s))
            ->when($filters['seller_id'] ?? null, fn ($q, $s) => $q->where('seller_id', $s))
            ->with(['primaryImage', 'inventory', 'category', 'seller.sellerProfile'])
            ->latest()->paginate(20)->withQueryString();

        return ProductResource::collection($products);
    }

    public function moderate(Request $request, Product $product): ProductResource
    {
        $this->authorize('moderate', $product);

        $data = $request->validate([
            'moderation_status' => ['required', Rule::in(['approved', 'flagged', 'removed'])],
            'moderation_note' => ['required_unless:moderation_status,approved', 'nullable', 'string', 'max:500'],
        ]);

        $old = $product->only(['moderation_status', 'moderation_note']);
        $product->forceFill($data)->save();
        $this->audit->log('product.moderated', $product, $old, $data);

        if ($data['moderation_status'] !== 'approved') {
            $this->notifications->send($product->seller_id, 'product.'.$data['moderation_status'],
                'Listing '.$data['moderation_status'],
                "\"{$product->name}\" was {$data['moderation_status']} by an administrator: {$data['moderation_note']}",
                ['product_id' => $product->id]);
        }

        return new ProductResource($product->load(['primaryImage', 'inventory', 'category', 'seller.sellerProfile']));
    }
}
