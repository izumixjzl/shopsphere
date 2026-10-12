<?php

use Illuminate\Support\Facades\Route;

// Every non-API URL loads the React app; React Router handles the page from there.
Route::view('/{any?}', 'app')->where('any', '^(?!api|storage|up).*$');
