<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use OpenApi\Attributes as OA;

class AuthController extends Controller
{
    #[OA\Post(
        path: '/api/auth/register',
        summary: '회원가입',
        description: '이메일과 비밀번호로 새 계정을 생성하고 Sanctum 토큰을 발급합니다.',
        tags: ['Auth'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'email', 'password', 'password_confirmation'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', maxLength: 255),
                    new OA\Property(property: 'email', type: 'string', format: 'email', maxLength: 255),
                    new OA\Property(property: 'password', type: 'string', minLength: 8),
                    new OA\Property(property: 'password_confirmation', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: '회원가입 성공',
                content: new OA\JsonContent(
                    type: 'object',
                    properties: [
                        new OA\Property(property: 'data', type: 'object', properties: [
                            new OA\Property(property: 'user', type: 'object', properties: [
                                new OA\Property(property: 'id', type: 'integer'),
                                new OA\Property(property: 'name', type: 'string'),
                                new OA\Property(property: 'email', type: 'string'),
                                new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
                            ]),
                            new OA\Property(property: 'token', type: 'string'),
                            new OA\Property(property: 'token_type', type: 'string', example: 'Bearer'),
                        ]),
                    ]
                )
            ),
            new OA\Response(
                response: 422,
                description: '입력값 검증 실패',
            ),
            new OA\Response(
                response: 429,
                description: '요청 횟수 초과',
            ),
        ]
    )]
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'data' => [
                'user' => (new UserResource($user))->resolve(),
                'token' => $token,
                'token_type' => 'Bearer',
            ],
        ], 201);
    }

    #[OA\Post(
        path: '/api/auth/login',
        summary: '로그인',
        description: '이메일과 비밀번호로 로그인하고 Sanctum 토큰을 발급합니다.',
        tags: ['Auth'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email', 'password'],
                properties: [
                    new OA\Property(property: 'email', type: 'string', format: 'email', maxLength: 255),
                    new OA\Property(property: 'password', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: '로그인 성공',
                content: new OA\JsonContent(
                    type: 'object',
                    properties: [
                        new OA\Property(property: 'data', type: 'object', properties: [
                            new OA\Property(property: 'user', type: 'object', properties: [
                                new OA\Property(property: 'id', type: 'integer'),
                                new OA\Property(property: 'name', type: 'string'),
                                new OA\Property(property: 'email', type: 'string'),
                                new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
                            ]),
                            new OA\Property(property: 'token', type: 'string'),
                            new OA\Property(property: 'token_type', type: 'string', example: 'Bearer'),
                        ]),
                    ]
                )
            ),
            new OA\Response(
                response: 401,
                description: '인증 실패',
                content: new OA\JsonContent(
                    type: 'object',
                    properties: [
                        new OA\Property(property: 'message', type: 'string'),
                    ]
                )
            ),
            new OA\Response(
                response: 422,
                description: '입력값 검증 실패',
            ),
            new OA\Response(
                response: 429,
                description: '요청 횟수 초과',
            ),
        ]
    )]
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => '이메일 또는 비밀번호가 올바르지 않습니다.',
            ], 401);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'data' => [
                'user' => (new UserResource($user))->resolve(),
                'token' => $token,
                'token_type' => 'Bearer',
            ],
        ]);
    }

    #[OA\Post(
        path: '/api/auth/logout',
        summary: '로그아웃',
        description: '현재 인증 토큰을 무효화합니다.',
        tags: ['Auth'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: '로그아웃 성공',
                content: new OA\JsonContent(
                    type: 'object',
                    properties: [
                        new OA\Property(property: 'message', type: 'string'),
                    ]
                )
            ),
            new OA\Response(
                response: 401,
                description: '인증 필요',
            ),
        ]
    )]
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => '로그아웃 되었습니다.',
        ]);
    }

    #[OA\Get(
        path: '/api/auth/user',
        summary: '현재 사용자 정보',
        description: '인증된 사용자의 정보를 반환합니다.',
        tags: ['Auth'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: '사용자 정보',
                content: new OA\JsonContent(
                    type: 'object',
                    properties: [
                        new OA\Property(property: 'data', type: 'object', properties: [
                            new OA\Property(property: 'id', type: 'integer'),
                            new OA\Property(property: 'name', type: 'string'),
                            new OA\Property(property: 'email', type: 'string'),
                            new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
                        ]),
                    ]
                )
            ),
            new OA\Response(
                response: 401,
                description: '인증 필요',
            ),
        ]
    )]
    public function user(Request $request): JsonResponse
    {
        return (new UserResource($request->user()))->response();
    }
}
