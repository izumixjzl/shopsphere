<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductReport extends Model
{
    public const REASONS = [
        'counterfeit' => 'Counterfeit or fake item',
        'prohibited' => 'Prohibited or illegal item',
        'misleading' => 'Misleading description or photos',
        'offensive' => 'Offensive content',
        'scam' => 'Suspected scam',
        'other' => 'Something else',
    ];

    protected $fillable = ['product_id', 'user_id', 'reason', 'details'];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
