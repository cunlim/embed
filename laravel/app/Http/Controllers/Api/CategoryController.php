<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\BatchTranslateRequest;
use App\Http\Requests\CategoryStoreRequest;
use App\Http\Resources\CategoryCollection;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\CategoryTranslationsResource;
use App\Jobs\BatchTranslatePipeline;
use App\Jobs\CategoryTranslateEmbedPipeline;
use App\Jobs\TranslateAndEmbedJob;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use OpenApi\Attributes as OA;

class CategoryController extends Controller
{
    #[OA\Get(
        path: '/api/categories',
        summary: '카테고리 목록 조회',
        description: '등록된 모든 카테고리를 조회합니다.',
        tags: ['Categories'],
        responses: [
            new OA\Response(
                response: 200,
                description: '카테고리 목록',
                content: new OA\JsonContent(
                    type: 'object',
                    properties: [
                        new OA\Property(property: 'data', type: 'array', items: new OA\Items(
                            properties: [
                                new OA\Property(property: 'id', type: 'integer'),
                                new OA\Property(property: 'category_code', type: 'string'),
                                new OA\Property(property: 'category_name_ko', type: 'string'),
                                new OA\Property(property: 'category_name_zh', type: 'string', nullable: true),
                                new OA\Property(property: 'category_name_en', type: 'string', nullable: true),
                            ]
                        )),
                    ]
                )
            ),
        ]
    )]
    public function index(): CategoryCollection
    {
        return new CategoryCollection(Category::query()->with('embeddings')->get());
    }

    #[OA\Post(
        path: '/api/categories',
        summary: '카테고리 생성',
        description: '카테고리를 생성하고 번역을 예약합니다.',
        tags: ['Categories'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['category_name_ko'],
                properties: [
                    new OA\Property(property: 'category_name_ko', type: 'string', maxLength: 255),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: '카테고리 생성 성공',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'data', properties: [
                            new OA\Property(property: 'id', type: 'integer'),
                            new OA\Property(property: 'category_code', type: 'string'),
                            new OA\Property(property: 'category_name_ko', type: 'string'),
                            new OA\Property(property: 'category_name_zh', type: 'string', nullable: true),
                            new OA\Property(property: 'category_name_en', type: 'string', nullable: true),
                        ], type: 'object'),
                    ]
                )
            ),
            new OA\Response(
                response: 422,
                description: '입력값 검증 실패',
            ),
            new OA\Response(
                response: 401,
                description: '인증 필요',
            ),
        ]
    )]
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

    #[OA\Get(
        path: '/api/categories/{category}',
        summary: '카테고리 상세 조회',
        description: '특정 카테고리의 상세 정보를 조회합니다.',
        tags: ['Categories'],
        parameters: [
            new OA\Parameter(
                name: 'category',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer')
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: '카테고리 상세',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'data', properties: [
                            new OA\Property(property: 'id', type: 'integer'),
                            new OA\Property(property: 'category_code', type: 'string'),
                            new OA\Property(property: 'category_name_ko', type: 'string'),
                            new OA\Property(property: 'category_name_zh', type: 'string', nullable: true),
                            new OA\Property(property: 'category_name_en', type: 'string', nullable: true),
                        ], type: 'object'),
                    ]
                )
            ),
            new OA\Response(
                response: 404,
                description: '카테고리를 찾을 수 없음',
            ),
        ]
    )]
    public function show(Category $category): CategoryResource
    {
        $category->load('embeddings');

        return new CategoryResource($category);
    }

    #[OA\Get(
        path: '/api/categories/{category}/translations',
        summary: '카테고리 번역/임베딩 상태 조회',
        description: '특정 카테고리의 번역과 임베딩 상태를 조회합니다.',
        tags: ['Categories'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(
                name: 'category',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer')
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: '카테고리 번역/임베딩 상태',
                content: new OA\JsonContent(
                    type: 'object',
                    properties: [
                        new OA\Property(property: 'data', type: 'object'),
                    ]
                )
            ),
            new OA\Response(
                response: 401,
                description: '인증 필요',
            ),
            new OA\Response(
                response: 404,
                description: '카테고리를 찾을 수 없음',
            ),
        ]
    )]
    public function translations(Category $category): CategoryTranslationsResource
    {
        $category->load('embeddings');

        return new CategoryTranslationsResource($category);
    }

    #[OA\Post(
        path: '/api/categories/batch-translate',
        summary: '일괄 번역 트리거',
        description: '지정된 언어로 전체 카테고리 일괄 번역을 시작합니다.',
        tags: ['Categories'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['target_language'],
                properties: [
                    new OA\Property(property: 'target_language', type: 'string', enum: ['zh', 'en']),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 202,
                description: '일괄 번역 시작됨',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string'),
                        new OA\Property(property: 'target_language', type: 'string'),
                    ]
                )
            ),
            new OA\Response(
                response: 422,
                description: '입력값 검증 실패',
            ),
            new OA\Response(
                response: 401,
                description: '인증 필요',
            ),
        ]
    )]
    public function batchTranslate(BatchTranslateRequest $request): JsonResponse
    {
        BatchTranslatePipeline::dispatch($request->target_language);

        return response()->json([
            'message' => '일괄 번역이 시작되었습니다.',
            'target_language' => $request->target_language,
        ], 202);
    }

    #[OA\Post(
        path: '/api/categories/{category}/translate-embed',
        summary: '카테고리별 번역·임베딩 실행',
        description: '특정 카테고리에 대해 번역과 임베딩 파이프라인을 실행합니다.',
        tags: ['Categories'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(
                name: 'category',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer')
            ),
        ],
        responses: [
            new OA\Response(
                response: 202,
                description: '파이프라인 실행 시작됨',
                content: new OA\JsonContent(
                    type: 'object',
                    properties: [
                        new OA\Property(property: 'message', type: 'string'),
                        new OA\Property(property: 'category_id', type: 'integer'),
                    ]
                )
            ),
            new OA\Response(
                response: 401,
                description: '인증 필요',
            ),
            new OA\Response(
                response: 404,
                description: '카테고리를 찾을 수 없음',
            ),
        ]
    )]
    public function translateEmbed(Request $request, Category $category): JsonResponse
    {
        $request->validate([
            'steps' => ['nullable', 'array'],
            'steps.*' => ['string', 'in:translation.zh,translation.en,embedding.ko,embedding.zh,embedding.en'],
        ]);
        $steps = $request->input('steps');
        CategoryTranslateEmbedPipeline::dispatch($category->id, $steps);

        return response()->json([
            'message' => '카테고리 번역·임베딩이 시작되었습니다.',
            'category_id' => $category->id,
        ], 202);
    }

    #[OA\Post(
        path: '/api/categories/{category}/translate-embed/cancel',
        summary: '카테고리별 번역·임베딩 중단',
        description: '실행 중인 카테고리 번역·임베딩 파이프라인을 중단합니다.',
        tags: ['Categories'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(
                name: 'category',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer')
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: '중단 요청 처리됨',
                content: new OA\JsonContent(
                    type: 'object',
                    properties: [
                        new OA\Property(property: 'message', type: 'string'),
                        new OA\Property(property: 'category_id', type: 'integer'),
                    ]
                )
            ),
            new OA\Response(
                response: 401,
                description: '인증 필요',
            ),
        ]
    )]
    public function cancelTranslateEmbed(Category $category): JsonResponse
    {
        Cache::put("category-translate-cancel:{$category->id}", true, 600);

        return response()->json([
            'message' => '카테고리 번역·임베딩 중단이 요청되었습니다.',
            'category_id' => $category->id,
        ]);
    }
}
