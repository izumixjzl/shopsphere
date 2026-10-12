<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** In-app notifications for any signed-in role. */
class NotificationController extends Controller
{
    public function index(Request $request, NotificationService $notifications): JsonResponse
    {
        $user = $request->user();
        $page = $user->appNotifications()
            ->when($request->boolean('unread'), fn ($q) => $q->whereNull('read_at'))
            ->latest()->paginate(15);

        // Notifications stored before links were saved get one derived on the fly.
        $items = collect($page->items())->each(function (Notification $n) use ($user, $notifications) {
            $data = $n->data ?? [];
            if (empty($data['url']) && ($url = $notifications->linkFor($user->role, $n->type, $data))) {
                $n->data = $data + ['url' => $url];
            }
        });

        return response()->json([
            'data' => $items,
            'unread_count' => $request->user()->appNotifications()->whereNull('read_at')->count(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage()],
        ]);
    }

    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        abort_unless($notification->user_id === $request->user()->id, 404);
        $notification->update(['read_at' => $notification->read_at ?? now()]);

        return response()->json(['message' => 'Marked as read.']);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->appNotifications()->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }
}
