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

    /** Effective commission rate (%) for this seller. */
    public function effectiveCommissionRate(): float
    {
        return (float) ($this->commission_rate ?? config('marketplace.default_commission_rate'));
    }
}
