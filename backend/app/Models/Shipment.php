<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Shipment extends Model
{
    protected $fillable = ['courier_code', 'courier','tracking_number', 'status', 'tracking_events', 'shipped_at', 'delivered_at'];

    protected function casts(): array
    {
        return [
            'tracking_events' => 'array',
            'shipped_at' => 'datetime',
            'delivered_at' => 'datetime',
        ];
    }

    public function sellerOrder(): BelongsTo
    {
        return $this->belongsTo(SellerOrder::class);
    }

    public function addEvent(string $status, ?string $note = null): void
    {
        $events = $this->tracking_events ?? [];
        $events[] = ['status' => $status, 'note' => $note, 'at' => now()->toIso8601String()];
        $this->tracking_events = $events;
        $this->status = $status;
    }
}
