<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Http\Resources\SellerOrderResource;
use App\Models\CommissionRecord;
use App\Models\SellerOrder;
use App\Services\AnalyticsService;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(
        private AnalyticsService $analytics,
        private ReportService $reports,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);
        [$from, $to] = AnalyticsService::range($request->from, $request->to);
        $sellerId = $request->user()->id;

        return response()->json([
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'kpis' => $this->analytics->kpis($sellerId, $from, $to),
            'sales' => $this->analytics->salesSeries($sellerId, $from, $to),
            'status_breakdown' => $this->analytics->statusBreakdown($sellerId, $from, $to),
            'best_sellers' => $this->analytics->bestSellers($sellerId, $from, $to),
            'low_stock' => $this->analytics->lowStock($sellerId),
            'commission' => $this->analytics->commissionSummary($sellerId),
            'recent_orders' => SellerOrderResource::collection(
                SellerOrder::where('seller_id', $sellerId)->with('order.customer')->withCount('items')->latest()->limit(6)->get()
            ),
        ]);
    }

    /** Commission ledger + payout history. */
    public function finance(Request $request): JsonResponse
    {
        $sellerId = $request->user()->id;

        $records = CommissionRecord::where('seller_id', $sellerId)
            ->with('sellerOrder:id,reference,status,created_at')
            ->latest()->paginate(15);

        return response()->json([
            'summary' => $this->analytics->commissionSummary($sellerId),
            'commission_rate' => $request->user()->sellerProfile->effectiveCommissionRate(),
            'records' => $records,
            'payouts' => $request->user()->payouts()->latest()->limit(20)->get(),
        ]);
    }

    public function report(Request $request)
    {
        $request->validate([
            'format' => ['required', 'in:csv,pdf'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);
        [$from, $to] = AnalyticsService::range($request->from, $request->to);
        $user = $request->user()->load('sellerProfile');

        return $request->format === 'csv'
            ? $this->reports->salesCsv($user->id, $from, $to)
            : $this->reports->salesPdf($user->id, $from, $to, $user->sellerProfile->store_name.' — Sales report');
    }
}
