<?php

namespace App\Http\Controllers\Customer;

use App\Enums\SellerOrderStatus;
use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Review;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReviewController extends Controller
{
    public function __construct(private NotificationService $notifications) {}

    /** Only delivered purchases can be reviewed — one review per order item. */
    public function store(Request $request, OrderItem $orderItem): JsonResponse
    {
        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'title' => ['nullable', 'string', 'max:120'],
            'body' => ['nullable', 'string', 'max:2000'],
        ]);

        $orderItem->load(['order', 'sellerOrder', 'review']);

        abort_unless($orderItem->order->user_id === $request->user()->id, 404);

        if ($orderItem->sellerOrder->status !== SellerOrderStatus::Delivered) {
            throw ValidationException::withMessages(['order_item' => 'You can review this item once it has been delivered.']);
        }
        if ($orderItem->review) {
            throw ValidationException::withMessages(['order_item' => 'You already reviewed this purchase.']);
        }
        if (! $orderItem->product_id) {
            throw ValidationException::withMessages(['order_item' => 'This product is no longer listed.']);
        }

        $review = DB::transaction(function () use ($orderItem, $request, $data) {
            $review = Review::create([
                ...$data,
                'product_id' => $orderItem->product_id,
                'user_id' => $request->user()->id,
                'order_item_id' => $orderItem->id,
                'is_visible' => true,
            ]);
            $this->refreshRating($orderItem->product_id);

            return $review;
        });

        $this->notifications->send(
            $orderItem->seller_id, 'review.new', 'New review',
            "{$orderItem->product_name} received a {$data['rating']}-star review.",
            ['product_id' => $orderItem->product_id],
        );

        return response()->json(['data' => $review], 201);
    }

    public static function refreshRating(int $productId): void
    {
        $agg = Review::where('product_id', $productId)->where('is_visible', true)
            ->selectRaw('COUNT(*) as c, COALESCE(AVG(rating),0) as a')->first();

        Product::withTrashed()->whereKey($productId)->update([
            'rating_count' => (int) $agg->c,
            'rating_avg' => round((float) $agg->a, 2),
        ]);
    }
}
