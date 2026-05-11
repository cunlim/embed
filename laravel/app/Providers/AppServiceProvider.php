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
                timeout: 300
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (! Schema::hasTable('settings')) {
            return;
        }

        $settings = app(SettingsService::class);
        config([
            'services.ollama.host' => $settings->get('ollama', 'host', config('services.ollama.host')),
            'services.ollama.translation_model' => $settings->get('ollama', 'translation_model', config('services.ollama.translation_model')),
            'services.ollama.embedding_model' => $settings->get('ollama', 'embedding_model', config('services.ollama.embedding_model')),
            'services.ollama.rate_limit_max_attempts' => $settings->get('ollama', 'rate_limit_max_attempts', config('services.ollama.rate_limit_max_attempts', 60)),
            'services.ollama.rate_limit_decay_seconds' => $settings->get('ollama', 'rate_limit_decay_seconds', config('services.ollama.rate_limit_decay_seconds', 60)),
        ]);
    }
}
