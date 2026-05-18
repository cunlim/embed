<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CategoryStoreRequest;
use App\Http\Requests\RunStepRequest;
use App\Http\Resources\CategoryCollection;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\CategoryTranslationsResource;
use App\Jobs\TranslateAndEmbedJob;
use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Services\EmbeddingGenerator;
use App\Services\OllamaTranslator;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class CategoryController extends Controller
{
    #[OA\Get(
        path: '/api/categories',
        summary: '카테고리 목록 조회',
        description: '등록된 모든 카테고리를 조회합니다. 20개씩 페이지네이션됩니다.',
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
                                new OA\Property(property: 'translation_status', type: 'string', enum: ['completed', 'partial', 'pending']),
                            ]
                        )),
                        new OA\Property(property: 'meta', type: 'object', properties: [
                            new OA\Property(property: 'current_page', type: 'integer'),
                            new OA\Property(property: 'last_page', type: 'integer'),
                            new OA\Property(property: 'per_page', type: 'integer'),
                            new OA\Property(property: 'total', type: 'integer'),
                            new OA\Property(property: 'from', type: 'integer'),
                            new OA\Property(property: 'to', type: 'integer'),
                        ]),
                        new OA\Property(property: 'links', type: 'object', properties: [
                            new OA\Property(property: 'first', type: 'string', nullable: true),
                            new OA\Property(property: 'last', type: 'string', nullable: true),
                            new OA\Property(property: 'prev', type: 'string', nullable: true),
                            new OA\Property(property: 'next', type: 'string', nullable: true),
                        ]),
                    ]
                )
            ),
        ]
    )]
    public function index(): CategoryCollection
    {
        return new CategoryCollection(
            Category::query()->with('embeddings')->orderBy('id')->paginate(20)
        );
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
        summary: '카테고리별 번역·임베딩 상태 조회',
        description: '특정 카테고리의 언어별 번역 텍스트와 임베딩 상태를 조회합니다.',
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
                description: '카테고리 번역·임베딩 상태',
                content: new OA\JsonContent(
                    type: 'object',
                    properties: [
                        new OA\Property(property: 'data', type: 'object', properties: [
                            new OA\Property(property: 'id', type: 'integer'),
                            new OA\Property(property: 'category_code', type: 'string'),
                            new OA\Property(property: 'category_name_ko', type: 'string'),
                            new OA\Property(property: 'embedding_dimensions', type: 'integer', nullable: true),
                            new OA\Property(property: 'languages', type: 'object'),
                        ]),
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
        path: '/api/categories/{category}/run-step',
        summary: '카테고리 단일 스텝 실행',
        description: '특정 카테고리에 대해 번역 또는 임베딩 단일 스텝을 동기 실행합니다.',
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
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['step'],
                properties: [
                    new OA\Property(
                        property: 'step',
                        type: 'string',
                        enum: ['translation.zh', 'translation.en', 'embedding.ko', 'embedding.zh', 'embedding.en']
                    ),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: '스텝 실행 완료',
                content: new OA\JsonContent(
                    type: 'object',
                    properties: [
                        new OA\Property(property: 'step', type: 'string'),
                        new OA\Property(property: 'status', type: 'string', enum: ['completed', 'failed']),
                        new OA\Property(property: 'result', type: 'string', nullable: true),
                        new OA\Property(property: 'error', type: 'string', nullable: true),
                    ]
                )
            ),
            new OA\Response(
                response: 422,
                description: '입력값 검증 실패 또는 전제조건 불만족',
            ),
            new OA\Response(
                response: 401,
                description: '인증 필요',
            ),
        ]
    )]
    public function runStep(RunStepRequest $request, Category $category): JsonResponse
    {
        $step = $request->input('step');
        $categoryNameKo = $category->category_name_ko;
        $embedModelName = config('services.ollama.embedding_model');
        $translator = app(OllamaTranslator::class);
        $embedder = app(EmbeddingGenerator::class);

        try {
            [$type, $lang] = explode('.', $step);

            if ($type === 'translation') {
                $column = $lang === 'zh' ? 'category_name_zh' : 'category_name_en';
                $translated = $translator->translate($categoryNameKo, $lang);
                $category->{$column} = $translated;
                $category->save();

                return response()->json([
                    'step' => $step,
                    'status' => 'completed',
                    'result' => $translated,
                ]);
            }

            // embedding
            $textForEmbedding = match ($lang) {
                'ko' => $category->category_name_ko,
                'zh' => $category->category_name_zh,
                'en' => $category->category_name_en,
            };

            if ($textForEmbedding === null) {
                return response()->json([
                    'step' => $step,
                    'status' => 'failed',
                    'error' => "{$lang} 번역 텍스트가 없습니다. 먼저 번역을 실행해주세요.",
                ], 422);
            }

            $vector = $embedder->generate($textForEmbedding);

            CategoryEmbedding::updateOrCreate(
                [
                    'category_id' => $category->id,
                    'language' => $lang,
                    'embed_model_name' => $embedModelName,
                ],
                ['embedding' => $vector]
            );

            return response()->json([
                'step' => $step,
                'status' => 'completed',
                'result' => json_encode(array_slice($vector, 0, 10)),
            ]);
        } catch (\Throwable $e) {
            $errorMsg = $e->getMessage();
            if (str_contains($errorMsg, 'Ollama rate limit exceeded')) {
                $errorMsg = 'Ollama rate limit exceeded';
            }

            return response()->json([
                'step' => $step,
                'status' => 'failed',
                'error' => $errorMsg,
            ], 500);
        }
    }
}
