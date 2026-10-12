<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Refund;
use App\Services\AuditLogger;
use App\Services\InventoryService;
use App\Services\Money;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Disputes, returns and refunds — resolved by the super admin. */
class RefundController extends Controller
{
    public function __construct(
        private AuditLogger $audit,
        private NotificationService $notifications,
        private InventoryService $inventory,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', Rule::in(['requested', 'approved', 'rejected', 'refunded'])],
            'type' => ['nullable', Rule::in(['return', 'refund', 'dispute'])],
        ]);

        $refunds = Refund::query()
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->with(['order:id,order_number', 'sellerOrder:id,reference,seller_id', 'orderItem:id,product_name,quantity,unit_price', 'customer:id,name,email'])
            ->latest()->paginate(20)->withQueryString();

        return response()->json($refunds);
    }

    public function decide(Request $request, Refund $refund): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'resolution_note' => ['nullable', 'string', 'max:500'],
        ]);

        if ($refund->status !== 'requested') {
            throw ValidationException::withMessages(['status' => 'This request was already decided.']);
        }

        $refund->forceFill([
            'status' => $data['decision'],
            'resolution_note' => $data['resolution_note'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ])->save();

        $this->audit->log('refund.'.$data['decision'], $refund, ['status' => 'requested'], $data);
        $this->notifications->send($refund->user_id, 'refund.'.$data['decision'],
            ucfirst($refund->type).' request '.$data['decision'],
            $data['resolution_note'] ?? "Your {$refund->type} request was {$data['decision']}.",
            ['refund_id' => $refund->id]);

        return response()->json(['data' => $refund]);
    }

    /** Simulated refund: records a refund payment and restocks returned items. */
    public function markRefunded(Request $request, Refund $refund): JsonResponse
    {
        if ($refund->status !== 'approved') {
            throw ValidationException::withMessages(['status' => 'Only approved requests can be refunded.']);
        }

        DB::transaction(function () use ($request, $refund) {
            $refund->forceFill(['status' => 'refunded', 'refunded_at' => now()])->save();

            Payment::create([
                'order_id' => $refund->order_id,
                'method' => 'manual_refund',
                'amount' => '-'.$refund->amount,
                'status' => 'refunded',
                'paid_at' => now(),
                'recorded_by' => $request->user()->id,
                'meta' => ['refund_id' => $refund->id, 'simulated' => true],
            ]);

            if ($refund->type === 'return' && $refund->order_item_id) {
                $item = $refund->orderItem()->first();
                if ($item?->product_id) {
                    $qty = max(1, (int) round(Money::toCents($refund->amount) / max(1, Money::toCents($item->unit_price))));
                    $this->inventory->restock($item->product_id, min($qty, $item->quantity));
                }
            }

            $order = $refund->order()->first();
            $refunded = -1 * (float) Payment::where('order_id', $order->id)->where('status', 'refunded')->sum('amount');
            $order->update(['payment_status' => $refunded >= (float) $order->grand_total ? 'refunded' : 'partially_refunded']);
        });

        $this->audit->log('refund.paid', $refund, [], ['amount' => $refund->amount]);
        $this->notifications->send($refund->user_id, 'refund.paid', 'Refund sent', "₱{$refund->amount} has been refunded to you.");

        return response()->json(['data' => $refund->fresh()]);
    }
}
