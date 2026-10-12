<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('store_name', 120);
            $table->string('store_slug', 140)->unique();
            $table->text('description')->nullable();
            $table->string('logo_url')->nullable();
            $table->string('banner_url')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('contact_phone', 30)->nullable();
            $table->string('business_address')->nullable();
            // pending | approved | rejected | suspended
            $table->string('status', 20)->default('pending')->index();
            // NULL = use marketplace default commission rate
            $table->decimal('commission_rate', 5, 2)->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('rejection_reason', 500)->nullable();
            $table->timestamps();
        });

        Schema::create('seller_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_profile_id')->constrained()->cascadeOnDelete();
            // business_permit | dti | sec | bir | valid_id
            $table->string('document_type', 40);
            $table->string('document_url');
            // pending | approved | rejected
            $table->string('status', 20)->default('pending')->index();
            $table->string('notes', 500)->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_verifications');
        Schema::dropIfExists('seller_profiles');
    }
};
