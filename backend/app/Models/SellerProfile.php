<?php

namespace App\Models;

use App\Enums\SellerStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SellerProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'store_name', 'store_slug', 'description', 'logo_url', 'banner_url',
        'contact_email', 'contact_phone', 'business_address',
    ];

    protected function casts(): array
    {
        return [
            'status' => SellerStatus::class,
            'commission_rate' => 'decimal:2',
            'approved_at' => 'datetime',
            'suspended_at' => 'datetime',
            'rating_avg' => 'decimal:2',
            'rating_count' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function verifications(): HasMany
    {
        return $this->hasMany(SellerVerification::class);
    }

    public function appeals(): HasMany
    {
        return $this->hasMany(SellerAppeal::class)->latest('id');
    }

    /** Recompute the cached seller rating from visible reviews of this seller's sold items (verified purchases only). */
    public static function refreshRating(int $sellerUserId): void
    {
        $agg = Review::query()
            ->join('order_items', 'order_items.id', '=', 'reviews.order_item_id')
            ->where('order_items.seller_id', $sellerUserId)
            ->where('reviews.is_visible', true)
            ->selectRaw('COUNT(*) as c, COALESCE(AVG(reviews.rating),0) as a')->first();

        static::where('user_id', $sellerUserId)->update([
            'rating_count' => (int) $agg->c,
            'rating_avg' => round((float) $agg->a, 2),
        ]);
    }

    /** Effective commission rate (%) for this seller. */
    public function effectiveCommissionRate(): float
    {
        return (float) ($this->commission_rate ?? config('marketplace.default_commission_rate'));
    }
}
