<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Laravel\Socialite\Facades\Socialite;
use OpenApi\Attributes as OA;

class OAuthController extends Controller
{
    #[OA\Get(
        path: '/api/auth/{provider}/redirect',
        summary: 'OAuth 로그인 리다이렉트',
        description: '지정된 제공자의 OAuth 로그인 페이지로 리다이렉트합니다.',
        tags: ['Auth'],
        parameters: [
            new OA\Parameter(
                name: 'provider',
                in: 'path',
                required: true,
                description: 'OAuth 제공자',
                schema: new OA\Schema(type: 'string', enum: ['google', 'github', 'naver'])
            ),
            new OA\Parameter(
                name: 'client',
                in: 'query',
                required: false,
                description: 'OAuth 완료 후 리다이렉트될 클라이언트 유형',
                schema: new OA\Schema(type: 'string', enum: ['web', 'app'], default: 'web')
            ),
            new OA\Parameter(
                name: 'redirect',
                in: 'query',
                required: false,
                description: '로그인 성공 후 리다이렉트될 경로',
                schema: new OA\Schema(type: 'string')
            ),
        ],
        responses: [
            new OA\Response(
                response: 302,
                description: 'OAuth 제공자 로그인 페이지로 리다이렉트',
            ),
        ]
    )]
    public function redirect(string $provider): RedirectResponse
    {
        session()->put('oauth_client', request()->query('client', 'web'));
        session()->put('oauth_redirect', request()->query('redirect'));

        return Socialite::driver($provider)->redirect();
    }

    #[OA\Get(
        path: '/api/auth/{provider}/callback',
        summary: 'OAuth 로그인 콜백',
        description: 'OAuth 제공자의 인증 결과를 처리하고 Sanctum 토큰을 발급한 후 프론트엔드로 리다이렉트합니다.',
        tags: ['Auth'],
        parameters: [
            new OA\Parameter(
                name: 'provider',
                in: 'path',
                required: true,
                description: 'OAuth 제공자',
                schema: new OA\Schema(type: 'string', enum: ['google', 'github', 'naver'])
            ),
            new OA\Parameter(
                name: 'code',
                in: 'query',
                required: true,
                description: 'OAuth 인증 코드',
                schema: new OA\Schema(type: 'string')
            ),
            new OA\Parameter(
                name: 'state',
                in: 'query',
                required: true,
                description: 'OAuth state 파라미터',
                schema: new OA\Schema(type: 'string')
            ),
        ],
        responses: [
            new OA\Response(
                response: 302,
                description: '프론트엔드로 리다이렉트 (URL에 token 쿼리 파라미터 포함)',
            ),
            new OA\Response(
                response: 429,
                description: '요청 횟수 초과',
            ),
        ]
    )]
    public function callback(string $provider): RedirectResponse
    {
        $socialUser = Socialite::driver($provider)->user();

        $user = User::where('provider', $provider)
            ->where('provider_id', $socialUser->getId())
            ->first();

        if (! $user && $socialUser->getEmail()) {
            $user = User::where('email', $socialUser->getEmail())->first();
        }

        if ($user) {
            $user->update([
                'provider' => $provider,
                'provider_id' => $socialUser->getId(),
                'name' => $socialUser->getName() ?? $socialUser->getNickname() ?? $user->name,
                'email' => $socialUser->getEmail() ?? $user->email,
                'avatar' => $socialUser->getAvatar() ?? $user->avatar,
            ]);
        } else {
            $user = User::create([
                'provider' => $provider,
                'provider_id' => $socialUser->getId(),
                'name' => $socialUser->getName() ?? $socialUser->getNickname(),
                'email' => $socialUser->getEmail(),
                'avatar' => $socialUser->getAvatar(),
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        $client = session()->pull('oauth_client', 'web');
        $redirectUrl = match ($client) {
            'app' => config('services.frontend.app_callback_url'),
            default => config('services.frontend.login_url'),
        };

        $url = $redirectUrl.'?token='.$token;

        $oauthRedirect = session()->pull('oauth_redirect');
        if ($oauthRedirect) {
            $url .= '&redirect='.urlencode($oauthRedirect);
        }

        return redirect($url);
    }
}
