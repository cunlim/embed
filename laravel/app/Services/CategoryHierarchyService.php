<?php

namespace App\Services;

use App\Models\Category;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class CategoryHierarchyService
{
    /**
     * 계층 네비게이션 응답을 생성합니다.
     *
     * @param  string     $lang   ko, en, zh 중 하나
     * @param  string[]   $prefixParts  선택된 cat1/cat2/... 값들
     * @param  ?User      $user
     * @param  Request    $request  user_id와 folder 파라미터용
     * @return array{
     *   options: array,
     *   maxDepth: int,
     *   isLeaf: bool,
     *   leafCategoryId: ?int,
     *   categoryCount: ?int
     * }
     */
    public function buildHierarchy(string $lang, array $prefixParts, ?User $user, Request $request): array
    {
        $maxDepthSetting = (int) config('services.category.max_depth', 10);
        $langColumn = 'category_name_'.$lang;
        $currentDepth = count($prefixParts);

        // 사용자 범위 쿼리
        $scopeQuery = $this->buildScopeQuery($user, $request);

        // maxDepth = min(DB 실제 최대 깊이, 설정값)
        $dbMaxDepth = (int) (clone $scopeQuery)->selectRaw('max(array_length(string_to_array('.$langColumn.', \'>\'), 1))')->value('max') ?? 1;
        $maxDepth = min($dbMaxDepth, $maxDepthSetting);

        // 접두사 필터링
        $query = clone $scopeQuery;
        if (! empty($prefixParts)) {
            $prefix = implode('>', $prefixParts).'>';
            $query->where($langColumn, 'like', $prefix.'%');
        }

        // max_depth 초과 시 잔여 세그먼트를 복합 옵션으로 포함
        if ($currentDepth >= $maxDepthSetting - 1 && ! empty($prefixParts)) {
            $categories = $query
                ->select('id', 'category_code', $langColumn)
                ->get();

            $options = $this->buildOverflowOptions($categories, $langColumn, $currentDepth);

            return [
                'options' => $options,
                'maxDepth' => $maxDepth,
                'isLeaf' => false,
                'leafCategoryId' => null,
                'categoryCount' => null,
            ];
        }

        // 현재 깊이에서 고유 옵션 추출
        $nextDepthIndex = $currentDepth;
        $options = $query
            ->select($langColumn)
            ->get()
            ->map(function ($c) use ($nextDepthIndex, $langColumn) {
                $parts = explode('>', $c->{$langColumn});

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
            $leafCategory = (clone $scopeQuery)->where($langColumn, $leafPath)->first();
            $leafCategoryId = $leafCategory?->id;
            $categoryCount = (clone $scopeQuery)->where($langColumn, $leafPath)->count();

            // 깊이 초과 처리: 더 깊은 카테고리가 있으면 복합 옵션으로 포함
            if ($leafCategoryId === null) {
                $deeperQuery = clone $scopeQuery;
                $deeperPrefix = implode('>', $prefixParts).'>';
                $deeperCategories = $deeperQuery
                    ->where($langColumn, 'like', $deeperPrefix.'%')
                    ->select('id', 'category_code', $langColumn)
                    ->get();

                if ($deeperCategories->isNotEmpty()) {
                    $options = $this->buildOverflowOptions($deeperCategories, $langColumn, $currentDepth);
                    $isLeaf = false;
                    $categoryCount = $deeperCategories->count();
                }
            }
        }

        return [
            'options' => $options,
            'maxDepth' => $maxDepth,
            'isLeaf' => $isLeaf,
            'leafCategoryId' => $leafCategoryId,
            'categoryCount' => $categoryCount,
        ];
    }

    /**
     * 사용자 범위 쿼리를 생성합니다.
     */
    private function buildScopeQuery(?User $user, Request $request): Builder
    {
        $query = Category::query();

        // 사용자 범위 필터
        if ($user && $user->isAdmin()) {
            // admin/superadmin: 제한 없음
        } elseif ($user) {
            $query->whereIn('user_id', [$user->id, 1]);
        } else {
            $query->where('user_id', 1);
        }

        // user_id 필터 (관리자가 특정 회원의 폴더 선택 시)
        if ($request->filled('user_id') && $user && $user->isAdmin()) {
            $query->where('user_id', (int) $request->input('user_id'));
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

        return $query;
    }

    /**
     * 깊이 초과 시 복합 옵션을 생성합니다.
     */
    private function buildOverflowOptions($categories, string $langColumn, int $currentDepth): array
    {
        return $categories
            ->map(function ($c) use ($currentDepth, $langColumn) {
                $parts = explode('>', $c->{$langColumn});
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
    }
}
