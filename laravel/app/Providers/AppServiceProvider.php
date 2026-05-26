<?php

namespace App\Providers;

use App\Services\OllamaClient;
use App\Services\OllamaRateLimiter;
use App\Services\SettingsService;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(OllamaRateLimiter::class, function ($app) {
            return new OllamaRateLimiter(
                maxAttempts: (int) config('services.ollama.rate_limit_max_attempts', 60),
                decaySeconds: (int) config('services.ollama.rate_limit_decay_seconds', 60),
            );
        });

        $this->app->singleton(OllamaClient::class, function ($app) {
            return new OllamaClient(
                rateLimiter: $app->make(OllamaRateLimiter::class),
                baseUrl: config('services.ollama.host'),
                timeout: (int) config('services.ollama.timeout', 300),
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (app()->environment('testing') && config('database.connections.pgsql.database') !== 'cl_embed_test') {
            config(['database.connections.pgsql.database' => 'cl_embed_test']);
        }

        try {
            if (! Schema::hasTable('settings')) {
                return;
            }
        } catch (\PDOException) {
            return;
        }

        $settings = app(SettingsService::class);
        config([
            // ollama (기존 + 신규)
            'services.ollama.host' => $settings->get('ollama', 'host', config('services.ollama.host')),
            'services.ollama.translation_model' => $settings->get('ollama', 'translation_model', config('services.ollama.translation_model')),
            'services.ollama.embedding_model' => $settings->get('ollama', 'embedding_model', config('services.ollama.embedding_model')),
            'services.ollama.rate_limit_max_attempts' => $settings->get('ollama', 'rate_limit_max_attempts', config('services.ollama.rate_limit_max_attempts', 60)),
            'services.ollama.rate_limit_decay_seconds' => $settings->get('ollama', 'rate_limit_decay_seconds', config('services.ollama.rate_limit_decay_seconds', 60)),
            'services.ollama.timeout' => $settings->get('ollama', 'timeout', config('services.ollama.timeout', 300)),
            'services.ollama.translation_max_attempts' => $settings->get('ollama', 'translation_max_attempts', config('services.ollama.translation_max_attempts', 3)),
            // pagination
            'services.pagination.default_per_page' => $settings->get('pagination', 'default_per_page', config('services.pagination.default_per_page', 20)),
            'services.pagination.max_per_page_guest' => $settings->get('pagination', 'max_per_page_guest', config('services.pagination.max_per_page_guest', 100)),
            // recommend
            'services.recommend.default_limit' => $settings->get('recommend', 'default_limit', config('services.recommend.default_limit', 5)),
            'services.recommend.max_per_page' => $settings->get('recommend', 'max_per_page', config('services.recommend.max_per_page', 100)),
            // auth
            'services.auth.token_expiry_days' => $settings->get('auth', 'token_expiry_days', config('services.auth.token_expiry_days', 30)),
            'services.auth.session_lifetime' => $settings->get('auth', 'session_lifetime', config('services.auth.session_lifetime', 120)),
            // category
            'services.category.code_prefix' => $settings->get('category', 'code_prefix', config('services.category.code_prefix', 'CAT_')),
            'services.category.code_random_length' => $settings->get('category', 'code_random_length', config('services.category.code_random_length', 8)),
            'services.category.code_max_attempts' => $settings->get('category', 'code_max_attempts', config('services.category.code_max_attempts', 3)),
            // validation
            'services.validation.text_max_length' => $settings->get('validation', 'text_max_length', config('services.validation.text_max_length', 500)),
            'services.validation.name_max_length' => $settings->get('validation', 'name_max_length', config('services.validation.name_max_length', 255)),
            // cache
            'services.cache.settings_ttl' => $settings->get('cache', 'settings_ttl', config('services.cache.settings_ttl', 3600)),
            // frontend
            'services.frontend.step_delay_ms' => $settings->get('frontend', 'step_delay_ms', config('services.frontend.step_delay_ms', 2000)),
        ]);
    }
}
