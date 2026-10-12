<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Parent order: one per customer checkout.
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number', 32)->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            // pending | processing | partially_shipped | shipped | completed | cancelled
            $table->string('status', 30)->default('pending');
            $table->string('payment_method', 20)->default('cod');
            // unpaid | paid | partially_refunded | refunded
            $table->string('payment_status', 20)->default('unpaid');
            $table->decimal('subtotal', 12, 2);
            $table->decimal('shipping_total', 12, 2)->default(0);
            $table->decimal('grand_total', 12, 2);
            // Snapshot of the delivery address at checkout time.
            $table->json('shipping_address');
            $table->string('notes', 500)->nullable();
            $table->timestamp('placed_at');
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['status', 'placed_at']);
        });

        // Child order: one per seller inside a checkout.
        Schema::create('seller_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained('users')->restrictOnDelete();
            $table->string('reference', 40)->unique();
            // pending | confirmed | packed | shipped | delivered | cancelled | returned
            $table->string('status', 20)->default('pending');
            $table->decimal('subtotal', 12, 2);
            $table->decimal('shipping_fee', 12, 2)->default(0);
            $table->decimal('commission_rate', 5, 2);
            $table->decimal('commission_amount', 12, 2);
            $table->decimal('seller_earnings', 12, 2);
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason', 500)->nullable();
            $table->timestamps();

            $table->unique(['order_id', 'seller_id']);
            $table->index(['seller_id', 'status']);
            $table->index(['seller_id', 'created_at']);
        });

        // Line items keep name / SKU / price snapshots so history never changes
        // when a seller edits or deletes a product later.
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('seller_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('seller_id')->constrained('users')->restrictOnDelete();
            $table->string('product_name', 180);
            $table->string('product_sku', 64);
            $table->string('product_image_url')->nullable();
            $table->decimal('unit_price', 12, 2);
            $table->unsignedInteger('quantity');
            $table->decimal('line_total', 12, 2);
            $table->timestamps();

            $table->index(['product_id', 'created_at']);
            $table->index('seller_id');
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('method', 20); // cod (gateways later)
            $table->decimal('amount', 12, 2);
            // pending | paid | failed | refunded
            $table->string('status', 20)->default('pending');
            $table->string('transaction_reference', 100)->nullable()->unique();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'status']);
        });

        Schema::create('shipments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_order_id')->constrained()->cascadeOnDelete();
            $table->string('courier', 60)->nullable();
            $table->string('tracking_number', 100)->nullable();
            // pending | in_transit | out_for_delivery | delivered | failed
            $table->string('status', 30)->default('pending');
            // [{status, note, at}] — ordered event log shown on tracking page
            $table->json('tracking_events')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->index(['seller_order_id', 'status']);
            $table->index('tracking_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipments');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('seller_orders');
        Schema::dropIfExists('orders');
    }
};
