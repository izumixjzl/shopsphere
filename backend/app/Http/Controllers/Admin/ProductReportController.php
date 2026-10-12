<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductReportResource;
use App\Models\ProductReport;
use App\Services\AuditLogger;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductReportController extends Controller
{
    private const RELATIONS = ['product.primaryImage', 'product.seller.sellerProfile', 'reporter', 'resolver'];

    public function __construct(
        private AuditLogger $audit,
        private NotificationService $notifications,
    ) {}

    public function index(Request $request)
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['open', 'resolved', 'dismissed'])],
        ]);

        $reports = ProductReport::query()
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->with(self::RELATIONS)
            ->latest()->paginate(20)->withQueryString();

        return ProductReportResource::collection($reports);
    }

    public function resolve(Request $request, ProductReport $report): ProductReportResource
    {
        abort_unless($report->status === 'open', 422, 'This report was already reviewed.');

        $data = $request->validate([
            'status' => ['required', Rule::in(['resolved', 'dismissed'])],
            'admin_note' => ['nullable', 'string', 'max:500'],
        ]);

        $report->forceFill($data + ['resolved_by' => $request->user()->id, 'resolved_at' => now()])->save();
        $this->audit->log('product_report.'.$data['status'], $report, ['status' => 'open'], $data);

        $name = $report->product?->name ?? 'a listing';
        $this->notifications->send($report->user_id, 'product_report.'.$data['status'], 'Your report was reviewed',
            $data['status'] === 'resolved'
                ? "Thanks — we took action on \"{$name}\" after reviewing your report."
                : "We reviewed your report about \"{$name}\" and found no rule violation.",
            ['product_report_id' => $report->id]);

        return new ProductReportResource($report->load(self::RELATIONS));
    }
}
