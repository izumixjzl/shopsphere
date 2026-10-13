<?php

use App\Models\SellerProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Seller rating = all visible reviews on the seller's order items (verified purchases only),
        // cached here like products.rating_avg so storefronts don't aggregate on every request.
        Schema::table('seller_profiles', function (Blueprint $table) {
            $table->decimal('rating_avg', 3, 2)->default(0)->after('commission_rate');
            $table->unsignedInteger('rating_count')->default(0)->after('rating_avg');
            $table->timestamp('suspended_at')->nullable()->after('approved_by');
        });

        // A suspended seller asks for reinstatement; an admin accepts (reinstates) or denies it.
        Schema::create('seller_appeals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_profile_id')->constrained()->cascadeOnDelete();
            $table->string('suspension_reason', 500)->nullable(); // snapshot of what was appealed
            $table->text('message');
            $table->string('status', 20)->default('open');        // open | accepted | denied
            $table->string('admin_note', 500)->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            $table->index(['seller_profile_id', 'status']);
            $table->index(['status', 'created_at']);
        });

        // Backfill ratings from reviews written before this column existed.
        DB::table('seller_profiles')->orderBy('id')->pluck('user_id')
            ->each(fn ($sellerId) => SellerProfile::refreshRating($sellerId));
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_appeals');
        Schema::table('seller_profiles', function (Blueprint $table) {
            $table->dropColumn(['rating_avg', 'rating_count', 'suspended_at']);
        });
    }
};
