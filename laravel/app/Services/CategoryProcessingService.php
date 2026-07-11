<?php

namespace App\Services;

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\SearchLog;

class CategoryProcessingService
{
    /**
     * 카테고리 ID 목록에 대해 임베딩 존재 여부를 경량 쿼리로 조회합니다.
     * 벡터 데이터는 제외하고 (category_id, language) 맵만 반환합니다.
     *
     * @param  int[]  $categoryIds
     * @return array<int, string[]> category_id → ['ko', 'en', ...] 맵
     */
    public static function getEmbeddingExistsMap(array $categoryIds): array
    {
        if (empty($categoryIds)) {
            return [];
        }

        $embedModelName = config('services.embed.model');
        $embeddingExistsMap = [];

        $embeddingRows = CategoryEmbedding::whereIn('category_id', $categoryIds)
            ->where('embed_model_name', $embedModelName)
            ->whereNotNull('embedding')
            ->select('category_id', 'language')
            ->get();

        foreach ($embeddingRows as $row) {
            $embeddingExistsMap[$row->category_id][] = $row->language;
        }

        return $embeddingExistsMap;
    }

    /**
     * 카테고리의 누락 step을 계산합니다.
     *
     * @param  string[]  $checkedSteps  프론트엔드에서 전달된 선택 step 목록
     * @param  string[]  $embeddedLangs  이미 임베딩이 존재하는 언어 목록
     * @return string[] 처리가 필요한 step 이름 배열
     */
    public function determineMissingSteps(Category $category, array $checkedSteps, array $embeddedLangs): array
    {
        $steps = [];

        // en: 번역 + 임베딩
        $enTranslated = (bool) $category->category_name_en;
        $enEmbedded = in_array('en', $embeddedLangs);

        if (! $enTranslated && in_array('translation.en', $checkedSteps)) {
            $steps[] = 'translation.en';
        }
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

    /**
     * 단일 processing step을 실행합니다 (번역 또는 임베딩).
     *
     * @return array{status: 'completed'|'failed', result?: string, error?: string}
     */
    public function runStep(Category $category, string $step): array
    {
        $embedModelName = config('services.embed.model');
        $translator = app(Translator::class);
        $embedder = app(EmbeddingGenerator::class);

        try {
            [$type, $lang] = explode('.', $step);

            if ($type === 'translation') {
                $column = $lang === 'zh' ? 'category_name_zh' : 'category_name_en';
                $translated = $translator->translate($category->category_name_ko, $lang);
                $category->{$column} = $translated;
                $category->save();

                return [
                    'status' => 'completed',
                    'result' => $translated,
                ];
            }

            // embedding
            $textForEmbedding = match ($lang) {
                'ko' => $category->category_name_ko,
                'zh' => $category->category_name_zh,
                'en' => $category->category_name_en,
            };

            if ($textForEmbedding === null) {
                return [
                    'status' => 'failed',
                    'error' => "{$lang} 번역 텍스트가 없습니다. 먼저 번역을 실행해주세요.",
                ];
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

            // 임베딩 데이터를 search_logs 캐시 테이블에도 동기화 저장
            $normalizer = app(SearchNormalizer::class);
            $normalized = $normalizer->normalize($textForEmbedding);

            // 정규화된 텍스트가 빈 문자열이면 캐시 의미가 없으므로 건너뛴다.
            // PostgreSQL 에서 NULL 비교 문제도 함께 방지된다.
            if ($normalized !== '') {
                SearchLog::updateOrCreate(
                    [
                        'normalized_keyword' => $normalized,
                        'embed_model_name' => $embedModelName,
                    ],
                    [
                        'user_id' => auth('sanctum')->id() ?? $category->user_id,
                        'search_keyword' => $textForEmbedding,
                        'embedding' => $vector,
                    ]
                );
            }

            return [
                'status' => 'completed',
                'result' => json_encode(array_slice($vector, 0, 10)),
            ];
        } catch (\Throwable $e) {
            $errorMsg = $e->getMessage();
            if (str_contains($errorMsg, 'Ollama rate limit exceeded')) {
                $errorMsg = 'Ollama rate limit exceeded';
            }

            return [
                'status' => 'failed',
                'error' => $errorMsg,
                'http_code' => 500,
            ];
        }
    }

    /**
     * 카테고리 텍스트를 업데이트하고 해당 언어의 임베딩을 삭제합니다.
     */
    public function updateText(Category $category, string $field, ?string $value): bool
    {
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

        return true;
    }

    /**
     * 카테고리와 관련 임베딩을 삭제합니다.
     */
    public function deleteWithEmbeddings(Category $category): bool
    {
        CategoryEmbedding::where('category_id', $category->id)->delete();
        $category->delete();

        return true;
    }

    /**
     * 카테고리를 생성합니다.
     *
     * @param  int  $userId  소유자 ID
     * @param  string  $categoryNameKo  한국어 카테고리명 (필수)
     * @param  string  $categoryCode  카테고리 코드 (없으면 자동 생성)
     * @param  ?string  $categoryNameEn  영어 카테고리명
     * @param  ?string  $categoryNameZh  중국어 카테고리명
     * @param  ?string  $folder  폴더명 ("기본폴더"는 NULL로 변환)
     */
    public function create(
        int $userId,
        string $categoryNameKo,
        ?string $categoryCode = null,
        ?string $categoryNameEn = null,
        ?string $categoryNameZh = null,
        ?string $folder = null,
    ): Category {
        return Category::create([
            'category_code' => $categoryCode ?: Category::generateCode($userId),
            'category_name_ko' => $categoryNameKo,
            'category_name_en' => $categoryNameEn,
            'category_name_zh' => $categoryNameZh,
            'user_id' => $userId,
            // "기본폴더"는 폴더 미지정을 의미하므로 NULL로 저장
            'folder' => $folder === '기본폴더' ? null : $folder,
        ]);
    }
}
