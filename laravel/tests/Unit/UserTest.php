<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

test('User factory는 기본 role이 member다', function () {
    $user = User::factory()->create();

    expect($user->role)->toBe('member');
});

test('isSuperAdmin은 role이 superadmin일 때만 true를 반환한다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $admin = User::factory()->create(['role' => 'admin']);
    $member = User::factory()->create(['role' => 'member']);

    expect($superadmin->isSuperAdmin())->toBeTrue();
    expect($admin->isSuperAdmin())->toBeFalse();
    expect($member->isSuperAdmin())->toBeFalse();
});

test('isAdmin은 role이 admin 또는 superadmin일 때 true를 반환한다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $admin = User::factory()->create(['role' => 'admin']);
    $member = User::factory()->create(['role' => 'member']);

    expect($superadmin->isAdmin())->toBeTrue();
    expect($admin->isAdmin())->toBeTrue();
    expect($member->isAdmin())->toBeFalse();
});
