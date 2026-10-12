<?php

namespace App\Services;

use App\Models\CommissionRecord;
use App\Models\Inventory;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\SellerOrder;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Dashboard numbers. Every method accepts an optional seller id:
 * null = marketplace-wide (admin), int = one seller.
 * Revenue counts seller orders that were not cancelled or returned.
 */
class AnalyticsService
{
    private const EXCLUDED = ['cancelled', 'returned'];

    public function kpis(?int $sellerId, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $base = SellerOrder::query()
            ->when($sellerId, fn ($q) => $q->where('seller_id', $sellerId))
            ->whereBetween('created_at', [$from, $to]);

        $revenue = (clone $base)->whereNotIn('status', self::EXCLUDED);

        $days = (int) ceil($from->diffInDays($to));
        $prevFrom = $from->subDays(max($days, 1));
        $prevRevenue = SellerOrder::query()
            ->when($sellerId, fn ($q) => $q->where('seller_id', $sellerId))
            ->whereBetween('created_at', [$prevFrom, $from->subSecond()])
            ->whereNotIn('status', self::EXCLUDED)->sum('subtotal');

        $gross = (float) $revenue->sum('subtotal');

        return [
            'gross_sales' => round($gross, 2),
            'gross_sales_change_pct' => $prevRevenue > 0 ? round(($gross - $prevRevenue) / $prevRevenue * 100, 1) : null,
            'commission' => round((float) (clone $revenue)->sum('commission_amount'), 2),
            'net_earnings' => round((float) (clone $revenue)->sum('seller_earnings'), 2),
            'orders' => (clone $base)->count(),
            'pending_orders' => (clone $base)->whereIn('status', ['pending', 'confirmed', 'packed'])->count(),
            'cancelled_orders' => (clone $base)->where('status', 'cancelled')->count(),
            'average_order_value' => ($n = (clone $revenue)->count()) ? round($gross / $n, 2) : 0,
            'active_products' => Product::query()->when($sellerId, fn ($q) => $q->where('seller_id', $sellerId))->where('status', 'active')->count(),
            'low_stock_products' => Inventory::query()->lowStock()
                ->whereHas('product', fn ($q) => $q->when($sellerId, fn ($p) => $p->where('seller_id', $sellerId)))->count(),
        ];
    }

    /** Daily gross sales + order counts, zero-filled. */
    public function salesSeries(?int $sellerId, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $rows = SellerOrder::query()
            ->when($sellerId, fn ($q) => $q->where('seller_id', $sellerId))
            ->whereBetween('created_at', [$from, $to])
            ->whereNotIn('status', self::EXCLUDED)
            ->selectRaw('DATE(created_at) as day, SUM(subtotal) as sales, COUNT(*) as orders')
            ->groupBy('day')->get()->keyBy('day');

        $labels = $sales = $orders = [];
        for ($d = $from->startOfDay(); $d->lte($to); $d = $d->addDay()) {
            $key = $d->toDateString();
            $labels[] = $key;
            $sales[] = round((float) ($rows[$key]->sales ?? 0), 2);
            $orders[] = (int) ($rows[$key]->orders ?? 0);
        }

        return compact('labels', 'sales', 'orders');
    }

    public function statusBreakdown(?int $sellerId, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return SellerOrder::query()
            ->when($sellerId, fn ($q) => $q->where('seller_id', $sellerId))
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('status, COUNT(*) as total')->groupBy('status')
            ->pluck('total', 'status')->map(fn ($v) => (int) $v)->all();
    }

    public function bestSellers(?int $sellerId, CarbonImmutable $from, CarbonImmutable $to, int $limit = 5): array
    {
        return OrderItem::query()
            ->join('seller_orders', 'seller_orders.id', '=', 'order_items.seller_order_id')
            ->when($sellerId, fn ($q) => $q->where('order_items.seller_id', $sellerId))
            ->whereBetween('order_items.created_at', [$from, $to])
            ->whereNotIn('seller_orders.status', self::EXCLUDED)
            ->groupBy('order_items.product_id', 'order_items.product_name')
            ->selectRaw('order_items.product_id, order_items.product_name, SUM(order_items.quantity) as units, SUM(order_items.line_total) as revenue')
            ->orderByDesc('units')->limit($limit)->get()
            ->map(fn ($r) => [
                'product_id' => $r->product_id,
                'name' => $r->product_name,
                'units' => (int) $r->units,
                'revenue' => round((float) $r->revenue, 2),
            ])->all();
    }

    public function lowStock(?int $sellerId, int $limit = 10): array
    {
        return Inventory::query()->lowStock()
            ->whereHas('product', fn ($q) => $q->when($sellerId, fn ($p) => $p->where('seller_id', $sellerId)))
            ->with('product:id,name,sku,slug,seller_id')
            ->orderBy('quantity')->limit($limit)->get()
            ->map(fn ($i) => [
                'product_id' => $i->product_id,
                'name' => $i->product?->name,
                'sku' => $i->product?->sku,
                'quantity' => $i->quantity,
                'threshold' => $i->low_stock_threshold,
            ])->all();
    }

    public function commissionSummary(?int $sellerId): array
    {
        $rows = CommissionRecord::query()
            ->when($sellerId, fn ($q) => $q->where('seller_id', $sellerId))
            ->selectRaw('status, SUM(commission_amount) as commission, SUM(net_amount) as net, COUNT(*) as records')
            ->groupBy('status')->get()->keyBy('status');

        $out = [];
        foreach (['pending', 'payable', 'paid', 'reversed'] as $s) {
            $out[$s] = [
                'commission' => round((float) ($rows[$s]->commission ?? 0), 2),
                'net' => round((float) ($rows[$s]->net ?? 0), 2),
                'records' => (int) ($rows[$s]->records ?? 0),
            ];
        }

        return $out;
    }

    public static function range(?string $from, ?string $to, int $defaultDays = 30): array
    {
        $end = $to ? CarbonImmutable::parse($to)->endOfDay() : CarbonImmutable::now()->endOfDay();
        $start = $from ? CarbonImmutable::parse($from)->startOfDay() : $end->subDays($defaultDays - 1)->startOfDay();

        if ($start->gt($end)) {
            [$start, $end] = [$end->startOfDay(), $start->endOfDay()];
        }

        return [$start, $end];
    }

    /** Top sellers by gross sales (admin). */
    public function topSellers(CarbonImmutable $from, CarbonImmutable $to, int $limit = 5): array
    {
        return SellerOrder::query()
            ->join('seller_profiles', 'seller_profiles.user_id', '=', 'seller_orders.seller_id')
            ->whereBetween('seller_orders.created_at', [$from, $to])
            ->whereNotIn('seller_orders.status', self::EXCLUDED)
            ->groupBy('seller_orders.seller_id', 'seller_profiles.store_name')
            ->selectRaw('seller_orders.seller_id, seller_profiles.store_name, SUM(seller_orders.subtotal) as sales, SUM(seller_orders.commission_amount) as commission, COUNT(*) as orders')
            ->orderByDesc(DB::raw('SUM(seller_orders.subtotal)'))->limit($limit)->get()
            ->map(fn ($r) => [
                'seller_id' => $r->seller_id,
                'store_name' => $r->store_name,
                'sales' => round((float) $r->sales, 2),
                'commission' => round((float) $r->commission, 2),
                'orders' => (int) $r->orders,
            ])->all();
    }
}
