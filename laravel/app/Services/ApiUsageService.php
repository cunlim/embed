<?php

namespace App\Services;

use App\Models\ApiKey;
use App\Models\ApiUsageLog;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ApiUsageService
{
    /**
     * API 사용 로그를 기록한다.
     */
    public function log(
        ?int $apiKeyId,
        int $userId,
        string $endpoint,
        ?array $parameters,
        int $responseStatus,
        int $processingTimeMs,
        string $source = 'api_key',
        ?string $sourceLabel = null,
    ): ApiUsageLog {
        return ApiUsageLog::create([
            'api_key_id' => $apiKeyId,
            'source' => $source,
            'source_label' => $sourceLabel,
            'user_id' => $userId,
            'endpoint' => $endpoint,
            'parameters' => $parameters,
            'response_status' => $responseStatus,
            'processing_time_ms' => $processingTimeMs,
        ]);
    }

    /**
     * 사용자의 총 API 호출 횟수를 반환한다.
     */
    public function getTotalCalls(int $userId): int
    {
        return ApiUsageLog::where('user_id', $userId)->count();
    }

    /**
     * 사용자의 오늘 API 호출 횟수를 반환한다.
     */
    public function getTodayCalls(int $userId): int
    {
        return ApiUsageLog::where('user_id', $userId)
            ->whereDate('created_at', Carbon::today())
            ->count();
    }

    /**
     * 사용자의 활성 API 키 개수를 반환한다.
     */
    public function getActiveKeyCount(int $userId): int
    {
        return ApiKey::where('user_id', $userId)
            ->where('status', 'active')
            ->count();
    }

    /**
     * API 키별 호출 횟수를 그룹핑하여 반환한다.
     * api_key 관계를 포함하여 키 이름을 함께 반환한다.
     */
    public function getCallsByKey(int $userId): Collection
    {
        $calls = ApiUsageLog::where('user_id', $userId)
            ->selectRaw('api_key_id, count(*) as total')
            ->groupBy('api_key_id')
            ->get();

        // api_key_id가 있는 경우 ApiKey 관계를 조회하여 병합
        $keyIds = $calls->pluck('api_key_id')->filter()->unique();
        if ($keyIds->isNotEmpty()) {
            $keys = ApiKey::whereIn('id', $keyIds)->get()->keyBy('id');
            $calls = $calls->map(function ($call) use ($keys) {
                $call->setRelation('apiKey', $keys->get($call->api_key_id));

                return $call;
            });
        }

        return $calls;
    }

    /**
     * 최근 사용 내역을 apiKey 관계와 함께 반환한다.
     */
    public function getRecentHistory(int $userId, int $limit = 20): Collection
    {
        return ApiUsageLog::where('user_id', $userId)
            ->with('apiKey')
            ->latest()
            ->limit($limit)
            ->get();
    }

    /**
     * 최근 N일간의 일별 호출 횟수를 반환한다.
     */
    public function getDailyChart(int $userId, int $days = 7): array
    {
        $startDate = Carbon::today()->subDays($days - 1);

        $rawData = ApiUsageLog::where('user_id', $userId)
            ->where('created_at', '>=', $startDate)
            ->selectRaw('date(created_at) as date, count(*) as total')
            ->groupBy('date')
            ->get()
            ->pluck('total', 'date');

        $chart = [];
        for ($i = 0; $i < $days; $i++) {
            $date = $startDate->copy()->addDays($i)->toDateString();
            $chart[] = [
                'date' => $date,
                'total' => (int) ($rawData[$date] ?? 0),
            ];
        }

        return $chart;
    }
}
