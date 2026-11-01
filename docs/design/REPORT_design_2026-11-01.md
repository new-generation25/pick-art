# 공개 화면 디자인 개편 보고 (2026-11-01)

## 요약

- 백업: 시작 커밋 `e80ce12409acbb91d8099104ebe56d112f3cdc0c`에 로컬 태그 `design-backup-2026-11-01`를 붙였다(푸시 안 함).
- 작업 브랜치: `claude/design-upgrade-9014b5`(워크트리). `revive/2026-10`은 건드리지 않았다. 푸시·병합 안 함.
- 홈 피드, 행사 카드, 필터, 헤더, 행사 상세의 화면만 바꿨다. 조회(`lib/supabase.ts`), `formatPeriod`, URL 파라미터(`region`, `category`, `date`, `ended`, `q`)는 그대로다.
- `npx tsc --noEmit` 통과(오류 0). 변경 전후 화면은 이 폴더의 `before_*.png`, `after_*.png`. 나란히 보려면 [compare.html](compare.html).

## 바뀐 것

| 화면 | 변경 전 | 변경 후 |
|---|---|---|
| 행사 카드 | 3:4 포스터 + 작은 회색 날짜 글자. 모바일에서 한 장이 화면 높이를 거의 다 차지 | 왼쪽에 **날짜 표**(표 끝을 점선으로 뜯는 모양)를 크게. 모바일은 가로형(썸네일 92px + 날짜 표 + 제목), 넓은 화면은 포스터 위·정보 아래 |
| 날짜 표 내용 | `2026.11.04 ~ 11.06` 한 줄 | 시작 전: 연도 / **11.04** / `~ 11.06` · 진행 중: `진행 중` / **11.30** / `월요일까지`(해가 다르면 `2035년까지`, 오늘 끝나면 `오늘까지`) · 하루짜리: 요일 표시 · 종료: 연도 / **끝난 날짜** / `끝난 날` |
| 종료 행사 | 카드 전체 투명도 60% + `종료` 배지 | 포스터 흑백 + 왼쪽 위 `종료` 배지(먹색) + 날짜·제목 회색 |
| 분야·지역 | 남색 배지 | 분야마다 색 점(공연 #B8325A, 전시 #0B6B74, 축제 #B36D00, 행사 #4A55C9). 필터 칩에도 같은 색 |
| 필터 | 가운데 정렬 버튼 16개가 여러 줄로 쌓임 | `언제 / 지역 / 분야` 이름이 붙은 칩 줄. 모바일은 한 줄 가로 스크롤, 넓은 화면은 줄바꿈. `종료된 행사도 보기` 체크박스 유지 |
| 홈 머리말 | 보라 그라데이션 + "이번 주말, 경남의 예술을 만나보세요" 가운데 정렬 | 왼쪽 정렬. `11월 1일 기준`, 제목, "지금 볼 수 있는 행사 **157건**"(필터가 있으면 "조건에 맞는 행사 N건"), 검색창. 데스크톱은 왼쪽 제목·오른쪽 필터 2단 |
| 소식 받기 | 보라 카드 + 검정 카드 | 짙은 쪽빛 띠 하나에 두 양식. 폼 `action`, 입력 `name`은 그대로 |
| 헤더 | 그라데이션 P 로고, 높이 70(AppShell 60과 어긋남) | 유등 모양 표시 + `pica` + `경남 문화예술 안내`, 높이 60 |
| 상세 | 4칸 회색 카드, 설명 150자 반복 | 분야·지역·무료·**종료** 줄, 제목, `기간/장소/관람료/출처` 정의 목록, 상세 안내(줄 길이 68자 제한), 바로가기 버튼 이름 `원본 안내 페이지 열기` |
| 글꼴 | Inter(한글은 시스템 글꼴로 대체됨) | Pretendard Variable(OFL), jsDelivr dynamic subset |

디자인 토큰은 `frontend/src/app/globals.css`의 `@theme`에 있다: 먹 `#1F2A36`, 종이 `#F5F6F3`, 선 `#DDE2E5`, 남해 쪽빛 `#0B6B74`, 유등 노랑 `#F0B429`.

## 바꾼 파일

`app/page.tsx`, `app/events/[id]/page.tsx`, `components/ui/EventCard.tsx`, `EventList.tsx`, `FilterBar.tsx`, `Header.tsx`, 그리고 범위를 위해 필요한 세 곳:

- `app/globals.css`: 색 토큰, 칩·날짜 표 스타일, `.pica-public` 범위 지정.
- `app/layout.tsx`: Pretendard `<link>` 한 줄.
- `components/MainLayout.tsx`: 공개 화면 AppShell에 `className="pica-public"`. 관리자 경로는 이 클래스 밖이라 글꼴·배경이 바뀌지 않는다.

## 알아 둘 점

- **관리자 수신함(`/admin/inbox`)도 `EventList`·`EventCard`를 쓴다.** 그래서 그 목록의 카드 모양은 새 카드로 바뀐다. 선택 모드(빨간 테두리·체크 표시)는 그대로 동작하도록 둥근 모서리(16px)를 맞췄지만, 관리자 화면에서 직접 눌러 보지는 않았다.
- 날짜 표는 `formatPeriod`가 만든 문자열을 표시용으로만 나눠 쓴다. 모양이 다르면(`일정 미정`) 문자열을 그대로 보여 준다.
- 오늘(11월 1일) 데이터에는 종료 1개월 이내 행사가 0건이라 `?ended=1`이어도 종료 카드가 나오지 않는다. 종료 카드 모양은 첫 화면의 두 번째 카드에 임시로 `isEnded`를 켜서 찍었고(`after_ended_card_preview_mobile375.png`), 임시 수정은 되돌린 뒤 커밋했다.
- eslint 지적 5건(`any` 2건, 안 쓰는 import 2건, hook 의존성 1건)은 원래 있던 줄이라 손대지 않았다.
- Pretendard는 CDN(jsDelivr)에서 받는다. 오프라인이면 시스템 한글 글꼴로 대체된다.

## 참고한 자료

- Anthropic `frontend-design` 스킬 — https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md (로컬 `frontend-design:frontend-design`로 로드). 적용한 원칙: 주제(경남 공연·전시 안내)에서 시각 요소를 가져온다, 대담함은 한 곳(날짜 표)에만, 대문자 꼬리표·한 단어 강조·그라데이션 장식·똑같은 카드 그림자를 쓰지 않는다, 빈 화면은 다음 행동을 안내한다.
- Pretendard v1.3.9 (SIL OFL) — https://github.com/orioncactus/pretendard
- Mantine 8 변경 내역 — https://mantine.dev/changelog/8-0-0/ (8.x 그대로 사용. CSS 변수 `--mantine-font-family`를 범위 안에서 덮어쓰는 방식으로 관리자 화면과 분리)
- Tailwind CSS 4 `@theme` 토큰 — 프로젝트에 이미 있는 Tailwind 4로 `bg-sea`, `text-ink` 같은 유틸리티를 만들었다.

## 되돌리기

```bash
git checkout design-backup-2026-11-01 -- frontend/src
```

브랜치 전체를 시작점으로 돌리려면 `git reset --hard design-backup-2026-11-01`(이 브랜치의 커밋이 사라지므로 주의).

## 실행 방법(확인용)

`.claude/launch.json`의 `pick-art-frontend-webpack-3001`(webpack, 힙 2GB, 포트 3001). Turbopack은 쓰지 않았다.

작업 중 상위 세션의 `memwatch.ps1`(시스템 커밋 여유 3GB 미만이면 `pick-art|next` node 종료)이 개발 서버를 두 번 종료했다. 페이지를 미리 컴파일해 두고 캡처를 한 장씩 찍어 해결했다.
