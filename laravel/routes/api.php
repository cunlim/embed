<?php

use App\Http\Controllers\Api\TestController;
use Illuminate\Support\Facades\Route;

Route::get('health', [TestController::class, 'health']);
