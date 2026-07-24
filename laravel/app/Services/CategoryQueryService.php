<?php

namespace App\Services;

use App\Models\Category;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class CategoryQueryService
{
    /**
     * 사용자 범위 필터를 적용합니다.
     * - 관리자 + 명시적 user_id: 해당 사용자로 필터
     * - filter=my: 현재 사용자만 (비로그인 시 결과 없음)
     * - 기본: 관리자=전체, 회원=본인+user_id=1, 비로그인=user_id=1
     */
    public static function applyUserScope(Builder $query, ?User $user, Request $request): Builder
    {
        $hasExplicitUserId = $request->filled('user_id') && $user && $user->isAdmin();

        if ($hasExplicitUserId) {
            $query->where('user_id', (int) $request->input('user_id'));
        } elseif ($request->input('owner_scope') === 'my') {
            if ($user) {
                $query->where('user_id', $user->id);
            } else {
                $query->whereRaw('1 = 0');
            }
        } else {
            if ($user && $user->isAdmin()) {
                // admin/superadmin: no user_id restriction
            } elseif ($user) {
                $hasSteps = $request->filled('steps') && is_array($request->input('steps')) && ! empty($request->input('steps'));
                if ($hasSteps) {
                    $query->where('user_id', $user->id);
                } else {
                    $query->where(function ($q) use ($user) {
                        $q->where('user_id', $user->id)
                            ->orWhere('user_id', 1);
                    });
                }
            } else {
                $query->where('user_id', 1);
            }
        }

        return $query;
    }

    /**
     * 검색 필터를 적용합니다.
     * - hierarchy_lang이 ko/en/zh이면 해당 컬럼에서 접두사 검색
     * - 그렇지 않으면 모든 언어 컬럼에서 부분 검색
     */
    public static function applySearch(Builder $query, Request $request): Builder
    {
        if (! $request->filled('like_query')) {
            return $query;
        }

        $search = $request->input('like_query');
        $searchLang = $request->input('hierarchy_lang');

        if ($searchLang && in_array($searchLang, ['ko', 'en', 'zh'])) {
            $langColumn = 'category_name_'.$searchLang;
            $query->where($langColumn, 'LIKE', $search.'>%');
        } else {
            $query->where(function ($q) use ($search) {
                $q->where('category_name_ko', 'LIKE', '%'.$search.'%')
                    ->orWhere('category_name_en', 'LIKE', '%'.$search.'%')
                    ->orWhere('category_name_zh', 'LIKE', '%'.$search.'%')
                    ->orWhere('category_code', 'LIKE', '%'.$search.'%');
            });
        }

        return $query;
    }

    /**
     * 폴더 필터를 적용합니다. "기본폴더"는 NULL로 변환합니다.
     */
    public static function applyFolderFilter(Builder $query, Request $request): Builder
    {
        if (! $request->filled('folder')) {
            return $query;
        }

        $folder = $request->input('folder');
        if ($folder === '기본폴더') {
            $query->whereNull('folder');
        } else {
            $query->where('folder', $folder);
        }

        return $query;
    }

    /**
     * Steps 필터를 적용합니다. 체크된 step 중 하나라도 누락된 카테고리만 조회합니다.
     */
    public static function applyStepsFilter(Builder $query, Request $request): Builder
    {
        $validSteps = ['translation.en', 'translation.zh', 'embedding.ko', 'embedding.en', 'embedding.zh'];
        $checkedSteps = $request->input('steps');

        if (is_array($checkedSteps) && ! empty($checkedSteps)) {
            $checkedSteps = array_values(array_intersect($checkedSteps, $validSteps));
        } else {
            $checkedSteps = [];
        }

        if (empty($checkedSteps)) {
            return $query;
        }

        $embedModelName = config('services.embed.model');

        $query->where(function ($q) use ($checkedSteps, $embedModelName) {
            if (in_array('embedding.ko', $checkedSteps)) {
                $q->orWhere(function ($q2) use ($embedModelName) {
                    $q2->whereDoesntHave('embeddings', function ($q3) use ($embedModelName) {
                        $q3->where('language', 'ko')
                            ->where('embed_model_name', $embedModelName)
                            ->whereNotNull('embedding');
                    });
                });
            }

            if (in_array('translation.en', $checkedSteps)) {
                $q->orWhere(function ($q2) {
                    $q2->whereNull('category_name_en')
                        ->orWhere('category_name_en', '');
                });
            }

            if (in_array('embedding.en', $checkedSteps)) {
                $q->orWhere(function ($q2) use ($checkedSteps, $embedModelName) {
                    $q2->whereDoesntHave('embeddings', function ($q3) use ($embedModelName) {
                        $q3->where('language', 'en')
                            ->where('embed_model_name', $embedModelName)
                            ->whereNotNull('embedding');
                    });
                    if (! in_array('translation.en', $checkedSteps)) {
                        $q2->whereNotNull('category_name_en')
                            ->where('category_name_en', '!=', '');
                    }
                });
            }

            if (in_array('translation.zh', $checkedSteps)) {
                $q->orWhere(function ($q2) {
                    $q2->whereNull('category_name_zh')
                        ->orWhere('category_name_zh', '');
                });
            }

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

        return $query;
    }

    /**
     * 모든 필터를 조합하여 완성된 쿼리를 반환합니다.
     * index()와 batchStatus()에서 공통으로 사용합니다.
     */
    public static function buildListQuery(?User $user, Request $request, bool $withEmbeddings = false): Builder
    {
        $query = $withEmbeddings
            ? Category::query()->with('embeddings')
            : Category::query();

        static::applyUserScope($query, $user, $request);
        static::applySearch($query, $request);
        static::applyFolderFilter($query, $request);
        static::applyStepsFilter($query, $request);

        return $query;
    }
}
