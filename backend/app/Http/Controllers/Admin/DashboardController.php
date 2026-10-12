<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\ProductReport;
use App\Models\SellerProfile;
use App\Models\User;
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

        return response()->json([
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'kpis' => $this->analytics->kpis(null, $from, $to) + [
                'customers' => User::where('role', 'customer')->count(),
                'approved_sellers' => SellerProfile::where('status', 'approved')->count(),
                'pending_sellers' => SellerProfile::where('status', 'pending')->count(),
                'open_reports' => ProductReport::where('status', 'open')->count(),
            ],
            'sales' => $this->analytics->salesSeries(null, $from, $to),
            'status_breakdown' => $this->analytics->statusBreakdown(null, $from, $to),
            'best_sellers' => $this->analytics->bestSellers(null, $from, $to),
            'top_sellers' => $this->analytics->topSellers($from, $to),
            'low_stock' => $this->analytics->lowStock(null),
            'commission' => $this->analytics->commissionSummary(null),
            'recent_orders' => OrderResource::collection(
                Order::with('customer')->withCount('sellerOrders')->latest('placed_at')->limit(6)->get()
            ),
        ]);
    }

    public function report(Request $request)
    {
        $request->validate([
            'format' => ['required', 'in:csv,pdf'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'seller_id' => ['nullable', 'integer'],
        ]);
        [$from, $to] = AnalyticsService::range($request->from, $request->to);
        $sellerId = $request->integer('seller_id') ?: null;

        return $request->format === 'csv'
            ? $this->reports->salesCsv($sellerId, $from, $to)
            : $this->reports->salesPdf($sellerId, $from, $to, 'ShopSphere — Marketplace sales report');
    }

    public function auditLogs(Request $request): JsonResponse
    {
        $request->validate(['action' => ['nullable', 'string', 'max:80'], 'user_id' => ['nullable', 'integer']]);

        return response()->json(
            AuditLog::query()
                ->when($request->action, fn ($q, $a) => $q->where('action', 'like', "{$a}%"))
                ->when($request->user_id, fn ($q, $u) => $q->where('user_id', $u))
                ->with('user:id,name,email,role')
                ->latest('id')->paginate(30)->withQueryString()
        );
    }
}
