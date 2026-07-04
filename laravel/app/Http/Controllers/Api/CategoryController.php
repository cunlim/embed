<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CategoryIndexRequest;
use App\Http\Requests\CategoryStoreRequest;
use App\Http\Requests\CategoryUpdateTextRequest;
use App\Http\Requests\RunStepRequest;
use App\Http\Resources\CategoryCollection;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\CategoryTranslationsResource;
use App\Models\Category;
use App\Models\User;
use App\Services\ApiUsageService;
use App\Services\CategoryHierarchyService;
use App\Services\CategoryProcessingService;
use App\Services\CategoryQueryService;
use App\Services\EmbeddingCacheService;
use App\Services\RecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class CategoryController extends Controller
{
    public function __construct(
        private CategoryProcessingService $processingService,
        private CategoryHierarchyService $hierarchyService,
        private EmbeddingCacheService $embeddingCache,
        private RecommendationService $recommendation,
        private ApiUsageService $apiUsage,
    ) {}

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
    public function index(CategoryIndexRequest $request): CategoryCollection|JsonResponse
    {
        /** @var User|null $user */
        $user = auth('sanctum')->user();
        $perPage = (int) $request->input('page_size', config('services.pagination.default_per_page', 20));

        $text = $request->input('similarity_query');
        $targetLanguage = $request->getTranslationLang();

        // similarity_query가 있고 비어있지 않으면 → 유사도 검색 (기존 /api/recommend 로직)
        if (! empty($text) && trim($text) !== '') {
            return $this->recommendSearch($request, $user, $text, $targetLanguage, $perPage);
        }

        // similarity_query가 없으면 → 기존 일반 목록
        $query = CategoryQueryService::buildListQuery($user, $request, withEmbeddings: true);

        return new CategoryCollection(
            $query->orderBy('id', 'desc')->paginate($perPage)
        );
    }

    /**
     * 유사도 검색 분기 (기존 RecommendController::recommend() 로직 이식).
     * text 파라미터가 있을 때 pgvector 코사인 유사도 기반으로 카테고리를 추천합니다.
     */
    private function recommendSearch(CategoryIndexRequest $request, ?User $user, string $text, string $targetLanguage, int $perPage): JsonResponse
    {
        $page = (int) $request->input('page_number', 1);
        $keyword = $request->input('like_query');
        $folder = $request->input('folder');

        $mode = $request->input('search_mode', 'search');
        $lang = $request->input('hierarchy_lang', 'ko');
        $searchLang = ($mode === 'hierarchy' && $lang) ? $lang : null;

        // 사용자 범위 해석
        $scopeUserId = $this->resolveScopeUserId($user, $request);

        // 비로그인 + owner_scope=my → 빈 결과
        if ($request->input('owner_scope') === 'my' && ! $user) {
            return response()->json([
                'data' => [],
                'meta' => ['current_page' => 1, 'last_page' => 1, 'total' => 0, 'per_page' => $perPage],
                'query_embedding' => null,
            ]);
        }

        // quota 체크
        if ($user && ! $user->hasQuota()) {
            return response()->json([
                'code' => 'quota_exceeded',
                'message' => '무료 호출 회수를 초과했습니다.',
            ], 429);
        }

        $userId = $user?->id;
        $modelName = config('services.embed.model', 'bge-m3:latest');

        $searchLog = $this->embeddingCache->getOrCreateEmbedding($text, $modelName, $userId);
        $queryEmbedding = $searchLog->embedding->toArray();

        $results = $this->recommendation->recommendPaginated(
            $searchLog, $targetLanguage, $perPage, $page, $scopeUserId, $keyword, $folder, $searchLang
        );

        // quota 차감 + 로그
        if ($user) {
            DB::table('users')
                ->where('id', $user->id)
                ->where('api_quota_remaining', '>', 0)
                ->decrement('api_quota_remaining', 1);

            $this->apiUsage->log(
                null, $user->id, '/api/categories',
                $request->all(),
                200, 0, 'embed', 'Embed 유사도 검색'
            );
        }

        return CategoryResource::collection($results)
            ->additional(['query_embedding' => $queryEmbedding])
            ->response();
    }

    /**
     * 사용자 범위 해석 (기존 RecommendController 76~98번 줄 로직 추출).
     *
     * @return int|array<int>|null 단일 사용자 ID, 배열, 또는 null(제한 없음)
     */
    private function resolveScopeUserId(?User $user, Request $request): int|array|null
    {
        $filter = $request->input('owner_scope');

        if ($filter === 'my') {
            return $user?->id ?? 0;
        }

        if ($request->filled('user_id') && $user && $user->isAdmin()) {
            return (int) $request->input('user_id');
        }

        if ($user && $user->isAdmin()) {
            return null;
        }

        return $user ? [$user->id, 1] : [1];
    }

    /**
     * 배치 작업 실행용 벌크 상태 확인 API.
     * ids[] 또는 filter/keyword/folder 파라미터로 카테고리를 조회하고,
     * 각 카테고리의 누락 step을 계산하여 통계와 함께 반환합니다.
     */
    public function batchStatus(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = auth('sanctum')->user();

        // ids 모드: 특정 ID 목록으로 조회
        if ($request->filled('ids')) {
            $ids = $request->input('ids');
            if (! is_array($ids)) {
                return response()->json(['message' => 'ids는 배열이어야 합니다.'], 422);
            }
            $query = Category::query()->whereIn('id', array_map('intval', $ids));
        } else {
            // 필터 모드: CategoryQueryService로 공통 필터 적용
            $query = CategoryQueryService::buildListQuery($user, $request);
        }

        $categories = $query->orderBy('id', 'desc')->get();

        // 프론트엔드에서 전달된 선택 step 목록 (없으면 전체)
        $validSteps = ['translation.en', 'translation.zh', 'embedding.ko', 'embedding.en', 'embedding.zh'];
        $checkedSteps = $request->input('steps');
        if (is_array($checkedSteps)) {
            $checkedSteps = array_values(array_intersect($checkedSteps, $validSteps));
        } else {
            $checkedSteps = $validSteps;
        }

        // 누락 step 계산 (선택된 step 필터 + embedding 의존성 적용)
        $categoryIds = $categories->pluck('id')->toArray();
        $embeddingExistsMap = CategoryProcessingService::getEmbeddingExistsMap($categoryIds);

        $result = [];
        $totalSteps = 0;

        foreach ($categories as $cat) {
            /** @var Category $cat */
            $embeddedLangs = $embeddingExistsMap[$cat->id] ?? [];
            $missing = $this->processingService->determineMissingSteps($cat, $checkedSteps, $embeddedLangs);
            if (! empty($missing)) {
                $result[] = [
                    'id' => $cat->id,
                    'category_name_ko' => $cat->category_name_ko,
                    'missing_steps' => $missing,
                ];
                $totalSteps += count($missing);
            }
        }

        return response()->json([
            'data' => [
                'total_selected' => $categories->count(),
                'needs_processing' => count($result),
                'total_steps' => $totalSteps,
                'categories' => $result,
            ],
        ]);
    }

    public function levels(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user('sanctum');

        // 언어 파라미터 검증 (하위 호환: hierarchy_lang 우선, 없으면 lang 폴백)
        $lang = $request->query('hierarchy_lang', $request->query('lang', 'ko'));
        if (! in_array($lang, ['ko', 'en', 'zh'], true)) {
            return response()->json(['message' => 'hierarchy_lang must be one of: ko, en, zh'], 400);
        }

        // catN 파라미터 추출 (cat1, cat2, cat3, ...)
        $prefixParts = [];
        for ($i = 1; $i <= 20; $i++) {
            $key = 'cat'.$i;
            if ($request->has($key) && $request->input($key) !== '') {
                $prefixParts[] = $request->input($key);
            } else {
                break;
            }
        }

        // 기존 대/중/소 파라미터 호환 (deprecated)
        if (empty($prefixParts)) {
            $legacyKeys = ['대', '중', '소'];
            foreach ($legacyKeys as $key) {
                $val = $request->query($key);
                if ($val !== null && $val !== '') {
                    $prefixParts[] = $val;
                } else {
                    break;
                }
            }
        }

        $result = $this->hierarchyService->buildHierarchy($lang, $prefixParts, $user, $request);

        return response()->json(['data' => $result]);
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
        $user = $request->user('sanctum');
        // admin이 특정 회원의 user_id를 지정한 경우 해당 회원 소유로 생성
        $targetUserId = ($user->isAdmin() && $request->filled('user_id'))
            ? (int) $request->input('user_id')
            : $user->id;

        $category = $this->processingService->create(
            userId: $targetUserId,
            categoryNameKo: $request->category_name_ko,
            categoryCode: $request->filled('category_code') ? $request->category_code : null,
            categoryNameEn: $request->input('category_name_en'),
            categoryNameZh: $request->input('category_name_zh'),
            folder: $request->input('folder'),
        );

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
    public function translations(Request $request, Category $category): CategoryTranslationsResource
    {
        $category->load('embeddings');

        return new CategoryTranslationsResource($category, $request->boolean('no_preview'));
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
                        new OA\Property(
                            property: 'translations',
                            type: 'object',
                            nullable: true,
                            properties: [
                                new OA\Property(property: 'id', type: 'integer'),
                                new OA\Property(property: 'category_code', type: 'string'),
                                new OA\Property(property: 'category_name_ko', type: 'string'),
                                new OA\Property(property: 'embedding_dimensions', type: 'integer', nullable: true),
                                new OA\Property(
                                    property: 'languages',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(
                                            property: 'ko',
                                            type: 'object',
                                            properties: [
                                                new OA\Property(property: 'translation_text', type: 'string', nullable: true),
                                                new OA\Property(
                                                    property: 'embedding',
                                                    type: 'object',
                                                    properties: [
                                                        new OA\Property(property: 'status', type: 'string', enum: ['pending', 'completed']),
                                                        new OA\Property(property: 'preview', type: 'array', items: new OA\Items(type: 'number'), nullable: true),
                                                    ]
                                                ),
                                            ]
                                        ),
                                        new OA\Property(
                                            property: 'en',
                                            type: 'object',
                                            properties: [
                                                new OA\Property(property: 'translation_text', type: 'string', nullable: true),
                                                new OA\Property(
                                                    property: 'embedding',
                                                    type: 'object',
                                                    properties: [
                                                        new OA\Property(property: 'status', type: 'string', enum: ['pending', 'completed']),
                                                        new OA\Property(property: 'preview', type: 'array', items: new OA\Items(type: 'number'), nullable: true),
                                                    ]
                                                ),
                                            ]
                                        ),
                                        new OA\Property(
                                            property: 'zh',
                                            type: 'object',
                                            properties: [
                                                new OA\Property(property: 'translation_text', type: 'string', nullable: true),
                                                new OA\Property(
                                                    property: 'embedding',
                                                    type: 'object',
                                                    properties: [
                                                        new OA\Property(property: 'status', type: 'string', enum: ['pending', 'completed']),
                                                        new OA\Property(property: 'preview', type: 'array', items: new OA\Items(type: 'number'), nullable: true),
                                                    ]
                                                ),
                                            ]
                                        ),
                                    ]
                                ),
                            ]
                        ),
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
        /** @var User $user */
        $user = $request->user('sanctum');

        if (! $this->canModify($user, $category)) {
            return response()->json(['message' => '이 카테고리의 번역·임베딩을 실행할 권한이 없습니다.'], 403);
        }

        $step = $request->input('step');
        $result = $this->processingService->runStep($category, $step);

        if ($result['status'] === 'failed') {
            return response()->json([
                'step' => $step,
                'status' => 'failed',
                'error' => $result['error'],
            ], $result['http_code'] ?? 422);
        }

        $category = $category->fresh();
        $translations = (new CategoryTranslationsResource($category))->resolve();

        return response()->json([
            'step' => $step,
            'status' => 'completed',
            'result' => $result['result'],
            'translations' => $translations,
        ]);
    }

    #[OA\Put(
        path: '/api/categories/{category}/update-text',
        summary: '카테고리 텍스트 업데이트',
        description: '카테고리의 특정 언어 텍스트를 업데이트하고 해당 언어의 임베딩을 삭제합니다.',
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
                required: ['field', 'value'],
                properties: [
                    new OA\Property(property: 'field', type: 'string', enum: ['category_name_ko', 'category_name_en', 'category_name_zh', 'category_code']),
                    new OA\Property(property: 'value', type: 'string', nullable: true, maxLength: 255),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: '업데이트 성공',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'data', properties: [
                            new OA\Property(property: 'updated', type: 'boolean', example: true),
                            new OA\Property(property: 'id', type: 'integer', example: 1),
                        ], type: 'object'),
                    ]
                )
            ),
            new OA\Response(response: 401, description: '인증 필요'),
            new OA\Response(response: 404, description: '카테고리를 찾을 수 없음'),
            new OA\Response(response: 422, description: '입력값 검증 실패'),
        ]
    )]
    public function updateText(CategoryUpdateTextRequest $request, Category $category): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('sanctum');

        if (! $this->canModify($user, $category)) {
            return response()->json(['message' => '이 카테고리를 수정할 권한이 없습니다.'], 403);
        }

        $field = $request->input('field');
        $value = $request->input('value');

        $this->processingService->updateText($category, $field, $value);

        $category = $category->fresh();
        $translations = (new CategoryTranslationsResource($category))->resolve();
        $listRow = (new CategoryResource($category))->resolve();

        return response()->json([
            'data' => [
                'updated' => true,
                'id' => $category->id,
                'translations' => $translations,
                'listRow' => $listRow,
            ],
        ]);
    }

    #[OA\Delete(
        path: '/api/categories/{category}',
        summary: '카테고리 삭제',
        description: '카테고리와 관련 임베딩을 삭제합니다. 본인 소유이거나 admin/superadmin만 가능합니다.',
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
            new OA\Response(response: 200, description: '삭제 성공'),
            new OA\Response(response: 401, description: '인증 필요'),
            new OA\Response(response: 403, description: '권한 없음'),
            new OA\Response(response: 404, description: '카테고리를 찾을 수 없음'),
        ]
    )]
    public function destroy(Category $category): JsonResponse
    {
        /** @var User $user */
        $user = request()->user('sanctum');

        if (! $this->canModify($user, $category)) {
            return response()->json(['message' => '이 카테고리를 삭제할 권한이 없습니다.'], 403);
        }

        $categoryId = $category->id;
        $this->processingService->deleteWithEmbeddings($category);

        return response()->json(['message' => '카테고리가 삭제되었습니다.', 'id' => $categoryId]);
    }

    private function canModify(User $user, Category $category): bool
    {
        return $user->isAdmin() || $category->user_id === $user->id;
    }
}
