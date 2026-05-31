<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RecommendRequest;
use App\Http\Resources\RecommendResource;
use App\Models\Category;
use App\Services\EmbeddingCacheService;
use App\Services\RecommendationService;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class RecommendController extends Controller
{
    public function __construct(
        private EmbeddingCacheService $embeddingCache,
        private RecommendationService $recommendation,
    ) {}

    #[OA\Post(
        path: '/api/recommend',
        summary: '카테고리 추천',
        description: '입력 텍스트를 분석하여 pgvector 코사인 유사도 기반으로 카테고리를 추천합니다. text가 비어있으면 일반 카테고리 목록을 페이지네이션으로 반환합니다.',
        tags: ['Recommend'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['target_language'],
                properties: [
                    new OA\Property(property: 'text', type: 'string', maxLength: 500, nullable: true),
                    new OA\Property(property: 'target_language', type: 'string', enum: ['ko', 'zh', 'en']),
                    new OA\Property(property: 'page', type: 'integer', minimum: 1, default: 1),
                    new OA\Property(property: 'per_page', type: 'integer', minimum: 1, maximum: 100, default: 20),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: '추천 결과',
                content: new OA\JsonContent(
                    type: 'object',
                    properties: [
                        new OA\Property(property: 'data', type: 'array', items: new OA\Items(
                            properties: [
                                new OA\Property(property: 'category_code', type: 'string'),
                                new OA\Property(property: 'category_name', type: 'string'),
                                new OA\Property(property: 'similarity_score', type: 'number', example: 0.9876),
                            ]
                        )),
                    ]
                )
            ),
            new OA\Response(
                response: 422,
                description: '입력값 검증 실패',
            ),
        ]
    )]
    public function recommend(RecommendRequest $request): JsonResponse
    {
        $text = $request->validated('text');
        $targetLanguage = $request->validated('target_language');
        $page = (int) $request->input('page', 1);
        $perPage = (int) $request->input('per_page', config('services.pagination.default_per_page', 20));
        $filter = $request->validated('filter');
        $keyword = $request->validated('keyword');
        $folder = $request->validated('folder');
        $user = auth('sanctum')->user();

        // CategoryController::index()와 동일한 접근 제어 규칙 적용
        if ($filter === 'my') {
            if ($user) {
                $scopeUserId = $user->id;
            } else {
                // 비로그인 + 내 카테고리 → 빈 결과
                return response()->json([
                    'data' => [],
                    'meta' => ['current_page' => 1, 'last_page' => 1, 'total' => 0, 'per_page' => $perPage],
                ]);
            }
        } else {
            // 전체: admin → 제한 없음, 로그인 → 자신 + user_id=1, 비로그인 → user_id=1만
            if ($user && $user->isAdmin()) {
                $scopeUserId = null;  // RecommendationService handles null as no restriction
            } else {
                $scopeUserId = $user ? [$user->id, 1] : [1];
            }
        }

        // user_id 필터 (관리자가 특정 회원의 폴더 선택 시)
        if ($request->filled('user_id') && $user && $user->isAdmin()) {
            $scopeUserId = (int) $request->input('user_id');
        }

        // text가 없거나 빈 문자열이면 일반 카테고리 목록 반환
        if (empty(trim((string) $text))) {
            $query = Category::where('category_name_ko', '!=', '__folder_placeholder__')
                ->orderBy("category_name_{$targetLanguage}");

            if (is_array($scopeUserId)) {
                $query->whereIn('user_id', $scopeUserId);
            } else {
                $query->where('user_id', $scopeUserId);
            }

            if ($keyword) {
                $query->where('categories.category_name_ko', 'like', $keyword.'%');
            }

            if ($folder) {
                if ($folder === '기본폴더') {
                    $query->whereNull('categories.folder');
                } else {
                    $query->where('categories.folder', $folder);
                }
            }

            return RecommendResource::collection($query->paginate(perPage: $perPage, page: $page))->response();
        }

        $userId = $user?->id;
        $modelName = config('services.ollama.embedding_model', 'bge-m3:latest');

        $searchLog = $this->embeddingCache->getOrCreateEmbedding(
            $text, $modelName, $userId
        );

        RecommendResource::setQueryEmbedding($searchLog->embedding->toArray());

        $results = $this->recommendation->recommendPaginated(
            $searchLog, $targetLanguage, $perPage, $page, $scopeUserId, $keyword, $folder
        );

        return RecommendResource::collection($results)->response();
    }
}
