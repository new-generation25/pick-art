# Implementation Plan: 행사 분류 두 단계

**Branch**: `revive/2026-10` (명세 `specs/015-genre-taxonomy`) | **Date**: 2026-11-26 | **Spec**: [spec.md](spec.md)

## Summary

행사에 «세부 갈래»를 붙인다.
- **DB**: `events`에 `subcategory`·`subcategory_by`·`subcategory_pending`·`subcategory_evidence` 네 칸을 더한다.
- **판정 규칙**: 고칠 수 있는 JSON(`collector/rules/genre_rules.json`)에 둔다.
- **판정 도구**: `collector/tools/classify_genre.py`가 공개·검토 행사를 판정한다.
  - KOPIS 행사는 설명의 «장르:» 줄로 대응한다.
  - 나머지는 낱말 규칙으로 판정한다. 단서가 없거나 둘 이상이면 대기로 둔다.
  - 정기 루틴에서도 돈다.
- **화면**:
  - 분야를 고르면 세부 칩 줄이 나온다(`?sub=`).
  - 꼬리표는 «대분류 · 세부»로 보인다.
  - 관리자에게 «세부 판정 대기» 상자와 상세 고르기 칸을 둔다.
- **체험·교육 → 체험**: DB·화면·관심 분야·수집기 출력을 모두 합친다.
- **극장 영화**: 공개 검증(`publish_verified.py`)에서 거른다.

## Technical Context

- **언어**: TypeScript 5 / Next.js 16, Python 3.13
- **저장**: Supabase. 마이그레이션 1개 `20261127020000_genre.sql`
- **시험**: 판정 함수 pytest(`collector/tests/test_genre.py`), `npx tsc --noEmit`, `next build --webpack`, 화면·건수 확인
- **규모**: 공개 행사 1,107건(KOPIS 장르 413건)
- **제약**: AI를 쓰지 않는 낱말 규칙이다. 사이트별 코드를 넣지 않고, 규칙은 JSON에 둔다(헌장 IV).

## Constitution Check

| 원칙 | 확인 | 결과 |
|---|---|---|
| I 확인한 정보만 | 세부는 출처 값(KOPIS)이나 제목·설명에 적힌 낱말로만 정한다. 근거 낱말을 `subcategory_evidence`에 남긴다. 단서가 없으면 정하지 않고 대기로 둔다 | 통과 |
| II 같은 무게·가이드 | 꼬리표 모양은 014 화면 팔레트 그대로 쓰고, 세부는 같은 칸에 «·»로 잇는다 | 통과 |
| III 보안 | 새 칸은 `events`(공개 읽기·관리자 쓰기 RLS 그대로)에 둔다. 판정 도구는 운영자 PC에서 서비스 키로 돌린다 | 통과 |
| IV AI 최소 개입 | AI를 쓰지 않는다. 규칙은 정의 파일에 두고, 누가 정했는지(`kopis/rule/admin`)를 남긴다 | 통과 |
| V 끝 조건 | quickstart.md 8단계 | 통과 |

## Project Structure

```text
supabase/migrations/20261127020000_genre.sql   # 세부 칸·검사, 체험·교육→체험(events·profiles.interests)
collector/rules/genre_rules.json               # 대분류별 «세부 ← 단서 낱말», KOPIS 대응, 극장 영화 낱말
collector/genre.py                             # classify(event) → (세부|None, 근거, pending), is_theater_film(), normalize_category()
collector/tools/classify_genre.py              # --apply / 미리보기, 대분류별 통계, 표본 30건 출력
collector/tests/test_genre.py
collector/tools/publish_verified.py            # 저장 전 normalize_category, 극장 영화 거르기
collector/main.py                              # 루틴에 classify_genre --apply
frontend/src/lib/categories.ts                 # «체험», SUBCATEGORIES, 예전 이름 대응
frontend/src/components/HomeFeed.tsx           # ?sub= 거르기, 세부 건수
frontend/src/components/ui/FilterBar.tsx       # 세부 칩 줄
frontend/src/components/ui/Shelf.tsx, EventCard.tsx, app/events/[id]/page.tsx  # «대분류 · 세부» 꼬리표
frontend/src/components/ui/AdminGenreControl.tsx, components/admin/GenrePending.tsx
```

## 구현 순서

| 단계 | 내용 | 끝 기준 |
|---|---|---|
| 1 | 마이그레이션 적용 | 새 칸이 익명 키로 읽힘, 체험·교육 0건 |
| 2 | 규칙·판정 함수·시험 | pytest 통과 |
| 3 | 판정 도구 미리보기 → 적용 | SC-001(413건 100%), SC-002(80% 이상 + 나머지 대기) |
| 4 | 표본 30건 사람 확인 | SC-003(틀린 것 3건 이하) |
| 5 | 화면(칩·꼬리표·관리자) | SC-005·006, 형 검사·빌드 |
| 6 | 루틴·공개 검증 연결 | 문법 확인, 극장 영화 시험 |
| 7 | 배포(015 커밋만)·보고 | 운영 화면 확인 |

## Complexity Tracking

> 위반 없음.
