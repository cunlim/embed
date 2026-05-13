<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Laravel\Socialite\Facades\Socialite;

class OAuthController extends Controller
{
    public function redirect(string $provider): RedirectResponse
    {
        session()->put('oauth_client', request()->query('client', 'web'));

        return Socialite::driver($provider)->redirect();
    }

    public function callback(string $provider): RedirectResponse
    {
        $socialUser = Socialite::driver($provider)->user();

        $user = User::updateOrCreate(
            [
                'provider' => $provider,
                'provider_id' => $socialUser->getId(),
            ],
            [
                'name' => $socialUser->getName() ?? $socialUser->getNickname(),
                'email' => $socialUser->getEmail(),
                'avatar' => $socialUser->getAvatar(),
            ]
        );

        $token = $user->createToken('auth_token')->plainTextToken;

        $client = session()->pull('oauth_client', 'web');
        $redirectUrl = match ($client) {
            'app' => config('services.frontend.app_callback_url'),
            default => config('services.frontend.login_url'),
        };

        return redirect($redirectUrl.'?token='.$token);
    }
}
