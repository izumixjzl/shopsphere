<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->constrained('users')->restrictOnDelete();
            $table->string('reference', 40)->unique();
            $table->decimal('amount', 12, 2);
            // pending | processing | paid | failed
            $table->string('status', 20)->default('pending');
            $table->string('method', 30)->default('bank_transfer');
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('notes', 500)->nullable();
            $table->timestamps();

            $table->index(['seller_id', 'status']);
        });

        // One commission record per seller order.
        Schema::create('commission_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_order_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained('users')->restrictOnDelete();
            $table->decimal('gross_amount', 12, 2);
            $table->decimal('commission_rate', 5, 2);
            $table->decimal('commission_amount', 12, 2);
            $table->decimal('net_amount', 12, 2);
            // pending (order not delivered) | payable | paid | reversed
            $table->string('status', 20)->default('pending');
            $table->foreignId('payout_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->index(['seller_id', 'status']);
        });

        // Covers refund requests, return requests and disputes.
        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('seller_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            // return | refund | dispute
            $table->string('type', 20)->default('return');
            $table->string('reason', 120);
            $table->text('details')->nullable();
            $table->decimal('amount', 12, 2);
            // requested | approved | rejected | refunded
            $table->string('status', 20)->default('requested');
            $table->string('resolution_note', 500)->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('commission_records');
        Schema::dropIfExists('payouts');
    }
};
