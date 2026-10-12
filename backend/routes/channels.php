<?php

use Illuminate\Support\Facades\Broadcast;

// Each user listens only to their own notification stream.
Broadcast::channel('App.Models.User.{id}', fn ($user, $id) => (int) $user->id === (int) $id);
