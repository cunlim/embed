<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

// ---- register ----

test('POST /api/auth/register - registers user and returns token', function () {
    $response = $this->postJson('/api/auth/register', [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.user.name', 'Test User')
        ->assertJsonPath('data.user.email', 'test@example.com')
        ->assertJsonPath('data.token_type', 'Bearer')
        ->assertJsonStructure(['data' => ['user' => ['id', 'name', 'email', 'created_at'], 'token']]);

    $this->assertDatabaseHas('users', ['email' => 'test@example.com']);
});

test('POST /api/auth/register - returns 422 when name missing', function () {
    $response = $this->postJson('/api/auth/register', [
        'email' => 'test@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['name']);
});

test('POST /api/auth/register - returns 422 when email missing', function () {
    $response = $this->postJson('/api/auth/register', [
        'name' => 'Test User',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

test('POST /api/auth/register - returns 422 when password too short', function () {
    $response = $this->postJson('/api/auth/register', [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'short',
        'password_confirmation' => 'short',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['password']);
});

test('POST /api/auth/register - returns 422 when password confirmation mismatch', function () {
    $response = $this->postJson('/api/auth/register', [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password123',
        'password_confirmation' => 'different',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['password']);
});

test('POST /api/auth/register - returns 422 when email duplicate', function () {
    User::factory()->create(['email' => 'existing@example.com']);

    $response = $this->postJson('/api/auth/register', [
        'name' => 'Test User',
        'email' => 'existing@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

// ---- login ----

test('POST /api/auth/login - logs in with valid credentials', function () {
    $user = User::factory()->create([
        'email' => 'login@example.com',
        'password' => Hash::make('password123'),
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'login@example.com',
        'password' => 'password123',
    ]);

    $response->assertOk()
        ->assertJsonPath('data.user.email', 'login@example.com')
        ->assertJsonPath('data.token_type', 'Bearer')
        ->assertJsonStructure(['data' => ['user', 'token']]);
});

test('POST /api/auth/login - returns 401 for wrong password', function () {
    $user = User::factory()->create([
        'email' => 'login@example.com',
        'password' => Hash::make('password123'),
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'login@example.com',
        'password' => 'wrongpassword',
    ]);

    $response->assertUnauthorized();
});

test('POST /api/auth/login - returns 422 when email missing', function () {
    $response = $this->postJson('/api/auth/login', [
        'password' => 'password123',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

// ---- logout ----

test('POST /api/auth/logout - deletes current token', function () {
    $user = User::factory()->create();
    $token = $user->createToken('auth_token')->plainTextToken;

    $response = $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson('/api/auth/logout');

    $response->assertOk()
        ->assertJsonPath('message', '로그아웃 되었습니다.');

    expect($user->tokens()->count())->toBe(0);
});

test('POST /api/auth/logout - returns 401 when unauthenticated', function () {
    $response = $this->postJson('/api/auth/logout');

    $response->assertUnauthorized();
});

// ---- user ----

test('GET /api/auth/user - returns authenticated user info', function () {
    $user = User::factory()->create();
    $token = $user->createToken('auth_token')->plainTextToken;

    $response = $this->withHeader('Authorization', 'Bearer '.$token)
        ->getJson('/api/auth/user');

    $response->assertOk()
        ->assertJsonPath('data.id', $user->id)
        ->assertJsonPath('data.name', $user->name)
        ->assertJsonPath('data.email', $user->email);
});

test('GET /api/auth/user - returns 401 when unauthenticated', function () {
    $response = $this->getJson('/api/auth/user');

    $response->assertUnauthorized();
});
