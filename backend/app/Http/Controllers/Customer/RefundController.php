<?php

namespace App\Http\Controllers\Customer;

use App\Enums\SellerOrderStatus;
use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\Refund;
use App\Services\AuditLogger;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

/** Return / refund / dispute requests raised by customers on delivered items. */
class RefundController extends Controller
{
    public const RETURN_WINDOW_DAYS = 7;

    public function __construct(
        private NotificationService $notifications,
        private AuditLogger $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => Refund::where('user_id', $request->user()->id)
                ->with([
                    'orderItem:id,product_name,product_image_url,quantity,unit_price', 'order:id,order_number', 'attachments',
                    'sellerOrder:id,reference,seller_id', 'sellerOrder.seller:id', 'sellerOrder.seller.sellerProfile:id,user_id,store_name,store_slug',
                ])
                ->latest()->get(),
        ]);
    }

    public function store(Request $request, OrderItem $orderItem): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['return', 'refund', 'dispute'])],
            'reason' => ['required', 'string', 'max:120'],
            'details' => ['nullable', 'string', 'max:2000'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'evidence' => [
                Rule::requiredIf(in_array($request->input('reason'), config('marketplace.evidence_required_reasons'), true)),
                'array', 'max:'.config('marketplace.max_evidence_files'),
            ],
            'evidence.*' => ['file', 'mimes:jpg,jpeg,png,webp,mp4,mov,webm', 'max:'.config('marketplace.max_evidence_kb')],
        ], [
            'evidence.required' => 'Please attach at least one photo or video showing the problem.',
            'evidence.*.mimes' => 'Proof must be a photo (JPG, PNG, WebP) or video (MP4, MOV, WebM).',
            'evidence.*.max' => 'Each file must be '.(config('marketplace.max_evidence_kb') / 1024).' MB or smaller.',
            'evidence.*.uploaded' => 'A file failed to upload. It may be larger than the server allows.',
        ]);

        $orderItem->load(['order', 'sellerOrder']);
        abort_unless($orderItem->order->user_id === $request->user()->id, 404);

        $so = $orderItem->sellerOrder;
        if ($so->status !== SellerOrderStatus::Delivered) {
            throw ValidationException::withMessages(['order_item' => 'Requests can be filed after the item is delivered.']);
        }
        if ($so->delivered_at && $so->delivered_at->lt(now()->subDays(self::RETURN_WINDOW_DAYS))) {
            throw ValidationException::withMessages(['order_item' => 'The '.self::RETURN_WINDOW_DAYS.'-day request window has closed.']);
        }
        if (Refund::where('order_item_id', $orderItem->id)->whereIn('status', ['requested', 'approved'])->exists()) {
            throw ValidationException::withMessages(['order_item' => 'There is already an open request for this item.']);
        }

        $qty = min($data['quantity'] ?? $orderItem->quantity, $orderItem->quantity);

        // Store proof files first; if saving the request fails, remove them again.
        $disk = config('marketplace.evidence_disk');
        $stored = [];
        try {
            foreach ($request->file('evidence', []) as $file) {
                $stored[] = [
                    'disk' => $disk,
                    'path' => $file->store("refund-evidence/{$orderItem->order_id}", $disk),
                    'mime_type' => $file->getMimeType(),
                    'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
                    'size' => $file->getSize(),
                ];
            }

            $refund = DB::transaction(function () use ($orderItem, $so, $request, $data, $qty, $stored) {
                $refund = Refund::create([
                    'order_id' => $orderItem->order_id,
                    'seller_order_id' => $so->id,
                    'order_item_id' => $orderItem->id,
                    'user_id' => $request->user()->id,
                    'type' => $data['type'],
                    'reason' => $data['reason'],
                    'details' => $data['details'] ?? null,
                    'amount' => number_format((float) $orderItem->unit_price * $qty, 2, '.', ''),
                    'status' => 'requested',
                ]);
                $refund->attachments()->createMany($stored);

                return $refund;
            });
        } catch (Throwable $e) {
            foreach ($stored as $s) {
                Storage::disk($s['disk'])->delete($s['path']);
            }
            throw $e;
        }

        $this->audit->log('refund.requested', $refund, [], $refund->only(['type', 'amount']));
        $this->notifications->send($so->seller_id, 'refund.requested', ucfirst($data['type']).' request',
            "A customer filed a {$data['type']} request for {$orderItem->product_name}: {$data['reason']}. Please review it.", ['refund_id' => $refund->id]);

        return response()->json(['data' => $refund->load('attachments')], 201);
    }
}
