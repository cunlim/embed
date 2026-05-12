<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\BatchTranslateRequest;
use App\Http\Requests\CategoryStoreRequest;
use App\Http\Resources\CategoryCollection;
use App\Http\Resources\CategoryResource;
use App\Jobs\BatchTranslatePipeline;
use App\Jobs\TranslateAndEmbedJob;
use App\Models\Category;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(): CategoryCollection
    {
        return new CategoryCollection(Category::query()->get());
    }

    public function store(CategoryStoreRequest $request): CategoryResource
    {
        $category = Category::create([
            'category_code' => Category::generateCode(),
            'category_name_ko' => $request->category_name_ko,
        ]);

        // zh, en 언어별 번역 Job dispatch
        foreach (['zh', 'en'] as $lang) {
            TranslateAndEmbedJob::dispatch($category->id, $lang);
        }

        return new CategoryResource($category);
    }

    public function show(Category $category): CategoryResource
    {
        return new CategoryResource($category);
    }

    public function batchTranslate(BatchTranslateRequest $request): JsonResponse
    {
        BatchTranslatePipeline::dispatch($request->target_language);

        return response()->json([
            'message' => '일괄 번역이 시작되었습니다.',
            'target_language' => $request->target_language,
        ], 202);
    }
}
