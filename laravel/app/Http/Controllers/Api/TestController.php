<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

#[OA\Info(
    title: 'CL Embed API',
    version: '1.0.0',
    description: 'AI 기반 다국어 카테고리 추천 시스템 API. '
        . '사용자 텍스트를 분석하여 네이버 카테고리 체계 기준으로 '
        . '적합한 카테고리를 한국어/중국어/영어로 추천합니다. '
        . 'pgvector 코사인 유사도 검색, Ollama 로컬 모델 번역/임베딩, '
        . 'Laravel Queue 기반 비동기 파이프라인을 갖추고 있습니다.',
    termsOfService: 'https://embed.cunlim.dev',
    contact: new OA\Contact(
        name: 'CL Embed',
        url: 'https://embed.cunlim.dev',
    ),
)]
#[OA\Server(
    url: 'https://embed.cunlim.dev',
    description: '프로덕션 서버'
)]
#[OA\SecurityScheme(
    securityScheme: 'sanctum',
    type: 'apiKey',
    in: 'header',
    name: 'Authorization',
    description: 'Sanctum API Token. 형식: Bearer {token}'
)]
class TestController extends Controller
{
    #[OA\Get(
        path: '/api/health',
        summary: '서버 상태 확인',
        description: 'API 서버의 정상 동작 여부를 확인합니다.',
        tags: ['System'],
        responses: [
            new OA\Response(
                response: 200,
                description: '서버 정상 동작',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'status', type: 'string', example: 'ok'),
                        new OA\Property(property: 'timestamp', type: 'string', format: 'date-time'),
                    ]
                )
            ),
        ]
    )]
    public function health(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}
