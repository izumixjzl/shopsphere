<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Usage: ->middleware('role:seller') or 'role:admin,seller' */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        if (! $user->isActive()) {
            return response()->json(['message' => 'Your account is suspended.'], 403);
        }
        if (! in_array($user->role->value, $roles, true)) {
            return response()->json(['message' => 'You do not have access to this area.'], 403);
        }

        return $next($request);
    }
}
