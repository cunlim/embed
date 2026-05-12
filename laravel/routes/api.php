<?php

use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\RecommendController;
use App\Http\Controllers\Api\TestController;
use Illuminate\Support\Facades\Route;

Route::get('health', [TestController::class, 'health']);

// 카테고리
Route::get('categories', [CategoryController::class, 'index']);
Route::post('categories', [CategoryController::class, 'store']);
Route::get('categories/{category}', [CategoryController::class, 'show']);

// 일괄 번역/임베딩
Route::post('categories/batch-translate', [CategoryController::class, 'batchTranslate']);

// 추천
Route::post('recommend', [RecommendController::class, 'recommend']);
