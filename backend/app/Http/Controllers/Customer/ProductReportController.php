<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductReport;
use App\Services\AuditLogger;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductReportController extends Controller
{
    public function __construct(
        private AuditLogger $audit,
        private NotificationService $notifications,
    ) {}

    public function store(Request $request, Product $product): JsonResponse
    {
        abort_unless(Product::visible()->whereKey($product->id)->exists(), 404);

        $data = $request->validate([
            'reason' => ['required', Rule::in(array_keys(ProductReport::REASONS))],
            'details' => ['required_if:reason,other', 'nullable', 'string', 'max:1000'],
        ]);

        $alreadyOpen = ProductReport::where('product_id', $product->id)
            ->where('user_id', $request->user()->id)->where('status', 'open')->exists();
        if ($alreadyOpen) {
            throw ValidationException::withMessages(['reason' => "You've already reported this listing. Our team is reviewing it."]);
        }

        $report = ProductReport::create($data + ['product_id' => $product->id, 'user_id' => $request->user()->id]);

        $this->notifications->sendToAdmins('product_report.new', 'Listing reported',
            "\"{$product->name}\" was reported: ".ProductReport::REASONS[$data['reason']].'.',
            ['product_report_id' => $report->id, 'product_id' => $product->id]);

        $this->autoFlagIfWidelyReported($product);

        return response()->json(['message' => 'Thanks for the report. Our team will review this listing.'], 201);
    }

    /**
     * Several independent reporters is a strong enough signal to hide the listing
     * until an admin looks at it. Admins restore it from the Reports or Listings page.
     */
    private function autoFlagIfWidelyReported(Product $product): void
    {
        $threshold = (int) config('marketplace.auto_flag_report_threshold');
        if ($threshold < 1 || $product->moderation_status !== 'approved') {
            return;
        }

        $reporters = ProductReport::where('product_id', $product->id)->where('status', 'open')
            ->distinct()->count('user_id');
        if ($reporters < $threshold) {
            return;
        }

        $note = "Hidden automatically after {$reporters} customer reports. An administrator will review it.";
        $product->forceFill(['moderation_status' => 'flagged', 'moderation_note' => $note])->save();
        $this->audit->log('product.auto_flagged', $product, ['moderation_status' => 'approved'], ['moderation_status' => 'flagged', 'reports' => $reporters]);

        $this->notifications->send($product->seller_id, 'product.flagged', 'Listing hidden for review',
            "\"{$product->name}\" was reported by several customers and is hidden until an administrator reviews it.",
            ['product_id' => $product->id]);
        $this->notifications->sendToAdmins('product_report.auto_flagged', 'Listing auto-hidden',
            "\"{$product->name}\" reached {$reporters} open reports and was hidden pending review.",
            ['product_id' => $product->id]);
    }
}
