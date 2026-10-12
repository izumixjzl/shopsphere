<?php

namespace App\Services;

use App\Models\SellerOrder;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Sales reports as CSV (streamed) or PDF, for one seller or the whole marketplace. */
class ReportService
{
    public function __construct(private AnalyticsService $analytics) {}

    public function salesCsv(?int $sellerId, CarbonImmutable $from, CarbonImmutable $to): StreamedResponse
    {
        $filename = 'shopsphere-sales-'.$from->toDateString().'-to-'.$to->toDateString().'.csv';

        return response()->streamDownload(function () use ($sellerId, $from, $to) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Reference', 'Order #', 'Date', 'Store', 'Customer', 'Status', 'Items', 'Subtotal', 'Shipping', 'Commission rate %', 'Commission', 'Seller earnings']);

            $this->query($sellerId, $from, $to)->chunkById(500, function ($chunk) use ($out) {
                foreach ($chunk as $so) {
                    fputcsv($out, [
                        $so->reference,
                        $so->order->order_number,
                        $so->created_at->format('Y-m-d H:i'),
                        $so->seller->sellerProfile?->store_name,
                        $so->order->customer?->name,
                        $so->status->value,
                        $so->items_count,
                        $so->subtotal,
                        $so->shipping_fee,
                        $so->commission_rate,
                        $so->commission_amount,
                        $so->seller_earnings,
                    ]);
                }
            });

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function salesPdf(?int $sellerId, CarbonImmutable $from, CarbonImmutable $to, string $title): Response
    {
        $orders = $this->query($sellerId, $from, $to)->limit(2000)->get();

        $pdf = Pdf::loadView('reports.sales', [
            'title' => $title,
            'from' => $from,
            'to' => $to,
            'orders' => $orders,
            'kpis' => $this->analytics->kpis($sellerId, $from, $to),
            'bestSellers' => $this->analytics->bestSellers($sellerId, $from, $to, 10),
            'generatedAt' => now(),
            'currency' => config('marketplace.currency'),
        ])->setPaper('a4', 'landscape');

        return $pdf->download('shopsphere-sales-'.$from->toDateString().'-to-'.$to->toDateString().'.pdf');
    }

    private function query(?int $sellerId, CarbonImmutable $from, CarbonImmutable $to)
    {
        return SellerOrder::query()
            ->when($sellerId, fn ($q) => $q->where('seller_id', $sellerId))
            ->whereBetween('created_at', [$from, $to])
            ->with(['order.customer', 'seller.sellerProfile'])
            ->withCount('items')
            ->orderBy('id');
    }
}
