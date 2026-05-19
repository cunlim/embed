# 역할(Role) 기반 권한 및 카테고리 삭제 기능 설계

**날짜**: 2026-05-19
**범위**: Laravel API + Next.js 프론트엔드

## 개요

사용자 역할(member/admin/superadmin)을 도입하고, 카테고리에 소유자(user_id)를 연결하며, 카테고리 삭제 기능을 추가한다.

## 권한 매트릭스

| 역할 | 내 카테고리 | 타인 카테고리 |
|------|-----------|------------|
| member | 수정/삭제 가능 | 보기만 가능 (readonly) |
| admin | 수정/삭제 가능 | 수정/삭제 가능 |
| superadmin | 수정/삭제 가능 | 수정/삭제 가능 |

## 구현 항목

### 1. DB 마이그레이션

#### users 테이블 — role 컬럼 추가

- `role` varchar(20), default `member`, nullable=false
- 기존 id=1 사용자는 `superadmin`으로 업데이트

#### categories 테이블 — user_id 컬럼 추가

- `user_id` unsigned big integer, nullable=true (FK 미사용)
- 기존 모든 카테고리는 `user_id = 1`로 백필

### 2. Backend (Laravel)

#### User 모델

- `#[Fillable]`에 `role` 추가
- `isSuperAdmin(): bool` — `$this->role === 'superadmin'`
- `isAdmin(): bool` — `$this->role === 'admin' || $this->role === 'superadmin'`

#### Category 모델

- `#[Fillable]`에 `user_id` 추가
- `user(): BelongsTo<User>` 관계

#### CategoryController

- `store()`: `$request->user()->id`로 `user_id` 설정
- `destroy(Category $category)`: 새 메서드
  - 권한 체크: 본인 or admin/superadmin
  - CategoryEmbedding 삭제 (코드로 cascade)
  - Category 삭제
  - 204 응답
- `updateText()`: 권한 체크 추가

#### 권한 헬퍼 (CategoryController private)

```php
private function canModify(User $user, Category $category): bool {
    return $user->isAdmin() || $category->user_id === $user->id;
}
```

#### 라우트 (`routes/api.php`)

```php
Route::delete('categories/{category}', [CategoryController::class, 'destroy'])->middleware('auth:sanctum');
```

#### UserResource

- `role` 필드 추가

#### CategoryResource

- `user_id` 필드 추가 (프론트엔드에서 소유권 확인용)

### 3. Frontend (Next.js)

#### `lib/utils.ts`

`isAdmin` 제거, 새 함수로 대체:

```ts
export function isSuperAdmin(user: { role?: string } | null | undefined): boolean {
  return user?.role === "superadmin";
}

export function isAdmin(user: { role?: string } | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "superadmin";
}
```

#### `lib/api.ts`

- `User` 타입에 `role: string` 추가
- `Category` 타입에 `user_id: number` 추가
- `deleteCategory(id, token)` 함수 추가

#### `hooks/useCategories.ts`

- `deleteCategory(id)` 메서드 추가: API 호출 → 목록에서 제거 → meta.total 감소

#### `app/embed/page.tsx`

- 테이블 컬럼 헤더: "수정" → "작업"
- 각 행 버튼 영역:
  - **삭제 버튼 (Trash2)**: `canModify` 조건일 때만 표시 (왼쪽)
  - **수정/보기 버튼**: 항상 표시 (오른쪽)
    - 권한 있으면 Pencil 아이콘 + "수정" → 편집 가능 모달
    - 권한 없으면 Eye 아이콘 + "보기" → 읽기 전용 모달
- 삭제 전 `window.confirm()` 확인
- `canModify` 계산: `isAdmin(user) || category.user_id === user.id`

#### `components/admin/category-modal.tsx`

- `readOnly` prop 추가
- readonly 모드: 모든 input `readOnly`, 저장/실행 버튼 disabled/hidden, 복사 허용

### 4. 테스트

#### Laravel (Pest)

- `UserTest`: role 기본값, isSuperAdmin/isAdmin
- `CategoryTest`: user 관계
- `CategoryControllerTest`:
  - destroy: 본인 소유 삭제 성공
  - destroy: admin이 타인 카테고리 삭제 성공
  - destroy: 일반회원이 타인 카테고리 삭제 시 403
  - store: user_id 자동 설정
  - updateText: 일반회원 타인 카테고리 수정 시 403

#### Next.js (Vitest)

- `lib/utils.test.ts`: isSuperAdmin/isAdmin
- `useCategories.test.ts`: deleteCategory
- `app/embed/page.test.tsx`: 권한별 버튼 표시, 보기 모드

### 5. 백필

- 모든 기존 카테고리의 `user_id`를 1로 설정 (마이그레이션에서 수행)
- 기존 사용자 id=1의 `role`을 `superadmin`으로 설정 (마이그레이션에서 수행)
