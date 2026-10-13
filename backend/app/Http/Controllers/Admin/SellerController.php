<?php

namespace App\Http\Controllers\Admin;

use App\Enums\SellerOrderStatus;
use App\Enums\SellerStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\SellerProfileResource;
use App\Models\AuditLog;
use App\Models\Product;
use App\Models\ProductReport;
use App\Models\SellerOrder;
use App\Models\SellerProfile;
use App\Models\SellerVerification;
use App\Services\AuditLogger;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SellerController extends Controller
{
    private const RELATIONS = ['user', 'verifications', 'appeals.decider'];

    public function __construct(
        private AuditLogger $audit,
        private NotificationService $notifications,
    ) {}

    public function index(Request $request)
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(SellerStatus::class)],
            'appeal' => ['nullable', Rule::in(['open'])],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $sellers = SellerProfile::query()
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($filters['appeal'] ?? null, fn ($q, $s) => $q->whereHas('appeals', fn ($a) => $a->where('status', $s)))
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w
                ->where('store_name', 'like', "%{$t}%")
                ->orWhereHas('user', fn ($u) => $u->where('email', 'like', "%{$t}%"))))
            ->with(self::RELATIONS)
            ->latest()->paginate(15)->withQueryString();

        return SellerProfileResource::collection($sellers);
    }

    public function show(SellerProfile $seller): SellerProfileResource
    {
        return new SellerProfileResource($seller->load(self::RELATIONS));
    }

    /** Signals an admin weighs before approving, suspending or reinstating a store. */
    public function trust(SellerProfile $seller): JsonResponse
    {
        $sellerId = $seller->user_id;

        $reports = ProductReport::query()
            ->whereIn('product_id', Product::withTrashed()->where('seller_id', $sellerId)->select('id'))
            ->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');

        $listings = Product::withTrashed()->where('seller_id', $sellerId)
            ->selectRaw('moderation_status, COUNT(*) as total')->groupBy('moderation_status')->pluck('total', 'moderation_status');

        $orders = SellerOrder::where('seller_id', $sellerId)
            ->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');

        $history = AuditLog::query()
            ->where('auditable_type', $seller->getMorphClass())->where('auditable_id', $seller->id)
            ->where('action', 'like', 'seller.%')
            ->where('action', '!=', 'seller.profile_updated')
            ->with('user:id,name,role')
            ->latest('id')->limit(50)->get();

        return response()->json([
            'rating' => ['avg' => (float) $seller->rating_avg, 'count' => (int) $seller->rating_count],
            'reports' => [
                'open' => (int) ($reports['open'] ?? 0),
                'upheld' => (int) ($reports['resolved'] ?? 0),
                'dismissed' => (int) ($reports['dismissed'] ?? 0),
            ],
            'listings' => [
                'approved' => (int) ($listings['approved'] ?? 0),
                'flagged' => (int) ($listings['flagged'] ?? 0),
                'removed' => (int) ($listings['removed'] ?? 0),
            ],
            'orders' => [
                'delivered' => (int) ($orders[SellerOrderStatus::Delivered->value] ?? 0),
                'cancelled' => (int) ($orders[SellerOrderStatus::Cancelled->value] ?? 0),
                'total' => (int) $orders->sum(),
            ],
            'suspensions' => $history->where('action', 'seller.suspended')->count(),
            'history' => $history->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'reason' => $log->new_values['reason'] ?? $log->new_values['admin_note'] ?? null,
                'by' => $log->user?->only(['id', 'name', 'role']),
                'created_at' => $log->created_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    /** Approves a new/rejected application, or reinstates a suspended store. */
    public function approve(SellerProfile $seller): SellerProfileResource
    {
        $reinstating = $seller->status === SellerStatus::Suspended;

        // New stores must have at least one document an admin has checked.
        if (! $reinstating && ! $seller->verifications()->where('status', 'approved')->exists()) {
            throw ValidationException::withMessages(['status' => 'Accept at least one verification document before approving this store.']);
        }

        if (! $reinstating) {
            return $this->setStatus($seller, SellerStatus::Approved, null,
                'Your store is approved', 'Congratulations! You can now list products and receive orders.');
        }

        // A direct reinstatement answers any appeal still waiting.
        $seller->appeals()->where('status', 'open')->update([
            'status' => 'accepted',
            'admin_note' => 'Store reinstated by an administrator.',
            'decided_by' => request()->user()->id,
            'decided_at' => now(),
        ]);

        return $this->setStatus($seller, SellerStatus::Approved, null,
            'Your store is reinstated', 'Your store is active again. Your listings are back in the shop.', 'seller.reinstated');
    }

    public function reject(Request $request, SellerProfile $seller): SellerProfileResource
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        if ($seller->status !== SellerStatus::Pending) {
            throw ValidationException::withMessages(['status' => 'Only pending applications can be rejected.']);
        }

        return $this->setStatus($seller, SellerStatus::Rejected, $data['reason'],
            'Seller application not approved', "Reason: {$data['reason']}. You may upload new documents and re-apply.");
    }

    public function suspend(Request $request, SellerProfile $seller): SellerProfileResource
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        if ($seller->status !== SellerStatus::Approved) {
            throw ValidationException::withMessages(['status' => 'Only approved stores can be suspended.']);
        }

        return $this->setStatus($seller, SellerStatus::Suspended, $data['reason'],
            'Store suspended', "Your store was suspended: {$data['reason']}. You can appeal this decision from your seller dashboard.");
    }

    /** Per-seller commission override (null resets to the marketplace default). */
    public function updateCommission(Request $request, SellerProfile $seller): SellerProfileResource
    {
        $data = $request->validate(['commission_rate' => ['nullable', 'numeric', 'between:0,50']]);

        $old = ['commission_rate' => $seller->commission_rate];
        $seller->forceFill(['commission_rate' => $data['commission_rate']])->save();
        $this->audit->log('seller.commission_updated', $seller, $old, $data);

        $this->notifications->send($seller->user_id, 'seller.commission_updated', 'Commission rate updated',
            'Your commission rate is now '.$seller->effectiveCommissionRate().'% for new orders.');

        return new SellerProfileResource($seller->load(self::RELATIONS));
    }

    public function reviewVerification(Request $request, SellerVerification $verification)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected'])],
            'notes' => ['required_if:status,rejected', 'nullable', 'string', 'max:500'],
        ]);

        $verification->forceFill([
            'status' => $data['status'],
            'notes' => $data['notes'] ?? $verification->notes,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ])->save();

        $profile = $verification->sellerProfile;
        $this->audit->log('seller.verification_'.$data['status'], $profile, [], ['document_type' => $verification->document_type, 'reason' => $data['notes'] ?? null]);

        $label = str_replace('_', ' ', $verification->document_type);
        $this->notifications->send($profile->user_id, 'seller.verification_'.$data['status'],
            $data['status'] === 'approved' ? 'Document accepted' : 'Document not accepted',
            $data['status'] === 'approved'
                ? "Your {$label} was accepted."
                : "Your {$label} was not accepted: {$data['notes']}. Please upload a new one.");

        return response()->json(['data' => $verification]);
    }

    /** Stream a private verification document to the admin. */
    public function downloadVerification(SellerVerification $verification): StreamedResponse
    {
        abort_unless(Storage::disk('local')->exists($verification->document_url), 404);

        return Storage::disk('local')->download($verification->document_url);
    }

    private function setStatus(SellerProfile $seller, SellerStatus $status, ?string $reason, string $title, string $message, ?string $action = null): SellerProfileResource
    {
        if ($seller->status === $status) {
            throw ValidationException::withMessages(['status' => "Seller is already {$status->value}."]);
        }

        $old = ['status' => $seller->status->value];
        $action ??= 'seller.'.$status->value;

        $seller->forceFill([
            'status' => $status,
            'rejection_reason' => $status === SellerStatus::Approved ? null : $reason,
            'approved_at' => $status === SellerStatus::Approved ? now() : $seller->approved_at,
            'approved_by' => $status === SellerStatus::Approved ? request()->user()->id : $seller->approved_by,
            'suspended_at' => $status === SellerStatus::Suspended ? now() : ($status === SellerStatus::Approved ? null : $seller->suspended_at),
        ])->save();

        $this->audit->log($action, $seller, $old, ['status' => $status->value, 'reason' => $reason]);
        $this->notifications->send($seller->user_id, $action, $title, $message);

        return new SellerProfileResource($seller->load(self::RELATIONS));
    }
}
