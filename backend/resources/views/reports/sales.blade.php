<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { font-size: 10px; color: #1f2937; }
        h1 { font-size: 18px; margin: 0; color: #4338ca; }
        .muted { color: #6b7280; }
        .kpis { width: 100%; margin: 14px 0; border-collapse: separate; border-spacing: 6px; }
        .kpis td { background: #eef2ff; padding: 8px; border-radius: 4px; }
        .kpis .v { font-size: 14px; font-weight: bold; }
        table.data { width: 100%; border-collapse: collapse; margin-top: 8px; }
        table.data th { background: #111827; color: #fff; text-align: left; padding: 5px; }
        table.data td { padding: 4px 5px; border-bottom: 1px solid #e5e7eb; }
        .r { text-align: right; }
        h2 { font-size: 12px; margin: 16px 0 4px; }
    </style>
</head>
<body>
    <h1>{{ $title }}</h1>
    <div class="muted">{{ $from->format('M j, Y') }} – {{ $to->format('M j, Y') }} · Generated {{ $generatedAt->format('M j, Y g:i A') }}</div>

    <table class="kpis">
        <tr>
            <td><div class="muted">Gross sales</div><div class="v">{{ $currency }} {{ number_format($kpis['gross_sales'], 2) }}</div></td>
            <td><div class="muted">Commission</div><div class="v">{{ $currency }} {{ number_format($kpis['commission'], 2) }}</div></td>
            <td><div class="muted">Seller earnings</div><div class="v">{{ $currency }} {{ number_format($kpis['net_earnings'], 2) }}</div></td>
            <td><div class="muted">Orders</div><div class="v">{{ $kpis['orders'] }}</div></td>
            <td><div class="muted">Avg. order value</div><div class="v">{{ $currency }} {{ number_format($kpis['average_order_value'], 2) }}</div></td>
        </tr>
    </table>

    @if (count($bestSellers))
        <h2>Best-selling products</h2>
        <table class="data">
            <tr><th>Product</th><th class="r">Units</th><th class="r">Revenue</th></tr>
            @foreach ($bestSellers as $p)
                <tr><td>{{ $p['name'] }}</td><td class="r">{{ $p['units'] }}</td><td class="r">{{ number_format($p['revenue'], 2) }}</td></tr>
            @endforeach
        </table>
    @endif

    <h2>Orders ({{ $orders->count() }})</h2>
    <table class="data">
        <tr>
            <th>Reference</th><th>Date</th><th>Store</th><th>Customer</th><th>Status</th>
            <th class="r">Items</th><th class="r">Subtotal</th><th class="r">Commission</th><th class="r">Earnings</th>
        </tr>
        @forelse ($orders as $so)
            <tr>
                <td>{{ $so->reference }}</td>
                <td>{{ $so->created_at->format('Y-m-d') }}</td>
                <td>{{ $so->seller->sellerProfile?->store_name }}</td>
                <td>{{ $so->order->customer?->name }}</td>
                <td>{{ ucfirst($so->status->value) }}</td>
                <td class="r">{{ $so->items_count }}</td>
                <td class="r">{{ number_format($so->subtotal, 2) }}</td>
                <td class="r">{{ number_format($so->commission_amount, 2) }}</td>
                <td class="r">{{ number_format($so->seller_earnings, 2) }}</td>
            </tr>
        @empty
            <tr><td colspan="9" class="muted">No orders in this period.</td></tr>
        @endforelse
    </table>
</body>
</html>
