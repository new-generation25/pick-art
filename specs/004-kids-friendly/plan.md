# Implementation Plan: 아이와 같이 가기 좋은 곳

**Branch**: `revive/2026-10` (명세 `specs/004-kids-friendly`) | **Date**: 2026-11-26 | **Spec**: [spec.md](spec.md)

## Summary

행사마다 «아이 대상 / 아이도 볼 수 있음 / 해당 없음»과 관람 하한 나이를 **화면을 그릴 때 규칙으로 계산**한다(`frontend/src/lib/kids.ts`). 저장하는 것은 운영자 수정값 `events.kids_override` 하나뿐이다. 홈 필터에 「아이」 줄(전체·아이와·어린 아이·초등학생)을 더하고, 카드에 「아이와」 표시, 상세에 «관람 연령» 줄과 관리자 전용 분류 고치기를 둔다.

## Technical Context

- **언어**: TypeScript / Next.js 16 App Router(서버 컴포넌트에서 분류), Mantine·Tailwind
- **저장**: Supabase `events`에 `kids_override text`(NULL·target·ok·none) 1칸 — 적용함(`supabase/migrations/20261126010000_events_kids_override.sql`, SQL Editor Success)
- **테스트**: `node --experimental-strip-types --test src/lib/__tests__/kids.test.mjs`(8개), 실데이터 점검 스크립트(research.md), `npm run build`, 화면 확인
- **성능**: 홈은 이미 공개 행사 전체를 읽는다(약 1,100건). 행마다 정규식 몇 개 — 요청당 수 ms
- **제약**: AI 없음, 원문에 없는 나이 만들지 않음, 수집기 변경 없음

## Constitution Check

| 원칙 | 판정 |
|---|---|
| I 확인한 정보만 | 나이는 원문 표기에서만 읽고, 못 읽으면 «나이 정보 없음». 상세엔 원문 그대로 — 통과 |
| II 브랜드 | 표시는 기존 `pica-cat`·`pica-chip` 모양 그대로, 날짜가 가장 큰 글자 유지 — 통과 |
| III 보안 | 새 칸은 기존 events RLS(쓰기 관리자·service). 관리자 고치기는 관리자 세션으로만 저장되고 돌아온 값으로 확인 — 통과 |
| IV AI 최소 | 규칙 파일(`KIDS_RULES`) + 운영자 수정 — 통과 |
| V 끝 조건 | 아래 표 — 통과 |

## Project Structure

```text
frontend/src/lib/kids.ts                      # KIDS_RULES, kidsInfo, parseMinMonths, fitsAge, ageLabel, readKidsParam
frontend/src/lib/__tests__/kids.test.mjs
frontend/src/app/page.tsx                     # ?kids=any|young|school 필터, 묶음 안 아이 대상 먼저
frontend/src/components/ui/FilterBar.tsx      # 「아이」 줄
frontend/src/components/ui/FeedSections.tsx   # 관심 분야 재정렬에서도 아이 대상 먼저
frontend/src/components/ui/EventCard.tsx      # 「아이와」 표시, 필터 켜졌을 때 나이 표시
frontend/src/app/events/[id]/page.tsx         # «관람 연령» 줄 + AdminKidsControl
frontend/src/components/ui/AdminKidsControl.tsx
supabase/migrations/20261126010000_events_kids_override.sql
```

## 명세와 달라진 점 (research.md 근거)

- FR-002의 «분야(체험·교육)로 아이 대상» 규칙은 쓰지 않는다. 11/26 실데이터에서 성인 원데이 클래스·박물관 대학·트레킹이 섞였다. 체험 행사는 낱말이나 관람 연령으로만 들어온다.
- FR-010의 «전체 재분류 dry-run»은 필요 없어졌다. 분류를 저장하지 않고 그릴 때 계산하므로 규칙을 고치면 다음 요청부터 바로 반영된다.

## 단계와 끝 조건

| 단계 | 끝 조건 |
|---|---|
| 판정 함수 | 단위 테스트 8개 통과, 실데이터에서 연령 원문 313건 중 312건(99.7%) 읽음(SC-004) |
| 새 칸 | SQL Editor Success (완료) |
| 홈·카드·상세 | `npm run build` 통과. `?kids=young`에서 만 7세 이상 0건, `?kids=any`에서 만 13세 이상 0건(SC-001·002, 서버 HTML 전수 확인). 카드 「아이와」, 상세 «관람 연령» 화면 확인 |
| 관리자 고치기 | 관리자 로그인 화면에서 한 행사를 «해당 없음»으로 바꾸면 홈 아이 목록에서 빠지고, «규칙대로»로 되돌리면 돌아옴 |
| 배포 | main 병합은 운영자 승인 뒤, 배포 주소에서 같은 확인 |

## 이번 범위 밖

- 「내 주변」(/nearby)에 「아이」 필터 — 005(지도)와 함께 다룬다.
- 관리자 대시보드에 «아이 대상 행사 수» 칸.
