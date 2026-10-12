<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CommissionRecord;
use App\Models\Payout;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Money;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PayoutController extends Controller
{
    public function __construct(
        private AuditLogger $audit,
        private NotificationService $notifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate(['status' => ['nullable', Rule::in(['pending', 'processing', 'paid', 'failed'])]]);

        $payouts = Payout::query()
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->with('seller.sellerProfile:id,user_id,store_name')
            ->withCount('commissionRecords')
            ->latest()->paginate(20)->withQueryString();

        // Sellers with money ready to pay out.
        $payable = CommissionRecord::query()
            // Qualified columns: seller_profiles also has a `status` column.
            ->where('commission_records.status', 'payable')->whereNull('commission_records.payout_id')
            ->join('seller_profiles', 'seller_profiles.user_id', '=', 'commission_records.seller_id')
            ->groupBy('commission_records.seller_id', 'seller_profiles.store_name')
            ->selectRaw('commission_records.seller_id, seller_profiles.store_name, SUM(commission_records.net_amount) as amount, COUNT(*) as records')
            ->get();

        return response()->json(['payouts' => $payouts, 'payable_by_seller' => $payable]);
    }

    /** Bundle all payable commission records of a seller into one payout. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'seller_id' => ['required', 'integer', Rule::exists('users', 'id')->where('role', 'seller')],
            'method' => ['nullable', 'string', 'max:30'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $payout = DB::transaction(function () use ($data, $request) {
            $records = CommissionRecord::where('seller_id', $data['seller_id'])
                ->where('status', 'payable')->whereNull('payout_id')
                ->lockForUpdate()->get();

            if ($records->isEmpty()) {
                throw ValidationException::withMessages(['seller_id' => 'This seller has nothing payable yet.']);
            }

            $payout = Payout::create([
                'seller_id' => $data['seller_id'],
                'reference' => 'PO-'.now()->format('ymd').'-'.Str::upper(Str::random(5)),
                'amount' => Money::fromCents($records->sum(fn ($r) => Money::toCents($r->net_amount))),
                'status' => 'processing',
                'method' => $data['method'] ?? 'bank_transfer',
                'period_start' => $records->min('created_at')?->toDateString(),
                'period_end' => $records->max('created_at')?->toDateString(),
                'processed_by' => $request->user()->id,
                'notes' => $data['notes'] ?? null,
            ]);

            CommissionRecord::whereIn('id', $records->pluck('id'))->update(['payout_id' => $payout->id]);

            return $payout;
        });

        $this->audit->log('payout.created', $payout, [], $payout->only(['seller_id', 'amount']));

        return response()->json(['data' => $payout], 201);
    }

    public function markPaid(Request $request, Payout $payout): JsonResponse
    {
        if ($payout->status === 'paid') {
            throw ValidationException::withMessages(['status' => 'Payout already marked as paid.']);
        }

        DB::transaction(function () use ($payout) {
            $payout->update(['status' => 'paid', 'paid_at' => now()]);
            $payout->commissionRecords()->update(['status' => 'paid']);
        });

        $this->audit->log('payout.paid', $payout, [], ['amount' => $payout->amount]);
        $this->notifications->send($payout->seller_id, 'payout.paid', 'Payout sent',
            "Payout {$payout->reference} of ₱{$payout->amount} was sent.", ['payout_id' => $payout->id]);

        return response()->json(['data' => $payout->fresh()]);
    }

    public function sellers(): JsonResponse
    {
        return response()->json([
            'data' => User::where('role', 'seller')->with('sellerProfile:id,user_id,store_name')->get(['id', 'name']),
        ]);
    }
}
