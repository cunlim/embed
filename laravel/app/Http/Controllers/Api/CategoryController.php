<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CategoryStoreRequest;
use App\Http\Requests\CategoryUpdateTextRequest;
use App\Http\Requests\RunStepRequest;
use App\Http\Resources\CategoryCollection;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\CategoryTranslationsResource;
use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\User;
use App\Services\CategoryHierarchyService;
use App\Services\CategoryProcessingService;
use App\Services\CategoryQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Reader\XLSX\Reader;
use OpenSpout\Writer\XLSX\Writer;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CategoryController extends Controller
{
    public function __construct(
        private CategoryProcessingService $processingService,
        private CategoryHierarchyService $hierarchyService,
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
    public function index(Request $request): CategoryCollection
    {
        /** @var User|null $user */
        $user = auth('sanctum')->user();
        $maxPerPage = $user ? PHP_INT_MAX : (int) config('services.pagination.max_per_page_guest', 100);
        $perPage = min(
            (int) $request->input('per_page', config('services.pagination.default_per_page', 20)),
            $maxPerPage
        );

        $query = CategoryQueryService::buildListQuery($user, $request, withEmbeddings: true);

        return new CategoryCollection(
            $query->orderBy('id', 'desc')->paginate($perPage)
        );
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
        $embedModelName = config('services.embed.model');

        // 임베딩 존재 여부를 경량 쿼리로 조회 (벡터 데이터 제외)
        $categoryIds = $categories->pluck('id')->toArray();
        $embeddingExistsMap = [];
        if (! empty($categoryIds)) {
            $embeddingRows = CategoryEmbedding::whereIn('category_id', $categoryIds)
                ->where('embed_model_name', $embedModelName)
                ->whereNotNull('embedding')
                ->select('category_id', 'language')
                ->get();
            foreach ($embeddingRows as $row) {
                $embeddingExistsMap[$row->category_id][] = $row->language;
            }
        }

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

    /**
     * 배치 실행: 여러 카테고리의 누락 step을 순차 실행합니다.
     *
     * STEP_ORDER: embedding.ko → translation.en → embedding.en → translation.zh → embedding.zh
     * 재시도: 최대 2회 (지수 백오프 1s, 2s)
     * 카테고리 간 실패 격리: 한 카테고리 실패 시 다음 카테고리 계속 진행
     */
    public function batchRun(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = auth('sanctum')->user();

        $validSteps = ['translation.en', 'translation.zh', 'embedding.ko', 'embedding.en', 'embedding.zh'];
        $checkedSteps = $request->input('steps');

        if (! is_array($checkedSteps) || empty($checkedSteps)) {
            return response()->json(['message' => 'steps 배열을 하나 이상 선택해주세요.'], 422);
        }

        $checkedSteps = array_values(array_intersect($checkedSteps, $validSteps));
        if (empty($checkedSteps)) {
            return response()->json(['message' => '유효한 step이 없습니다.'], 422);
        }

        // 카테고리 조회 (batchStatus와 동일 로직)
        if ($request->filled('ids')) {
            $ids = $request->input('ids');
            if (! is_array($ids)) {
                return response()->json(['message' => 'ids는 배열이어야 합니다.'], 422);
            }
            $categories = Category::query()->whereIn('id', array_map('intval', $ids))->orderBy('id', 'desc')->get();

            // 권한 필터: ids 모드에서 본인 소유 또는 admin만 허용
            if ($user) {
                $categories = $categories->filter(function ($cat) use ($user) {
                    return $user->isAdmin() || $cat->user_id === $user->id;
                });
            } else {
                $categories = $categories->filter(fn ($cat) => $cat->user_id === 1);
            }
        } else {
            $query = CategoryQueryService::buildListQuery($user, $request);
            $categories = $query->orderBy('id', 'desc')->get();
        }

        if ($categories->isEmpty()) {
            return response()->json([
                'data' => [
                    'total_categories' => 0,
                    'completed_categories' => 0,
                    'failed_categories' => 0,
                    'total_steps' => 0,
                    'completed_steps' => 0,
                    'failed_steps' => 0,
                    'categories' => [],
                ],
            ]);
        }

        $result = $this->processingService->batchRun($categories, $checkedSteps);

        return response()->json(['data' => $result]);
    }

    /**
     * Excel 파일로 카테고리 일괄 등록
     * POST /api/categories/bulk-upload
     *
     * Accepts: multipart/form-data with 'file' field (.xlsx)
     * Columns: category_code (optional), category_ko (required), category_en (optional), category_zh (optional)
     */
    public function bulkUpload(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('sanctum');

        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        $file = $request->file('file');
        $reader = new Reader;
        $reader->open($file->getPathname());

        $results = [];
        $rowCount = 0;
        $successCount = 0;
        $failCount = 0;

        foreach ($reader->getSheetIterator() as $sheet) {
            foreach ($sheet->getRowIterator() as $rowIndex => $row) {
                // Skip header row
                if ($rowIndex === 1) {
                    continue;
                }

                $cells = $row->getCells();
                $categoryCode = isset($cells[0]) ? trim((string) $cells[0]) : null;
                $categoryNameKo = isset($cells[1]) ? trim((string) $cells[1]) : null;
                $categoryNameEn = isset($cells[2]) ? trim((string) $cells[2]) : null;
                $categoryNameZh = isset($cells[3]) ? trim((string) $cells[3]) : null;

                // Skip empty rows
                if (empty($categoryNameKo)) {
                    continue;
                }

                $rowCount++;

                try {
                    $targetUserId = $user->isAdmin() && $request->filled('user_id')
                        ? (int) $request->input('user_id')
                        : $user->id;

                    $category = Category::create([
                        'category_code' => ! empty($categoryCode) ? $categoryCode : Category::generateCode($targetUserId),
                        'category_name_ko' => $categoryNameKo,
                        'category_name_en' => ! empty($categoryNameEn) ? $categoryNameEn : null,
                        'category_name_zh' => ! empty($categoryNameZh) ? $categoryNameZh : null,
                        'user_id' => $targetUserId,
                        'folder' => $request->input('folder') === '기본폴더' ? null : $request->input('folder'),
                    ]);

                    $results[] = [
                        'row' => $rowIndex,
                        'success' => true,
                        'category_code' => $category->category_code,
                        'category_name_ko' => $category->category_name_ko,
                    ];
                    $successCount++;
                } catch (\Throwable $e) {
                    $results[] = [
                        'row' => $rowIndex,
                        'success' => false,
                        'message' => $e->getMessage(),
                        'category_code' => $categoryCode,
                        'category_name_ko' => $categoryNameKo,
                    ];
                    $failCount++;
                }
            }

            // Only process first sheet
            break;
        }

        $reader->close();

        return response()->json([
            'data' => [
                'results' => $results,
                'summary' => [
                    'total' => $rowCount,
                    'success' => $successCount,
                    'failed' => $failCount,
                ],
            ],
        ]);
    }

    /**
     * 카테고리 Excel 다운로드
     * GET /api/categories/bulk-download
     *
     * Returns: .xlsx file with columns: category_code, category_ko, category_en, category_zh
     */
    public function bulkDownload(Request $request): StreamedResponse
    {
        /** @var User|null $user */
        $user = auth('sanctum')->user();

        // Use same query logic as index()
        $query = CategoryQueryService::buildListQuery($user, $request);
        $categories = $query->orderBy('id', 'asc')->get();

        $writer = new Writer;
        $filename = 'categories_'.date('Ymd_His').'.xlsx';

        return response()->stream(function () use ($writer, $categories) {
            $writer->openToFile('php://output');

            // Header row
            $writer->addRow(new Row([
                new StringCell('category_code'),
                new StringCell('category_ko'),
                new StringCell('category_en'),
                new StringCell('category_zh'),
            ]));

            // Data rows
            foreach ($categories as $cat) {
                $writer->addRow(new Row([
                    new StringCell($cat->category_code ?? ''),
                    new StringCell($cat->category_name_ko ?? ''),
                    new StringCell($cat->category_name_en ?? ''),
                    new StringCell($cat->category_name_zh ?? ''),
                ]));
            }

            $writer->close();
        }, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    public function levels(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user('sanctum');

        // 언어 파라미터 검증
        $lang = $request->query('lang', 'ko');
        if (! in_array($lang, ['ko', 'en', 'zh'], true)) {
            return response()->json(['message' => 'lang must be one of: ko, en, zh'], 400);
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

        $category = Category::create([
            'category_code' => $request->filled('category_code')
                ? $request->category_code
                : Category::generateCode($targetUserId),
            'category_name_ko' => $request->category_name_ko,
            'category_name_en' => $request->input('category_name_en'),
            'category_name_zh' => $request->input('category_name_zh'),
            'user_id' => $targetUserId,
            // "기본폴더"는 폴더 미지정을 의미하므로 NULL로 저장
            'folder' => $request->input('folder') === '기본폴더' ? null : $request->input('folder'),
        ]);

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
