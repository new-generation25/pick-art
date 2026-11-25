# Quickstart: 아이와 같이 가기 좋은 곳 검증

## 1. 판정 함수

```powershell
cd frontend
node --experimental-strip-types --test src/lib/__tests__/kids.test.mjs
```
기대: 8개 통과.

## 2. 화면 (빌드 후 `pick-art-frontend-prod-3000` 을 preview_start, 끝나면 preview_stop)

- `/?kids=any` — 묶음마다 「아이와」 표시 카드가 앞, 카드에 나이 표시(24개월+ 등).
- `/?kids=young` — 카드 나이 표시에 «만 7세+» 이상이 0개(SC-002). 페이지의 나이 표시 글자를 전부 모아 확인한다.
- `/?kids=school` — «만 13세+» 이상 0개(SC-001).
- 필터 없이 `/` — 아이 대상 행사 카드에만 「아이와」.
- KOPIS 공연 상세 — «관람 연령 만 7세 이상» 줄.

## 3. 관리자 고치기

Chrome pica 프로필(pick.art.pica@gmail.com, 관리자)로 상세를 연다. «아이 분류(관리자)»를 «해당 없음»으로 바꾸면 «저장했습니다». `/?kids=any`에서 그 행사가 빠지는지 본다. «규칙대로»로 되돌린다. 방문자(로그아웃)에게는 이 칸이 보이지 않는다.
