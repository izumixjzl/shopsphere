<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Photos / videos a customer attaches as proof to a return or dispute. Stored on a private disk.
        Schema::create('refund_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('refund_id')->constrained()->cascadeOnDelete();
            $table->string('disk', 30);
            $table->string('path');
            $table->string('mime_type', 100);
            $table->string('original_name');
            $table->unsignedInteger('size');   // bytes
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refund_attachments');
    }
};
