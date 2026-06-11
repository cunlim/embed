<?php

use App\Http\Controllers\Api\AdminSettingsController;
use App\Http\Controllers\Api\ApiController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\FolderController;
use App\Http\Controllers\Api\MyPageController;
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
Route::get('categories/levels', [CategoryController::class, 'levels']);
Route::get('categories/bulk-download', [CategoryController::class, 'bulkDownload'])->middleware('auth:sanctum');
Route::post('categories', [CategoryController::class, 'store'])->middleware('auth:sanctum');
Route::post('categories/bulk-upload', [CategoryController::class, 'bulkUpload'])->middleware('auth:sanctum');
Route::delete('categories/{category}', [CategoryController::class, 'destroy'])->middleware('auth:sanctum');
Route::get('categories/{category}', [CategoryController::class, 'show']);

// 일괄 번역/임베딩
Route::post('categories/batch-status', [CategoryController::class, 'batchStatus'])->middleware('auth:sanctum');
Route::post('categories/batch-run', [CategoryController::class, 'batchRun'])->middleware('auth:sanctum');
Route::post('categories/batch-run-stream', [CategoryController::class, 'batchRunStream'])->middleware('auth:sanctum');
Route::post('categories/{category}/run-step', [CategoryController::class, 'runStep'])->middleware('auth:sanctum');
Route::put('categories/{category}/update-text', [CategoryController::class, 'updateText'])->middleware('auth:sanctum');

// 개별 카테고리 번역/임베딩 조회
Route::get('categories/{category}/translations', [CategoryController::class, 'translations']);

// 추천
Route::post('recommend', [RecommendController::class, 'recommend']);

// 폴더 (인증 필요)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('folders', [FolderController::class, 'index']);
    Route::post('folders', [FolderController::class, 'store']);
    Route::put('folders/{folderName}', [FolderController::class, 'update']);
    Route::delete('folders/{folderName}', [FolderController::class, 'destroy']);
    Route::get('folders/{folderName}/has-categories', [FolderController::class, 'hasCategories']);
    Route::post('categories/move-folder', [FolderController::class, 'moveFolder']);
});

// 마이페이지 (인증 필요)
Route::middleware('auth:sanctum')->prefix('mypage')->group(function () {
    Route::get('api-keys', [MyPageController::class, 'apiKeys']);
    Route::post('api-keys', [MyPageController::class, 'storeApiKey']);
    Route::patch('api-keys/{id}', [MyPageController::class, 'updateApiKey']);
    Route::delete('api-keys/{id}', [MyPageController::class, 'destroyApiKey']);
    Route::get('usage', [MyPageController::class, 'usage']);
    Route::get('usage/history', [MyPageController::class, 'usageHistory']);
    Route::get('usage/chart', [MyPageController::class, 'usageChart']);
});

// 관리자 설정 (superadmin only)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('admin/settings', [AdminSettingsController::class, 'index']);
    Route::put('admin/settings', [AdminSettingsController::class, 'update']);
    Route::get('admin/users', [AdminSettingsController::class, 'users']);
    Route::get('admin/users/{id}', [AdminSettingsController::class, 'userDetail']);
    Route::patch('admin/users/{id}/quota', [AdminSettingsController::class, 'adjustQuota']);
});

// API v1 (API 키 인증 + 속도 제한)
Route::prefix('v1')->middleware(['api.rate_limit', 'api.key_auth'])->group(function () {
    Route::post('search', [ApiController::class, 'search']);
});
