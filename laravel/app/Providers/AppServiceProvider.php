<?php

namespace App\Providers;

use App\Services\Contracts\EmbeddingProviderInterface;
use App\Services\Contracts\TranslationProviderInterface;
use App\Services\ProviderFactory;
use App\Services\SettingsService;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;
use SocialiteProviders\Manager\SocialiteWasCalled;
use SocialiteProviders\Naver\NaverExtendSocialite;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(EmbeddingProviderInterface::class, function ($app) {
            return $app->make(ProviderFactory::class)->createEmbeddingProvider();
        });

        $this->app->bind(TranslationProviderInterface::class, function ($app) {
            return $app->make(ProviderFactory::class)->createTranslationProvider();
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Event::listen(
            SocialiteWasCalled::class,
            NaverExtendSocialite::class
        );

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
            // embed (임베딩)
            'services.embed.host' => $settings->get('embed', 'host', config('services.embed.host')),
            'services.embed.api_key' => $settings->get('embed', 'api_key', ''),
            'services.embed.model' => $settings->get('embed', 'model', 'bge-m3:latest'),
            'services.embed.timeout' => $settings->get('embed', 'timeout', 300),
            'services.embed.rate_limit_max_attempts' => $settings->get('embed', 'rate_limit_max_attempts', 60),
            'services.embed.rate_limit_decay_seconds' => $settings->get('embed', 'rate_limit_decay_seconds', 60),
            // translate (번역)
            'services.translate.host' => $settings->get('translate', 'host', config('services.translate.host')),
            'services.translate.api_key' => $settings->get('translate', 'api_key', ''),
            'services.translate.model' => $settings->get('translate', 'model', 'translategemma:4b'),
            'services.translate.timeout' => $settings->get('translate', 'timeout', 300),
            'services.translate.max_attempts' => $settings->get('translate', 'max_attempts', 3),
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
            'services.category.max_depth' => $settings->get('category', 'max_depth', config('services.category.max_depth', 10)),
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
