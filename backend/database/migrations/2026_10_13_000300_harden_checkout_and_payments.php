<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Client-generated Idempotency-Key: a retried checkout returns the order it already created.
            $table->string('checkout_key', 64)->nullable()->after('order_number');
            // Online payments only: unpaid orders are cancelled (and restocked) after this.
            $table->timestamp('payment_due_at')->nullable()->after('placed_at');

            $table->unique(['user_id', 'checkout_key']);
            $table->index(['payment_status', 'payment_due_at']);
        });

        // Each row is one payment attempt; an order can have several (e.g. a failed card, then a retry).
        Schema::table('payments', function (Blueprint $table) {
            $table->string('provider', 30)->nullable()->after('method');   // gateway key; null for cod/manual
            $table->string('checkout_url')->nullable()->after('transaction_reference');
            $table->timestamp('expires_at')->nullable()->after('paid_at');
            $table->string('failure_reason', 255)->nullable()->after('expires_at');
        });

        // Every webhook we accept, keyed by the provider's event id so redeliveries are processed once.
        Schema::create('webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 30);
            $table->string('event_id', 100);
            $table->string('type', 60);
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            // received | processed | ignored | rejected
            $table->string('status', 20)->default('received');
            $table->string('note', 255)->nullable();
            $table->json('payload');
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'event_id']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_events');
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['provider', 'checkout_url', 'expires_at', 'failure_reason']);
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'checkout_key']);
            $table->dropIndex(['payment_status', 'payment_due_at']);
            $table->dropColumn(['checkout_key', 'payment_due_at']);
        });
    }
};
