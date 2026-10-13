<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $stock = $this->relationLoaded('inventory') ? ($this->inventory?->quantity ?? 0) : null;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'short_description' => $this->short_description,
            'description' => $this->when($request->routeIs('*.show') || $request->routeIs('seller.*'), $this->description),
            'price' => $this->price,
            'compare_at_price' => $this->compare_at_price,
            'status' => $this->status->value,
            'moderation_status' => $this->moderation_status,
            'moderation_note' => $this->when($request->user()?->id === $this->seller_id || $request->user()?->isAdmin(), $this->moderation_note),
            'rating_avg' => (float) $this->rating_avg,
            'rating_count' => $this->rating_count,
            'sales_count' => $this->sales_count,
            'in_stock' => $stock === null ? null : $stock > 0,
            'stock' => $stock,
            'low_stock_threshold' => $this->relationLoaded('inventory') ? $this->inventory?->low_stock_threshold : null,
            'is_low_stock' => $this->relationLoaded('inventory') ? (bool) $this->inventory?->isLowStock() : null,
            'image_url' => $this->whenLoaded('primaryImage', fn () => $this->primaryImage?->url),
            'images' => $this->whenLoaded('images', fn () => $this->images->map->only(['id', 'url', 'alt_text', 'is_primary', 'sort_order'])),
            'category' => $this->whenLoaded('category', fn () => $this->category?->only(['id', 'name', 'slug'])),
            'seller' => $this->whenLoaded('seller', fn () => [
                'id' => $this->seller->id,
                'store_name' => $this->seller->sellerProfile?->store_name,
                'store_slug' => $this->seller->sellerProfile?->store_slug,
                'logo_url' => $this->seller->sellerProfile?->logo_url,
                'rating_avg' => (float) $this->seller->sellerProfile?->rating_avg,
                'rating_count' => (int) $this->seller->sellerProfile?->rating_count,
            ]),
            'open_reports_count' => $this->whenHas('open_reports_count'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
