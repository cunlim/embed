<?php

namespace App\Services;

use App\Models\Category;
use App\Models\CategoryEmbedding;
use Illuminate\Support\Collection;

class CategoryProcessingService
{
    private const STEP_ORDER = ['embedding.ko', 'translation.en', 'embedding.en', 'translation.zh', 'embedding.zh'];

    private const MAX_RETRIES = 2;

    private const RETRY_DELAY_US = 1_000_000; // 1초 (마이크로초)

    private const STEP_DELAY_US = 2_000_000;  // 2초 (마이크로초)

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
     * 배치 실행: 여러 카테고리의 누락 step을 순차 실행합니다.
     *
     * @param  Collection  $categories
     * @param  string[]  $checkedSteps
     * @return array{
     *   total_categories: int,
     *   completed_categories: int,
     *   failed_categories: int,
     *   total_steps: int,
     *   completed_steps: int,
     *   failed_steps: int,
     *   categories: array
     * }
     */
    public function batchRun($categories, array $checkedSteps): array
    {
        $result = [
            'total_categories' => $categories->count(),
            'completed_categories' => 0,
            'failed_categories' => 0,
            'total_steps' => 0,
            'completed_steps' => 0,
            'failed_steps' => 0,
            'categories' => [],
        ];

        $embedModelName = config('services.embed.model');

        // 임베딩 존재 여부를 경량 쿼리로 조회
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

        foreach ($categories as $cat) {
            $embeddedLangs = $embeddingExistsMap[$cat->id] ?? [];
            $missingSteps = $this->determineMissingSteps($cat, $checkedSteps, $embeddedLangs);

            // STEP_ORDER 순서로 정렬
            $orderedSteps = array_values(array_intersect(self::STEP_ORDER, $missingSteps));

            $catResult = [
                'id' => $cat->id,
                'category_name_ko' => $cat->category_name_ko,
                'status' => 'completed',
                'steps' => [],
            ];

            $result['total_steps'] += count($orderedSteps);

            foreach ($orderedSteps as $stepIndex => $step) {
                // 재시도 로직
                $stepResult = null;
                $lastError = null;

                for ($attempt = 0; $attempt <= self::MAX_RETRIES; $attempt++) {
                    try {
                        $stepResult = $this->runStep($cat, $step);

                        if ($stepResult['status'] === 'completed') {
                            break; // 성공
                        }

                        // validation 실패 (422) — 재시도 안 함
                        $lastError = $stepResult['error'] ?? 'Unknown error';
                        break;
                    } catch (\Throwable $e) {
                        $lastError = $e->getMessage();
                        if (str_contains($lastError, 'Ollama rate limit exceeded')) {
                            $lastError = 'Ollama rate limit exceeded';
                        }

                        // 마지막 시도가 아니면 지수 백오프 대기
                        if ($attempt < self::MAX_RETRIES) {
                            usleep(self::RETRY_DELAY_US * (2 ** $attempt));
                        }
                    }
                }

                if ($stepResult && $stepResult['status'] === 'completed') {
                    $result['completed_steps']++;
                    $catResult['steps'][] = [
                        'step' => $step,
                        'status' => 'completed',
                        'result' => $stepResult['result'],
                        'error' => null,
                    ];
                } else {
                    $result['failed_steps']++;
                    $catResult['status'] = 'failed';
                    $catResult['steps'][] = [
                        'step' => $step,
                        'status' => 'failed',
                        'result' => null,
                        'error' => $lastError ?? 'Unknown error',
                    ];

                    // 나머지 step 건너뛰기
                    foreach (array_slice($orderedSteps, $stepIndex + 1) as $skippedStep) {
                        $catResult['steps'][] = [
                            'step' => $skippedStep,
                            'status' => 'skipped',
                            'result' => null,
                            'error' => null,
                        ];
                        $result['total_steps']--; // 스킵된 step은 total에서 제외
                    }
                    break;
                }

                // 카테고리 내 step 간 딜레이
                if ($stepIndex < count($orderedSteps) - 1) {
                    usleep(self::STEP_DELAY_US);
                }
            }

            if ($catResult['status'] === 'completed') {
                $result['completed_categories']++;
            } else {
                $result['failed_categories']++;
            }

            $result['categories'][] = $catResult;

            // 클라이언트 연결 종료 확인
            if (connection_aborted()) {
                break;
            }
        }

        return $result;
    }
}
