<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'embed' => [
        'host' => env('EMBED_HOST', 'http://host.docker.internal:11434'),
        'api_key' => env('EMBED_API_KEY', ''),
        'model' => 'bge-m3:latest',
        'timeout' => 300,
        'rate_limit_max_attempts' => 60,
        'rate_limit_decay_seconds' => 60,
    ],

    'translate' => [
        'host' => env('TRANSLATE_HOST', 'http://host.docker.internal:11434'),
        'api_key' => env('TRANSLATE_API_KEY', ''),
        'model' => 'translategemma:4b',
        'timeout' => 300,
        'max_attempts' => 3,
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI'),
    ],

    'github' => [
        'client_id' => env('GITHUB_CLIENT_ID'),
        'client_secret' => env('GITHUB_CLIENT_SECRET'),
        'redirect' => env('GITHUB_REDIRECT_URI'),
    ],

    'naver' => [
        'client_id' => env('NAVER_CLIENT_ID'),
        'client_secret' => env('NAVER_CLIENT_SECRET'),
        'redirect' => env('NAVER_REDIRECT_URI'),
    ],

    'frontend' => [
        'login_url' => env('FRONTEND_LOGIN_URL', '/login'),
        'app_callback_url' => env('APP_CALLBACK_URL', 'myapp://oauth'),
        'step_delay_ms' => 2000,
    ],

    'pagination' => [
        'default_per_page' => 20,
        'max_per_page_guest' => 100,
        'max_per_page_api' => 50,
    ],

    'recommend' => [
        'default_limit' => 5,
        'max_per_page' => 100,
    ],

    'auth' => [
        'token_expiry_days' => 30,
        'session_lifetime' => 120,
    ],

    'category' => [
        'code_prefix' => 'CAT_',
        'code_random_length' => 8,
        'code_max_attempts' => 3,
        'max_depth' => 10,
    ],

    'validation' => [
        'text_max_length' => 500,
        'name_max_length' => 255,
    ],

    'cache' => [
        'settings_ttl' => 3600,
    ],

];
