<?php

use App\Models\Setting;
use App\Services\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    Cache::flush();
});

test('get은 DB에서 설정 값을 조회하고 캐시한다', function () {
    Setting::factory()->create([
        'group' => 'embed',
        'key' => 'host',
        'value' => 'http://localhost:11434',
        'type' => 'string',
    ]);

    $service = new SettingsService;
    $result = $service->get('embed', 'host');

    expect($result)->toBe('http://localhost:11434');
});

test('get은 캐시된 값이 있으면 DB 조회를 생략한다', function () {
    Setting::factory()->create([
        'group' => 'embed',
        'key' => 'host',
        'value' => 'http://localhost:11434',
        'type' => 'string',
    ]);

    $service = new SettingsService;

    // 첫 호출: DB에서 값을 가져와 캐시에 저장
    $first = $service->get('embed', 'host');
    expect($first)->toBe('http://localhost:11434');

    // DB 값 변경
    DB::table('settings')->where('group', 'embed')->where('key', 'host')->update(['value' => 'http://changed:11434']);

    // 캐시된 값이 반환되어야 함 (변경 전 값)
    $second = $service->get('embed', 'host');
    expect($second)->toBe('http://localhost:11434');
});

test('get은 값이 없으면 기본값을 반환한다', function () {
    $service = new SettingsService;
    $result = $service->get('embed', 'nonexistent', 'fallback');

    expect($result)->toBe('fallback');
});

test('get은 integer 타입을 int로 캐스팅한다', function () {
    Setting::factory()->create([
        'group' => 'test',
        'key' => 'timeout',
        'value' => '300',
        'type' => 'integer',
    ]);

    $service = new SettingsService;
    $result = $service->get('test', 'timeout');

    expect($result)->toBeInt();
    expect($result)->toBe(300);
});

test('all은 그룹의 모든 설정을 연관 배열로 반환한다', function () {
    // seeder가 생성한 embed 그룹 설정을 정리하여 테스트 격리
    Setting::where('group', 'embed')->delete();
    Cache::forget('settings:embed');

    Setting::factory()->create([
        'group' => 'embed',
        'key' => 'host',
        'value' => 'http://localhost:11434',
        'type' => 'string',
    ]);
    Setting::factory()->create([
        'group' => 'embed',
        'key' => 'model',
        'value' => 'bge-m3:latest',
        'type' => 'string',
    ]);

    $service = new SettingsService;
    $result = $service->all('embed');

    expect($result)->toBe([
        'host' => 'http://localhost:11434',
        'model' => 'bge-m3:latest',
    ]);
});

test('all은 빈 그룹에 대해 빈 배열을 반환한다', function () {
    $service = new SettingsService;
    $result = $service->all('nonexistent');

    expect($result)->toBe([]);
});

test('all은 그룹 전체를 하나의 캐시 키로 저장한다', function () {
    // seeder가 생성한 embed 그룹 설정을 정리하여 테스트 격리
    Setting::where('group', 'embed')->delete();
    Cache::forget('settings:embed');

    Setting::factory()->create([
        'group' => 'embed',
        'key' => 'host',
        'value' => 'http://localhost:11434',
        'type' => 'string',
    ]);

    $service = new SettingsService;
    $service->all('embed');

    // 그룹 캐시 키로 저장되었는지 확인
    $cached = Cache::get('settings:embed');
    expect($cached)->toBeArray();
    expect($cached['host'])->toBe('http://localhost:11434');
});
