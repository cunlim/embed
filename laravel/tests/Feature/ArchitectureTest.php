<?php

use App\Events\AlreadyRunning;
use App\Events\BatchCompleted;
use App\Events\BatchFailed;
use App\Events\TranslationProgress;
use App\Jobs\BatchTranslatePipeline;
use App\Jobs\TranslateAndEmbedJob;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Http\FormRequest;

test('모든 Job은 ShouldQueue를 구현한다', function () {
    $jobs = [
        BatchTranslatePipeline::class,
        TranslateAndEmbedJob::class,
    ];

    foreach ($jobs as $job) {
        $reflection = new ReflectionClass($job);
        expect($reflection->implementsInterface(ShouldQueue::class))
            ->toBeTrue("$job 는 ShouldQueue를 구현해야 합니다");
    }
});

test('모든 Event는 ShouldBroadcast를 구현한다', function () {
    $events = [
        AlreadyRunning::class,
        BatchCompleted::class,
        BatchFailed::class,
        TranslationProgress::class,
    ];

    foreach ($events as $event) {
        $reflection = new ReflectionClass($event);
        expect($reflection->implementsInterface(ShouldBroadcast::class))
            ->toBeTrue("$event 는 ShouldBroadcast를 구현해야 합니다");
    }
});

test('모든 POST/PUT/PATCH Controller 메서드는 FormRequest를 사용한다', function () {
    $controllerMethods = [
        ['App\Http\Controllers\Api\CategoryController', 'store'],
        ['App\Http\Controllers\Api\CategoryController', 'batchTranslate'],
        ['App\Http\Controllers\Api\RecommendController', 'recommend'],
    ];

    foreach ($controllerMethods as [$controller, $method]) {
        $reflection = new ReflectionClass($controller);
        $params = $reflection->getMethod($method)->getParameters();

        $hasFormRequest = false;
        foreach ($params as $param) {
            $type = $param->getType();
            if ($type !== null && ! $type->isBuiltin()) {
                $typeName = $type->getName();
                if (is_subclass_of($typeName, FormRequest::class)) {
                    $hasFormRequest = true;
                    break;
                }
            }
        }

        expect($hasFormRequest)
            ->toBeTrue("$controller::$method 는 FormRequest를 사용해야 합니다");
    }
});

test('AuthController write 메서드는 FormRequest를 사용한다', function () {
    $methods = ['register', 'login'];
    $controller = 'App\Http\Controllers\Api\AuthController';

    foreach ($methods as $method) {
        $reflection = new ReflectionClass($controller);
        $params = $reflection->getMethod($method)->getParameters();

        $hasFormRequest = false;
        foreach ($params as $param) {
            $type = $param->getType();
            if ($type !== null && ! $type->isBuiltin()) {
                $typeName = $type->getName();
                if (is_subclass_of($typeName, FormRequest::class)) {
                    $hasFormRequest = true;
                    break;
                }
            }
        }

        expect($hasFormRequest)
            ->toBeTrue("$controller::$method 는 FormRequest를 사용해야 합니다");
    }
});
