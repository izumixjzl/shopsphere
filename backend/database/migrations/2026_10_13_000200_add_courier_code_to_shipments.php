<?php

use App\Services\Couriers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Stable courier key for filtering/reports; `courier` keeps the display name customers see.
        Schema::table('shipments', function (Blueprint $table) {
            $table->string('courier_code', 20)->nullable()->after('seller_order_id')->index();
        });

        // Map free-text couriers typed before the dropdown existed.
        DB::table('shipments')->whereNotNull('courier')->select('id', 'courier')->orderBy('id')
            ->each(function ($row) {
                [$code, $name] = Couriers::resolve(null, $row->courier);
                DB::table('shipments')->where('id', $row->id)->update(['courier_code' => $code, 'courier' => $name]);
            });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn('courier_code');
        });
    }
};
