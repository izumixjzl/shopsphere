<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Customers flag listings that break marketplace rules; admins review them.
        Schema::create('product_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();   // reporter
            $table->string('reason', 30);                                      // see ProductReport::REASONS
            $table->string('details', 1000)->nullable();
            $table->string('status', 20)->default('open');                      // open | resolved | dismissed
            $table->string('admin_note', 500)->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['product_id', 'user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_reports');
    }
};
