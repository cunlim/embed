# useState nullable 타입 + 라디오 버튼 기본값 버그

## 패턴

`useState<T | null>` 타입을 토글 버튼 그룹(라디오 버튼 역할)에 사용할 때, 초기값이 `null`이면 어떤 버튼도 선택되지 않는 UI 상태가 발생한다.

## 원인

- `serverFilter`가 비로그인/카테고리 미보유 시 `null`
- `useState` 초기값이 `null`로 설정됨
- 버튼의 `aria-pressed` 조건: `activeFilterSelection === "all"` → false, `activeFilterSelection === "my"` → false
- → 두 버튼 모두 비활성 상태

## 해결

`null`이 유효한 선택 상태가 아니라면, 초기값을 첫 번째 옵션(기본값)으로 설정한다:

```diff
- useState<"all" | "my" | null>(props.serverFilter === "my" ? "my" : null)
+ useState<"all" | "my">(props.serverFilter === "my" ? "my" : "all")
```

## 적용 조건

- 라디오 버튼/토글 버튼 그룹에서 항상 하나는 선택되어야 할 때
- `null`이 "아직 선택 안 됨"을 의미하는 것이 아니라, "서버가 기본값 결정 못 함"을 의미할 때
- API 동작이 `null`과 첫 번째 옵션 선택 시 동일할 때
