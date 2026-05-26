<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

class SettingsService
{
    /**
     * 캐시 TTL(초). config('services.cache.settings_ttl') 우선, 기본 3600.
     */
    private function ttl(): int
    {
        return (int) config('services.cache.settings_ttl', 3600);
    }

    /**
     * 그룹과 키로 설정 값을 조회한다.
     * 캐시 우선 조회, 없으면 DB 조회 후 캐시 저장.
     */
    public function get(string $group, string $key, mixed $default = null): mixed
    {
        $cacheKey = "settings:{$group}:{$key}";

        return Cache::remember($cacheKey, $this->ttl(), function () use ($group, $key, $default) {
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
        return Cache::remember("settings:{$group}", $this->ttl(), function () use ($group) {
            return Setting::where('group', $group)
                ->get()
                ->mapWithKeys(fn (Setting $s) => [$s->key => $this->castValue($s->value, $s->type)])
                ->all();
        });
    }

    /**
     * 설정 값을 업데이트한다. DB upsert 후 관련 캐시를 무효화한다.
     */
    public function update(string $group, string $key, mixed $value): Setting
    {
        $type = $this->inferType($value);
        $strValue = (string) $value;

        $setting = Setting::updateOrCreate(
            ['group' => $group, 'key' => $key],
            ['value' => $strValue, 'type' => $type]
        );

        Cache::forget("settings:{$group}:{$key}");
        Cache::forget("settings:{$group}");

        return $setting;
    }

    /**
     * 값의 PHP 타입으로 type 문자열을 추론한다.
     */
    private function inferType(mixed $value): string
    {
        return is_int($value) ? 'integer' : 'string';
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
