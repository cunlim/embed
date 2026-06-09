<?php

use App\Models\User;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;

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

test('GET /api/auth/{provider}/redirect - stores oauth_redirect in session', function () {
    $provider = Mockery::mock();
    $provider->shouldReceive('redirect')->andReturn(redirect('https://accounts.google.com/o/oauth2/auth'));

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    $this->get('/api/auth/google/redirect?redirect=/admin/member?mode=hierarchy');

    expect(session('oauth_redirect'))->toBe('/admin/member?mode=hierarchy');
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

test('GET /api/auth/{provider}/callback - links existing user by email when different provider', function () {
    User::factory()->create([
        'name' => 'GitHub Name',
        'email' => 'oauth@example.com',
        'provider' => 'github',
        'provider_id' => '99999',
        'password' => null,
    ]);

    [$abstractUser, $provider] = mockSocialiteUser();

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    $response = $this->withSession(['oauth_client' => 'web'])->get('/api/auth/google/callback');

    $response->assertRedirect();
    expect($response->getTargetUrl())->toContain('/login?token=');

    // 기존 사용자가 새 제공자 정보로 업데이트되었는지 확인
    $this->assertEquals(1, User::count());
    $user = User::first();
    expect($user->provider)->toBe('google');
    expect($user->provider_id)->toBe('12345');
    expect($user->name)->toBe('OAuth User');
});

test('GET /api/auth/{provider}/callback - redirects to app url when client is app', function () {
    [$abstractUser, $provider] = mockSocialiteUser();

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    $response = $this->withSession(['oauth_client' => 'app'])->get('/api/auth/google/callback');

    $response->assertRedirect();
    expect($response->getTargetUrl())->toContain('myapp://oauth?token=');
});

test('GET /api/auth/{provider}/callback - includes redirect param in callback url', function () {
    [$abstractUser, $provider] = mockSocialiteUser();

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    $response = $this->withSession([
        'oauth_client' => 'web',
        'oauth_redirect' => '/admin/member?mode=hierarchy',
    ])->get('/api/auth/google/callback');

    $response->assertRedirect();
    $targetUrl = $response->getTargetUrl();
    expect($targetUrl)->toContain('/login?token=');
    expect($targetUrl)->toContain('redirect='.urlencode('/admin/member?mode=hierarchy'));
});

test('GET /api/auth/{provider}/callback - omits redirect param when not set', function () {
    [$abstractUser, $provider] = mockSocialiteUser();

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    $response = $this->withSession(['oauth_client' => 'web'])->get('/api/auth/google/callback');

    $response->assertRedirect();
    $targetUrl = $response->getTargetUrl();
    expect($targetUrl)->toContain('/login?token=');
    expect($targetUrl)->not->toContain('redirect=');
});

test('GET /api/auth/{provider}/callback - returns 500 for unsupported provider', function () {
    Socialite::shouldReceive('driver')->with('invalid')->andThrow(
        new InvalidStateException
    );

    $response = $this->get('/api/auth/invalid/callback');

    $response->assertServerError();
});
