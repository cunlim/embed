<?php

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;

beforeEach(function () {
    Schema::create('users', function (Blueprint $table) {
        $table->id();
        $table->string('name');
        $table->string('email')->unique()->nullable();
        $table->timestamp('email_verified_at')->nullable();
        $table->string('password')->nullable();
        $table->string('provider')->nullable();
        $table->string('provider_id')->nullable();
        $table->string('avatar')->nullable();
        $table->unique(['provider', 'provider_id'], 'users_provider_provider_id_unique');
        $table->rememberToken();
        $table->timestamps();
    });

    Schema::create('personal_access_tokens', function (Blueprint $table) {
        $table->id();
        $table->morphs('tokenable');
        $table->string('name');
        $table->string('token', 64)->unique();
        $table->text('abilities')->nullable();
        $table->timestamp('last_used_at')->nullable();
        $table->timestamp('expires_at')->nullable();
        $table->timestamps();
    });
});

afterEach(function () {
    Schema::dropIfExists('personal_access_tokens');
    Schema::dropIfExists('users');
});

function mockSocialiteUser(): array
{
    $abstractUser = Mockery::mock();
    $abstractUser->shouldReceive('getId')->andReturn('12345');
    $abstractUser->shouldReceive('getName')->andReturn('OAuth User');
    $abstractUser->shouldReceive('getNickname')->andReturn(null);
    $abstractUser->shouldReceive('getEmail')->andReturn('oauth@example.com');
    $abstractUser->shouldReceive('getAvatar')->andReturn('https://avatar.url');

    $provider = Mockery::mock();
    $provider->shouldReceive('user')->andReturn($abstractUser);

    return [$abstractUser, $provider];
}

// ---- redirect ----

test('GET /api/auth/{provider}/redirect - returns redirect response for google', function () {
    $provider = Mockery::mock();
    $provider->shouldReceive('redirect')->andReturn(redirect('https://accounts.google.com/o/oauth2/auth'));

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    $response = $this->get('/api/auth/google/redirect');

    $response->assertRedirect();
});

test('GET /api/auth/{provider}/redirect - handles github provider', function () {
    $provider = Mockery::mock();
    $provider->shouldReceive('redirect')->andReturn(redirect('https://github.com/login/oauth/authorize'));

    Socialite::shouldReceive('driver')->with('github')->andReturn($provider);

    $response = $this->get('/api/auth/github/redirect');

    $response->assertRedirect();
});

test('GET /api/auth/{provider}/redirect - stores oauth_client in session', function () {
    $provider = Mockery::mock();
    $provider->shouldReceive('redirect')->andReturn(redirect('https://accounts.google.com/o/oauth2/auth'));

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    $this->get('/api/auth/google/redirect?client=app');

    expect(session('oauth_client'))->toBe('app');
});

// ---- callback ----

test('GET /api/auth/{provider}/callback - creates user and redirects with token for new OAuth user', function () {
    [$abstractUser, $provider] = mockSocialiteUser();

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    $response = $this->withSession(['oauth_client' => 'web'])->get('/api/auth/google/callback');

    $response->assertRedirect();
    expect($response->getTargetUrl())->toContain('/login?token=');

    $this->assertDatabaseHas('users', [
        'provider' => 'google',
        'provider_id' => '12345',
        'email' => 'oauth@example.com',
        'name' => 'OAuth User',
    ]);
});

test('GET /api/auth/{provider}/callback - updates existing OAuth user on re-login', function () {
    User::factory()->create([
        'name' => 'Old Name',
        'email' => 'oauth@example.com',
        'provider' => 'google',
        'provider_id' => '12345',
        'password' => null,
    ]);

    [$abstractUser, $provider] = mockSocialiteUser();

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    $response = $this->withSession(['oauth_client' => 'web'])->get('/api/auth/google/callback');

    $response->assertRedirect();
    expect($response->getTargetUrl())->toContain('/login?token=');

    expect(User::where('provider', 'google')->where('provider_id', '12345')->count())->toBe(1);
    expect(User::where('provider', 'google')->where('provider_id', '12345')->first()->name)->toBe('OAuth User');
});

test('GET /api/auth/{provider}/callback - redirects to app url when client is app', function () {
    [$abstractUser, $provider] = mockSocialiteUser();

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    $response = $this->withSession(['oauth_client' => 'app'])->get('/api/auth/google/callback');

    $response->assertRedirect();
    expect($response->getTargetUrl())->toContain('myapp://oauth?token=');
});

test('GET /api/auth/{provider}/callback - returns 500 for unsupported provider', function () {
    Socialite::shouldReceive('driver')->with('invalid')->andThrow(
        new InvalidStateException
    );

    $response = $this->get('/api/auth/invalid/callback');

    $response->assertServerError();
});
