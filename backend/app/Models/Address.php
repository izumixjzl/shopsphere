<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Address extends Model
{
    use HasFactory;

    protected $fillable = [
        'label', 'recipient_name', 'phone', 'line1', 'line2', 'barangay',
        'city', 'province', 'postal_code', 'country', 'is_default',
    ];

    protected function casts(): array
    {
        return ['is_default' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Frozen copy stored on the order. */
    public function toSnapshot(): array
    {
        return $this->only([
            'recipient_name', 'phone', 'line1', 'line2', 'barangay',
            'city', 'province', 'postal_code', 'country',
        ]);
    }
}
