<?php

namespace App\Http\Controllers\Admin;

use App\Enums\SellerStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\SellerProfileResource;
use App\Models\SellerAppeal;
use App\Services\AuditLogger;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SellerAppealController extends Controller
{
    public function __construct(
        private AuditLogger $audit,
        private NotificationService $notifications,
    ) {}

    /** Accepting reinstates the store; denying keeps it suspended. Either way the seller is told why. */
    public function decide(Request $request, SellerAppeal $appeal): SellerProfileResource
    {
        abort_unless($appeal->status === 'open', 422, 'This appeal was already decided.');

        $data = $request->validate([
            'status' => ['required', Rule::in(['accepted', 'denied'])],
            'admin_note' => ['required_if:status,denied', 'nullable', 'string', 'max:500'],
        ]);

        $profile = $appeal->sellerProfile;

        DB::transaction(function () use ($appeal, $profile, $data, $request) {
            $appeal->forceFill([
                'status' => $data['status'],
                'admin_note' => $data['admin_note'] ?? null,
                'decided_by' => $request->user()->id,
                'decided_at' => now(),
            ])->save();

            $old = ['status' => $profile->status->value];
            if ($data['status'] === 'accepted' && $profile->status === SellerStatus::Suspended) {
                $profile->forceFill([
                    'status' => SellerStatus::Approved,
                    'rejection_reason' => null,
                    'suspended_at' => null,
                ])->save();
            }

            $this->audit->log('seller.appeal_'.$data['status'], $profile, $old,
                ['status' => $profile->status->value, 'appeal_id' => $appeal->id, 'admin_note' => $data['admin_note'] ?? null]);
        });

        $note = filled($data['admin_note'] ?? null) ? " Note from our team: {$data['admin_note']}" : '';
        $this->notifications->send($profile->user_id, 'seller.appeal_'.$data['status'],
            $data['status'] === 'accepted' ? 'Appeal accepted' : 'Appeal denied',
            ($data['status'] === 'accepted'
                ? 'Your store is reinstated. Your listings are back in the shop.'
                : 'Your store stays suspended.').$note,
            ['seller_appeal_id' => $appeal->id]);

        return new SellerProfileResource($profile->fresh(['user', 'verifications', 'appeals.decider']));
    }
}
