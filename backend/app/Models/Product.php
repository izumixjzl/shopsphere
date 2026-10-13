<?php

namespace App\Models;

use App\Enums\ProductStatus;
use App\Enums\SellerStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'category_id', 'name', 'slug', 'sku', 'short_description', 'description',
        'price', 'compare_at_price', 'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => ProductStatus::class,
            'price' => 'decimal:2',
            'compare_at_price' => 'decimal:2',
            'rating_avg' => 'decimal:2',
        ];
    }

    // ---- Relationships --------------------------------------------------

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderByDesc('is_primary')->orderBy('sort_order');
    }

    public function primaryImage(): HasOne
    {
        return $this->hasOne(ProductImage::class)->ofMany(['is_primary' => 'max', 'id' => 'min']);
    }

    public function inventory(): HasOne
    {
        return $this->hasOne(Inventory::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(ProductReport::class);
    }

    // ---- Scopes ---------------------------------------------------------

    /** Products customers are allowed to see and buy. */
    public function scopeVisible(Builder $query): Builder
    {
        return $query
            ->where('status', ProductStatus::Active)
            ->where('moderation_status', 'approved')
            ->whereHas('seller', fn ($q) => $q
                ->where('status', 'active')
                ->whereHas('sellerProfile', fn ($p) => $p->where('status', SellerStatus::Approved)));
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';

        return $query->where(fn ($q) => $q
            ->where('name', 'like', $like)
            ->orWhere('short_description', 'like', $like)
            ->orWhere('sku', 'like', $like));
    }

    public function isPurchasable(): bool
    {
        return $this->status === ProductStatus::Active
            && $this->moderation_status === 'approved'
            && $this->seller?->isApprovedSeller()
            && $this->seller->isActive();
    }
}
