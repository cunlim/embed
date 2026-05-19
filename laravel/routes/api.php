<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\RecommendController;
use App\Http\Controllers\Api\TestController;
use Illuminate\Support\Facades\Route;

Route::get('health', [TestController::class, 'health']);

// auth
Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('auth/user', [AuthController::class, 'user'])->middleware('auth:sanctum');

// 카테고리
Route::get('categories', [CategoryController::class, 'index']);
Route::post('categories', [CategoryController::class, 'store'])->middleware('auth:sanctum');
Route::delete('categories/{category}', [CategoryController::class, 'destroy'])->middleware('auth:sanctum');
Route::get('categories/{category}', [CategoryController::class, 'show']);

// 일괄 번역/임베딩
Route::post('categories/{category}/run-step', [CategoryController::class, 'runStep'])->middleware('auth:sanctum');
Route::put('categories/{category}/update-text', [CategoryController::class, 'updateText'])->middleware('auth:sanctum');

// 개별 카테고리 번역/임베딩 조회
Route::get('categories/{category}/translations', [CategoryController::class, 'translations'])->middleware('auth:sanctum');

// 추천
Route::post('recommend', [RecommendController::class, 'recommend']);
