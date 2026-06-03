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
use App\Services\EmbeddingGenerator;
use App\Services\Translator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
    public function index(Request $request): CategoryCollection
    {
        $user = auth('sanctum')->user();
        $maxPerPage = $user ? PHP_INT_MAX : (int) config('services.pagination.max_per_page_guest', 100);
        $perPage = min(
            (int) $request->input('per_page', config('services.pagination.default_per_page', 20)),
            $maxPerPage
        );

        $query = Category::query()->with('embeddings');

        // 관리자가 명시적 user_id를 전달한 경우 해당 사용자로 필터 (filter=my 무시)
        $hasExplicitUserId = $request->filled('user_id') && $user && $user->isAdmin();

        if ($hasExplicitUserId) {
            $query->where('user_id', (int) $request->input('user_id'));
        } elseif ($request->input('filter') === 'my') {
            if ($user) {
                $query->where('user_id', $user->id);
            } else {
                $query->whereRaw('1 = 0');
            }
        } else {
            if ($user && $user->isAdmin()) {
                // admin/superadmin: no user_id restriction
            } elseif ($user) {
                $query->where(function ($q) use ($user) {
                    $q->where('user_id', $user->id)
                        ->orWhere('user_id', 1);
                });
            } else {
                $query->where('user_id', 1);
            }
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('category_name_ko', 'LIKE', '%'.$search.'%')
                    ->orWhere('category_code', 'LIKE', '%'.$search.'%');
            });
        }

        // folder 필터
        if ($request->filled('folder')) {
            $folder = $request->input('folder');
            if ($folder === '기본폴더') {
                $query->whereNull('folder');
            } else {
                $query->where('folder', $folder);
            }
        }

        // steps 필터: 체크된 step 중 하나라도 누락된 카테고리만 조회 (batchStatus와 동일 로직)
        $validSteps = ['translation.en', 'translation.zh', 'embedding.ko', 'embedding.en', 'embedding.zh'];
        $checkedSteps = $request->input('steps');
        if (is_array($checkedSteps) && ! empty($checkedSteps)) {
            $checkedSteps = array_values(array_intersect($checkedSteps, $validSteps));
        } else {
            $checkedSteps = [];
        }

        if (! empty($checkedSteps)) {
            $embedModelName = config('services.ollama.embedding_model');

            $query->where(function ($q) use ($checkedSteps, $embedModelName) {
                // embedding.ko: ko 임베딩이 없는 카테고리
                if (in_array('embedding.ko', $checkedSteps)) {
                    $q->orWhere(function ($q2) use ($embedModelName) {
                        $q2->whereDoesntHave('embeddings', function ($q3) use ($embedModelName) {
                            $q3->where('language', 'ko')
                                ->where('embed_model_name', $embedModelName)
                                ->whereNotNull('embedding');
                        });
                    });
                }

                // translation.en: en 번역 텍스트가 없는 카테고리
                if (in_array('translation.en', $checkedSteps)) {
                    $q->orWhere(function ($q2) {
                        $q2->whereNull('category_name_en')
                            ->orWhere('category_name_en', '');
                    });
                }

                // embedding.en: en 임베딩이 없고 (en 번역 있음 OR translation.en도 checked)
                if (in_array('embedding.en', $checkedSteps)) {
                    $q->orWhere(function ($q2) use ($checkedSteps, $embedModelName) {
                        $q2->whereDoesntHave('embeddings', function ($q3) use ($embedModelName) {
                            $q3->where('language', 'en')
                                ->where('embed_model_name', $embedModelName)
                                ->whereNotNull('embedding');
                        });
                        // translation.en이 체크 안 됐으면 번역 텍스트가 있어야 embedding 실행 가능
                        if (! in_array('translation.en', $checkedSteps)) {
                            $q2->whereNotNull('category_name_en')
                                ->where('category_name_en', '!=', '');
                        }
                    });
                }

                // translation.zh: zh 번역 텍스트가 없는 카테고리
                if (in_array('translation.zh', $checkedSteps)) {
                    $q->orWhere(function ($q2) {
                        $q2->whereNull('category_name_zh')
                            ->orWhere('category_name_zh', '');
                    });
                }

                // embedding.zh: zh 임베딩이 없고 (zh 번역 있음 OR translation.zh도 checked)
                if (in_array('embedding.zh', $checkedSteps)) {
                    $q->orWhere(function ($q2) use ($checkedSteps, $embedModelName) {
                        $q2->whereDoesntHave('embeddings', function ($q3) use ($embedModelName) {
                            $q3->where('language', 'zh')
                                ->where('embed_model_name', $embedModelName)
                                ->whereNotNull('embedding');
                        });
                        if (! in_array('translation.zh', $checkedSteps)) {
                            $q2->whereNotNull('category_name_zh')
                                ->where('category_name_zh', '!=', '');
                        }
                    });
                }
            });
        }

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

        $query = Category::query();

        // ids 모드 vs 필터 모드
        if ($request->filled('ids')) {
            $ids = $request->input('ids');
            if (! is_array($ids)) {
                return response()->json(['message' => 'ids는 배열이어야 합니다.'], 422);
            }
            $query->whereIn('id', array_map('intval', $ids));
        }

        // 사용자 필터 (index()와 동일 로직)
        $hasExplicitUserId = $request->filled('user_id') && $user && $user->isAdmin();

        if ($hasExplicitUserId) {
            $query->where('user_id', (int) $request->input('user_id'));
        } elseif ($request->input('filter') === 'my') {
            if ($user) {
                $query->where('user_id', $user->id);
            } else {
                $query->whereRaw('1 = 0');
            }
        } else {
            if ($user && $user->isAdmin()) {
                // admin: 전체 조회
            } elseif ($user) {
                $query->where(function ($q) use ($user) {
                    $q->where('user_id', $user->id)->orWhere('user_id', 1);
                });
            } else {
                $query->where('user_id', 1);
            }
        }

        // 검색어 필터
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('category_name_ko', 'LIKE', '%'.$search.'%')
                    ->orWhere('category_code', 'LIKE', '%'.$search.'%');
            });
        }

        // 폴더 필터
        if ($request->filled('folder')) {
            $folder = $request->input('folder');
            if ($folder === '기본폴더') {
                $query->whereNull('folder');
            } else {
                $query->where('folder', $folder);
            }
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
        $embedModelName = config('services.ollama.embedding_model');

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
            $missing = $this->determineMissingSteps($cat, $checkedSteps, $embeddedLangs);
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
     * 카테고리의 누락 step을 계산합니다.
     *
     * 로직:
     * 1. checkedSteps에 포함된 step만 대상 (사용자 선택 필터)
     * 2. 이미 완료된 step은 제외 (embedding 벡터 존재 = completed)
     * 3. embedding은 해당 언어 번역 텍스트가 존재해야 실행 가능 (의존성)
     *    - 번역 텍스트가 없고, translation step도 선택되지 않았으면 embedding 제외
     *
     * @param  string[]  $checkedSteps  프론트엔드에서 전달된 선택 step 목록
     * @param  string[]  $embeddedLangs  이미 임베딩이 존재하는 언어 목록 (벡터 데이터 제외)
     * @return string[] 처리가 필요한 step 이름 배열
     */
    private function determineMissingSteps(Category $category, array $checkedSteps, array $embeddedLangs): array
    {
        $steps = [];

        // en: 번역 + 임베딩
        $enTranslated = (bool) $category->category_name_en;
        $enEmbedded = in_array('en', $embeddedLangs);

        if (! $enTranslated && in_array('translation.en', $checkedSteps)) {
            $steps[] = 'translation.en';
        }
        // embedding은 번역 텍스트가 있어야 실행 가능 (의존성)
        // 번역이 없고 translation step도 선택 안 됐으면 embedding 불가
        if (! $enEmbedded && in_array('embedding.en', $checkedSteps) && ($enTranslated || in_array('translation.en', $checkedSteps))) {
            $steps[] = 'embedding.en';
        }

        // zh: 번역 + 임베딩
        $zhTranslated = (bool) $category->category_name_zh;
        $zhEmbedded = in_array('zh', $embeddedLangs);

        if (! $zhTranslated && in_array('translation.zh', $checkedSteps)) {
            $steps[] = 'translation.zh';
        }
        if (! $zhEmbedded && in_array('embedding.zh', $checkedSteps) && ($zhTranslated || in_array('translation.zh', $checkedSteps))) {
            $steps[] = 'embedding.zh';
        }

        // ko: 임베딩만 (원본 언어 — 번역 불필요)
        $koEmbedded = in_array('ko', $embeddedLangs);
        if (! $koEmbedded && in_array('embedding.ko', $checkedSteps)) {
            $steps[] = 'embedding.ko';
        }

        return $steps;
    }

    public function levels(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $maxDepthSetting = (int) config('services.category.max_depth', 10);

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

        $currentDepth = count($prefixParts); // 0 = 최상위

        // 사용자 범위 쿼리 (기존 규칙과 동일)
        $scopeQuery = Category::query();
        if ($user && $user->isAdmin()) {
            // admin/superadmin: 제한 없음
        } elseif ($user) {
            $scopeQuery->whereIn('user_id', [$user->id, 1]);
        } else {
            $scopeQuery->where('user_id', 1);
        }

        // user_id 필터 (관리자가 특정 회원의 폴더 선택 시)
        if ($request->filled('user_id') && $user && $user->isAdmin()) {
            $scopeQuery->where('user_id', (int) $request->input('user_id'));
        }

        // folder 필터
        if ($request->filled('folder')) {
            $folder = $request->input('folder');
            if ($folder === '기본폴더') {
                $scopeQuery->whereNull('folder');
            } else {
                $scopeQuery->where('folder', $folder);
            }
        }

        // maxDepth = min(DB 실제 최대 깊이, 설정값)
        $dbMaxDepth = (int) (clone $scopeQuery)->selectRaw('max(array_length(string_to_array(category_name_ko, \'>\'), 1))')->value('max') ?? 1;
        $maxDepth = min($dbMaxDepth, $maxDepthSetting);

        // 접두사 필터링
        $query = clone $scopeQuery;
        if (! empty($prefixParts)) {
            $prefix = implode('>', $prefixParts).'>';
            $query->where('category_name_ko', 'like', $prefix.'%');
        }

        // max_depth 초과 시 잔여 세그먼트를 복합 옵션으로 포함
        if ($currentDepth >= $maxDepthSetting - 1 && ! empty($prefixParts)) {
            $categories = $query
                ->select('id', 'category_code', 'category_name_ko')
                ->get();

            $options = $categories
                ->map(function ($c) use ($currentDepth) {
                    $parts = explode('>', $c->category_name_ko);
                    $remaining = array_slice($parts, $currentDepth);

                    return [
                        'label' => implode(' > ', array_map('trim', $remaining)),
                        'categoryId' => $c->id,
                        'categoryCode' => $c->category_code,
                    ];
                })
                ->unique('label')
                ->values()
                ->toArray();

            return response()->json([
                'data' => [
                    'options' => $options,
                    'maxDepth' => $maxDepth,
                    'isLeaf' => false,
                    'leafCategoryId' => null,
                    'categoryCount' => null,
                ],
            ]);
        }

        // 현재 깊이에서 고유 옵션 추출
        $nextDepthIndex = $currentDepth; // 0-based 인덱스
        $options = $query
            ->select('category_name_ko')
            ->get()
            ->map(function ($c) use ($nextDepthIndex) {
                $parts = explode('>', $c->category_name_ko);

                return isset($parts[$nextDepthIndex]) ? trim($parts[$nextDepthIndex]) : null;
            })
            ->filter(fn ($s) => $s !== null && $s !== '')
            ->unique()
            ->values()
            ->toArray();

        // 리프 여부 확인
        $isLeaf = empty($options);
        $leafCategoryId = null;
        $categoryCount = null;

        if ($isLeaf && ! empty($prefixParts)) {
            $leafPath = implode('>', $prefixParts);
            $leafCategory = (clone $scopeQuery)->where('category_name_ko', $leafPath)->first();
            $leafCategoryId = $leafCategory?->id;
            // 리프 경로에 등록된 카테고리 수 카운트
            $categoryCount = (clone $scopeQuery)->where('category_name_ko', $leafPath)->count();

            // 깊이 초과 처리: 더 깊은 카테고리가 있으면 복합 옵션으로 포함
            if ($leafCategoryId === null) {
                $deeperQuery = clone $scopeQuery;
                $deeperPrefix = implode('>', $prefixParts).'>';
                $deeperCategories = $deeperQuery
                    ->where('category_name_ko', 'like', $deeperPrefix.'%')
                    ->select('id', 'category_code', 'category_name_ko')
                    ->get();

                if ($deeperCategories->isNotEmpty()) {
                    $options = $deeperCategories
                        ->map(function ($c) use ($currentDepth) {
                            $parts = explode('>', $c->category_name_ko);
                            $remaining = array_slice($parts, $currentDepth);

                            return [
                                'label' => implode(' > ', array_map('trim', $remaining)),
                                'categoryId' => $c->id,
                                'categoryCode' => $c->category_code,
                            ];
                        })
                        ->unique('label')
                        ->values()
                        ->toArray();

                    $isLeaf = false;
                    $categoryCount = $deeperCategories->count();
                }
            }
        }

        return response()->json([
            'data' => [
                'options' => $options,
                'maxDepth' => $maxDepth,
                'isLeaf' => $isLeaf,
                'leafCategoryId' => $leafCategoryId,
                'categoryCount' => $categoryCount,
            ],
        ]);
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
        $categoryNameKo = $category->category_name_ko;
        $embedModelName = config('services.ollama.embedding_model');
        $translator = app(Translator::class);
        $embedder = app(EmbeddingGenerator::class);

        try {
            [$type, $lang] = explode('.', $step);

            if ($type === 'translation') {
                $column = $lang === 'zh' ? 'category_name_zh' : 'category_name_en';
                $translated = $translator->translate($categoryNameKo, $lang);
                $category->{$column} = $translated;
                $category->save();

                $category = $category->fresh();
                $translations = (new CategoryTranslationsResource($category))->resolve();

                return response()->json([
                    'step' => $step,
                    'status' => 'completed',
                    'result' => $translated,
                    'translations' => $translations,
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

            $category = $category->fresh();
            $translations = (new CategoryTranslationsResource($category))->resolve();

            return response()->json([
                'step' => $step,
                'status' => 'completed',
                'result' => json_encode(array_slice($vector, 0, 10)),
                'translations' => $translations,
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

        $category->update([$field => $value]);

        $lang = match ($field) {
            'category_name_ko' => 'ko',
            'category_name_en' => 'en',
            'category_name_zh' => 'zh',
            'category_code' => null,
        };

        if ($lang !== null) {
            CategoryEmbedding::where('category_id', $category->id)
                ->where('language', $lang)
                ->delete();
        }

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

        CategoryEmbedding::where('category_id', $category->id)->delete();
        $category->delete();

        return response()->json(['message' => '카테고리가 삭제되었습니다.', 'id' => $category->id]);
    }

    private function canModify(User $user, Category $category): bool
    {
        return $user->isAdmin() || $category->user_id === $user->id;
    }
}
