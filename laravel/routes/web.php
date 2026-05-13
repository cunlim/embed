<?php

use App\Http\Controllers\Api\OAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/api/auth/{provider}/redirect', [OAuthController::class, 'redirect']);
Route::get('/api/auth/{provider}/callback', [OAuthController::class, 'callback'])->middleware('throttle:5,1');
