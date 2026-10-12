<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class RefundAttachment extends Model
{
    protected $fillable = ['disk', 'path', 'mime_type', 'original_name', 'size'];

    protected $hidden = ['disk', 'path'];

    protected $appends = ['url', 'kind'];

    public function refund(): BelongsTo
    {
        return $this->belongsTo(Refund::class);
    }

    /** Short-lived signed link: works for the private local disk (`serve`) and S3 alike. */
    protected function url(): Attribute
    {
        return Attribute::get(fn () => Storage::disk($this->disk)->temporaryUrl($this->path, now()->addMinutes(30)));
    }

    /** image | video — lets the frontend pick <img> or <video>. */
    protected function kind(): Attribute
    {
        return Attribute::get(fn () => str_starts_with($this->mime_type, 'video/') ? 'video' : 'image');
    }
}
