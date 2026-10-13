<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One row per provider webhook we accepted; unique (provider, event_id) makes redeliveries no-ops. */
class WebhookLog extends Model
{
    protected $table = 'webhook_events';

    protected $fillable = ['provider', 'event_id', 'type', 'payment_id', 'status', 'note', 'payload', 'processed_at'];

    protected function casts(): array
    {
        return ['payload' => 'array', 'processed_at' => 'datetime'];
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
