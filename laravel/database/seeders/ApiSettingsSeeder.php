<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class ApiSettingsSeeder extends Seeder
{
    public function run(): void
    {
        Setting::updateOrCreate(
            ['group' => 'api', 'key' => 'free_quota'],
            ['value' => '100', 'type' => 'integer', 'description' => '신규 가입 시 무료 호출 회수']
        );

        Setting::updateOrCreate(
            ['group' => 'api', 'key' => 'rate_limit_per_minute'],
            ['value' => '60', 'type' => 'integer', 'description' => '분당 최대 호출 수']
        );
    }
}
