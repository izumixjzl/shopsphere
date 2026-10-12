<?php

namespace App\Http\Controllers\Admin;

use App\Enums\SellerStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\SellerProfileResource;
use App\Models\SellerProfile;
use App\Models\SellerVerification;
use App\Services\AuditLogger;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SellerController extends Controller
{
    public function __construct(
        private AuditLogger $audit,
        private NotificationService $notifications,
    ) {}

    public function index(Request $request)
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(SellerStatus::class)],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $sellers = SellerProfile::query()
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w
                ->where('store_name', 'like', "%{$t}%")
                ->orWhereHas('user', fn ($u) => $u->where('email', 'like', "%{$t}%"))))
            ->with(['user', 'verifications'])
            ->latest()->paginate(15)->withQueryString();

        return SellerProfileResource::collection($sellers);
    }

    public function show(SellerProfile $seller): SellerProfileResource
    {
        return new SellerProfileResource($seller->load(['user', 'verifications']));
    }

    public function approve(SellerProfile $seller): SellerProfileResource
    {
        return $this->setStatus($seller, SellerStatus::Approved, null,
            'Your store is approved', 'Congratulations! You can now list products and receive orders.');
    }

    public function reject(Request $request, SellerProfile $seller): SellerProfileResource
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        return $this->setStatus($seller, SellerStatus::Rejected, $data['reason'],
            'Seller application not approved', "Reason: {$data['reason']}. You may upload new documents and re-apply.");
    }

    public function suspend(Request $request, SellerProfile $seller): SellerProfileResource
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        return $this->setStatus($seller, SellerStatus::Suspended, $data['reason'],
            'Store suspended', "Your store was suspended: {$data['reason']}");
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

        return new SellerProfileResource($seller->load(['user', 'verifications']));
    }

    public function reviewVerification(Request $request, SellerVerification $verification)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected'])],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $verification->forceFill([
            'status' => $data['status'],
            'notes' => $data['notes'] ?? $verification->notes,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ])->save();

        $this->audit->log('seller.verification_reviewed', $verification, [], $data);

        return response()->json(['data' => $verification]);
    }

    /** Stream a private verification document to the admin. */
    public function downloadVerification(SellerVerification $verification): StreamedResponse
    {
        abort_unless(Storage::disk('local')->exists($verification->document_url), 404);

        return Storage::disk('local')->download($verification->document_url);
    }

    private function setStatus(SellerProfile $seller, SellerStatus $status, ?string $reason, string $title, string $message): SellerProfileResource
    {
        if ($seller->status === $status) {
            throw ValidationException::withMessages(['status' => "Seller is already {$status->value}."]);
        }

        $old = ['status' => $seller->status->value];

        $seller->forceFill([
            'status' => $status,
            'rejection_reason' => $status === SellerStatus::Approved ? null : $reason,
            'approved_at' => $status === SellerStatus::Approved ? now() : $seller->approved_at,
            'approved_by' => $status === SellerStatus::Approved ? request()->user()->id : $seller->approved_by,
        ])->save();

        $this->audit->log('seller.'.$status->value, $seller, $old, ['status' => $status->value, 'reason' => $reason]);
        $this->notifications->send($seller->user_id, 'seller.'.$status->value, $title, $message);

        return new SellerProfileResource($seller->load(['user', 'verifications']));
    }
}
