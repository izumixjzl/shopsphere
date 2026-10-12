<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductReport;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductReportController extends Controller
{
    public function __construct(private NotificationService $notifications) {}

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

        return response()->json(['message' => 'Thanks for the report. Our team will review this listing.'], 201);
    }
}
