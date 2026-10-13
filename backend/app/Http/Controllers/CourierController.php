<?php

namespace App\Http\Controllers;

use App\Models\Shipment;
use App\Services\Couriers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Courier choices for the "Ship this order" form, plus the courier this seller used last. */
class CourierController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        $last = $user->isSeller()
            ? Shipment::query()
                ->whereHas('sellerOrder', fn ($q) => $q->where('seller_id', $user->id))
                ->whereNotNull('courier_code')
                ->latest('shipped_at')->latest('id')
                ->first(['courier_code', 'courier'])
            : null;

        return response()->json([
            'data' => collect(Couriers::all())->map(fn ($name, $code) => ['code' => $code, 'name' => $name])->values(),
            'last' => $last ? ['code' => $last->courier_code, 'name' => $last->courier] : null,
        ]);
    }
}
