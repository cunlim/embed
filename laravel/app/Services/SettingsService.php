<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

class SettingsService
{
    /**
     * 그룹과 키로 설정 값을 조회한다.
     * 캐시 우선 조회, 없으면 DB 조회 후 캐시 저장.
     */
    public function get(string $group, string $key, mixed $default = null): mixed
    {
        $cacheKey = "settings:{$group}:{$key}";

        return Cache::remember($cacheKey, 3600, function () use ($group, $key, $default) {
            $setting = Setting::where('group', $group)->where('key', $key)->first();

            if ($setting === null) {
                return $default;
            }

            return $this->castValue($setting->value, $setting->type);
        });
    }

    /**
     * 그룹의 모든 설정을 연관 배열로 반환한다.
     */
    public function all(string $group): array
    {
        return Cache::remember("settings:{$group}", 3600, function () use ($group) {
            return Setting::where('group', $group)
                ->get()
                ->mapWithKeys(fn (Setting $s) => [$s->key => $this->castValue($s->value, $s->type)])
                ->all();
        });
    }

    /**
     * type에 따라 value를 캐스팅한다.
     */
    private function castValue(string $value, string $type): mixed
    {
        if ($type === 'integer') {
            return (int) $value;
        }

        return $value;
    }
}
