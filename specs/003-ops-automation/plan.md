# Implementation Plan: 운영 자동화와 운영 대시보드 (반자동 → 전자동)

**Branch**: `revive/2026-10` (명세 디렉터리 `specs/003-ops-automation`) | **Date**: 2026-11-25 | **Spec**: [spec.md](spec.md)

**Input**: [spec.md](spec.md), 승인된 [구조개편 계획 리포트](../../docs/plan/restructure_2026-11-25.html), 11/25 실행 결과([research.md](research.md) 0절)

## Summary

수집·검증·자동 공개는 이미 사람 없이 돈다. 남은 반자동 구간은 «돌았는지·비정상인지 판정»과 «사람 판단 대기열»이다. 이 계획은 (1) 이미 만든 운영 대시보드를 배포하고, (2) 정기 실행 결과를 출처별 숫자로 `ops_snapshots`에 남겨 수집기가 이상을 판정·경고하게 하고, (3) 인스타 REVIEW 중 끝난 행사(556/663건)를 규칙으로 치우고 남은 것을 무더기로 나눠 인박스 한 곳에서 처리하게 하고, (4) 실행 경로 밖의 코드를 `_attic/`으로 옮긴다. 새 테이블·새 상태 값은 만들지 않는다.

## Technical Context

**Language/Version**: Python 3.13(수집기), TypeScript 5 / Next.js 16.1 App Router(프론트)

**Primary Dependencies**: supabase-py, aiohttp / @supabase/supabase-js, Mantine 8

**Storage**: Supabase Postgres(서울). 이번에 쓰는 것: `ops_snapshots`(적용됨), `raw_posts`(status·content), `events`(읽기), `venues`·`profiles`(읽기). 로컬: `docs/insta/`(git 밖, G: 백업), `collector/logs/`

**Testing**: 순수 함수는 `node --experimental-strip-types --test`(프론트), `python -m pytest collector/tests`(수집기). 화면은 `npm run build` + 관리자 로그인 화면 확인. 수집은 정기 실행 로그와 DB 조회

**Target Platform**: 수집기 = 운영자 Windows PC(작업 스케줄러 08:20·15:00, F: 외장 SSD). 화면 = Vercel(icn1)

**Project Type**: 웹앱(frontend/) + 로컬 수집기(collector/)

**Performance Goals**: 대시보드 첫 표시 3초 이내(행사 1,168건 읽기 2회 요청 기준). 정기 실행 시간 증가 1분 이내

**Constraints**: 비용 0. 개발 서버는 한 번에 하나, 힙 상한(헌장). 배포·설정 변경·데이터 대량 변경·파일 이동은 운영자 승인 뒤. 다른 세션이 쓰는 `collector/curated/`, `docs/insta/`, `tools/review_instagram.py`·`insta_*.py` 동작을 바꾸지 않는다

**Scale/Scope**: 출처 31(웹 28·KOPIS·블로그 1·인스타 1 묶음), 정기 실행 하루 2회, 활성 행사 약 760, REVIEW 663

## Constitution Check

*GATE: Phase 0 전 확인, Phase 1 뒤 재확인.*

| 원칙 | 이 계획에서 | 판정 |
|---|---|---|
| I. 확인한 정보만 공개 | 공개 경로는 그대로 `publish_verified`(날짜·링크·중복). «공개 후보» 묶음 승인도 표시만 하고 다음 정기 실행의 `publish_verified --ids`가 공개. 끝난 수집분은 지우지 않고 EXPIRED | 통과 |
| II. 작은 무대·브랜드 | 관리자 화면이라 브랜드 가이드의 «관리자 화면은 그대로»를 따름. 소규모 행사는 «동의 필요»로 분리해 동의 없이 공개하지 않음 | 통과 |
| III. 보안·비밀값 | `ops_snapshots`는 관리자만 읽기(RLS, 익명 `[]` 확인). 쓰기는 service 키(PC)만. 환경 파일 통일 때 값 출력 안 함. 배포·스케줄러·대량 상태 변경은 승인 뒤 | 통과 |
| IV. AI 최소 개입 | AI 호출 추가 없음. 이상 판정·분류는 규칙 파일. ⚠ 헌장의 «정기 루틴 04:00·18:00»은 실제(08:20·15:00)와 다름, «인스타 후보는 주간 검토로만 공개»의 «주간» 주기는 묶음 승인으로 대체 — **헌장 개정 제안으로 알림**(아래 Complexity Tracking) | 조건부 통과 |
| V. 끝 조건 먼저 | 단계마다 끝 조건(아래 표). 프론트 변경은 tsc·build·화면, 배포는 배포 주소 확인 | 통과 |

**Phase 1 뒤 재확인**: data-model의 새 데이터는 모두 `ops_snapshots` 안(JSON)과 `raw_posts.content.review_bucket`(JSON 키)뿐이고 공개 피드 경로를 바꾸지 않는다. 판정 그대로.

## Project Structure

### Documentation (this feature)

```text
specs/003-ops-automation/
├── spec.md
├── plan.md              # 이 파일
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── ops-snapshots.md     # 스냅숏 이름별 JSON 모양
│   ├── alert-rules.md       # 이상 판정 규칙 파일과 경고 모양
│   └── review-triage.md     # REVIEW 정리 도구의 입력·출력
└── tasks.md             # /speckit-tasks 에서
```

### Source Code

```text
collector/
├── main.py                      # 결과 숫자 모으기 → run_log 기록 → 경고 판정
├── public_scraper.py            # 결과 dict 에 found/new/dup/fail/expired 숫자 칸 추가
├── kopis_scraper.py             # 〃
├── naver_blog_scraper.py        # (이미 found/new/dup 반환)
├── ops_log.py                   # 새: 실행 기록 누적(최근 60회)·경고 판정·스냅숏 쓰기
├── rules/alerts.json            # 새: 이상 판정 규칙
├── tools/
│   ├── triage_review.py         # 새: REVIEW 정리(--dry-run/--apply)
│   ├── publish_ops_snapshots.py # 있음
│   ├── backup_insta.py          # 있음
│   └── publish_verified.py      # 공개 후보 승인분(--ids) 공개에 재사용
├── tests/test_ops_log.py        # 새
└── _attic/ , _attic/danger/     # R4 이동 대상
frontend/src/
├── app/admin/page.tsx           # 대시보드: 출처별 최근 실행·수집기 경고 칸 추가
├── app/admin/inbox/page.tsx     # 탭: 인박스·공개 후보·동의 필요·사람 판단
└── lib/opsStats.ts              # 실행 누락 판정 등 순수 함수 추가
_attic/                          # R5: 루트 일회성 스크립트
```

**Structure Decision**: 기존 웹앱 + 로컬 수집기 구조를 유지한다. 새 서비스·새 테이블 없이 수집기에 모듈 1개(`ops_log.py`)와 규칙 파일 1개를 더하고, 프론트는 기존 관리자 화면 두 곳만 고친다.

## 단계와 끝 조건

| 단계 | 할 일 | 끝 조건 | 승인 |
|---|---|---|---|
| **R0 마무리** | 11/26 08:20 정기 실행 결과 확인 | 로그에 KOPIS 경남·부산 각 1건 이상, «인스타 기록 백업 ✅», «대시보드 스냅숏 ✅» 줄 | — |
| **D-배포** | 대시보드 커밋을 main에 병합 → Vercel | https://pick-art.vercel.app/admin 을 관리자로 열어 활성 행사·REVIEW 수가 DB 조회와 같음 | **main 병합 승인** |
| **R1 실행 기록·경고** | 결과 숫자 칸 → 네트워크 오류 출처 1회 재시도 → `ops_log.py` → `collector_runs`·`collector_alerts` → 대시보드 «출처별 최근 실행»·«수집기 경고»·«실행 누락» | ① 정기 실행 1회 뒤 `collector_runs` 새 줄 수 = 처리 출처 수 ② 시험 모드(`OPS_TEST_FAIL=KOPIS`)로 기록 단계만 돌리면 2회째에 KOPIS 경고 생김, 해제 후 풀림 ③ pytest 통과 | — (코드만) |
| **R2 REVIEW 정리·인박스** | `triage_review.py` dry-run → 승인 → apply, 정기 실행에 연결 → 인박스 탭 | ① dry-run 표(EXPIRED·DUPLICATE·consent·candidate·human 건수) ② 적용 후 무더기 없는 REVIEW 0 ③ 무작위 20건 눈 확인 잘못 0 ④ 공개 후보 1건 승인 → 다음 정기 실행에서 공개 피드 표시 | **dry-run 결과 승인**(상태 대량 변경) |
| **R4 수집기 정리** | import 줄 정리 → `git mv` 37개 → 환경 파일 하나로 | 최상위 .py ≤ 15 · 이동 전후 정기 실행 출처별 발견 건수 같음 · pytest 통과 · 삭제 0 | **이동 목록 승인** |
| **R5 저장소 정리** | 루트 34개 → `_attic/`, 쓰지 않는 화면·API·의존성, README | `npm run build` 통과 · 관리자 메뉴 전 페이지 열림 · 루트 일회성 0 | **접을 폴더·지울 화면 목록 승인** |

손으로 하는 단계를 «전자동 / 확인 한 번만 / 사람이 해야 함»으로 나눈 표와 단계별 위험·되돌리기는 [리포트 2-1·2-2절](../../docs/plan/restructure_2026-11-25.html)에 있다. 요약: 전자동 7(수집 실행·장애 감지·검증 공개·인스타 수집·리포트·백업·카드 제작 후보), 확인 한 번만 4(인박스·인스타 검토·큐레이션 일부·장소), 사람이 해야 함 3(정의 수리 지시·동의 받기·게시 상시 승인). 카드 미리 만들기는 인스타 세션 도구라 별도 승인 뒤 후속으로.

순서: R0 마무리 → (D-배포는 승인 나는 대로 언제든) → R1 → R2 → R4 → R5. R3(인스타 지표)은 대시보드와 함께 끝났으므로 목록에서 뺐다.

## 운영자가 할 일

- D-배포: main 병합 승인 한 번.
- R2: dry-run 표를 보고 적용 승인.
- R4·R5: 이동·정리 목록 승인.
- (선택) 헌장 개정: 정기 루틴 시각, 인스타 후보 «주간» 검토 문구 — `/speckit-constitution`.

## Complexity Tracking

| 어긋남 | 왜 필요한가 | 더 단순한 대안을 버린 이유 |
|---|---|---|
| 헌장 IV «정기 루틴 04:00·18:00» ↔ 실제 08:20·15:00 | 실제 스케줄러가 11/9부터 08:20·15:00 | 이 계획은 시각을 바꾸지 않는다. 헌장 문구를 실제에 맞추는 개정을 제안 |
| 헌장 IV «인스타 후보는 주간 검토로만 공개» ↔ 묶음 승인을 수시로 | 663건 적체, 사람이 볼 것은 107건 | 사람 승인 자체는 유지(원칙의 뜻은 지킴). «주간»이라는 주기만 바뀌므로 개정 제안 |

## 진행 (2026-11-26)

- **R1 완료** — 수집기 `ops_log.py`·`rules/alerts.json`·웹 출처 네트워크 재시도 1회(8056dbc), 대시보드 «수집기 경고»·«출처별 최근 실행»·«실행 누락»(4b8e7df, picka.news/admin 확인). 지난 로그 24회를 채움, 켜진 경고 5건. 시험 모드로 켜짐·풀림 확인. 정기 실행 연결 뒤 첫 실제 확인은 11/26 08:20 회차.
- **R2 적용·연결 완료, 공개 1건 확인은 남음** — `tools/triage_review.py`(d4c1812). dry-run(11/26): REVIEW 813 → 만료 581 · 중복 0 · 동의 필요 25 · 공개 후보 46 · 사람 판단 161. 11/26 승인 뒤 적용: 581건 EXPIRED, REVIEW 232건에 무더기(되돌리기 목록 `collector/logs/triage/applied_2026-11-26_025302.json`, git 밖. 같은 폴더의 `triage_2026-11-26.json`은 적용 뒤 다시 돌린 dry-run으로 덮여 지금은 232건 모두 kept).
  - 정기 실행(`main.py`, f35ec2b): 인스타 수집 블록 다음에 매 회차 `triage_review.py --apply` → `publish_verified.publish_approved`(승인된 공개 후보만, 오늘~60일, 날짜·링크·중복 검증). 보고에 «REVIEW 정리»·«승인 후보 공개» 줄. `AUTO_PUBLISH=off`면 승인 후보 공개도 멈춘다.
  - `publish_verified --ids`(a2c3741): REVIEW는 `content.publish_approved_at`이 있을 때만 받는다(기본 실행은 예전대로 COLLECTED·PENDING만). 검증 실패(날짜 형식·공개 범위 밖·링크·저장 실패)는 REVIEW 유지 + `review_reason="publish_failed: …"`·`publish_failed_at`, 승인은 남아 다음 실행에서 다시 본다. 끝난 것 EXPIRED·이미 공개된 것 DUPLICATE는 다른 수집분과 같다. 인스타 포스터는 저장소에 올린 것만 쓴다. 중복 판정이 events를 1,000건까지만 읽던 것을 끝까지 읽게 고침(11/26 1,170건).
  - 인박스(cb6c4e6): 탭 «인박스(COLLECTED)·공개 후보·동의 필요·사람 판단·현재 노출». 공개 후보는 골라서 «선택한 것 공개 승인»(`publish_approved_at`), 세 탭 모두 «반영 안 함»(REJECTED), 동의 필요·사람 판단은 «공개 후보로 옮기기». 휴지통에서 되돌리면 무더기가 있는 줄은 REVIEW로 간다. «장소 확인» 탭(FR-008)은 아직 없음.
  - 남은 끝 조건: ③ 무작위 20건 눈 확인 ④ 공개 후보 1건 승인 → 다음 정기 실행에서 공개 피드 표시. 인박스 화면은 브라우저로 아직 열어 보지 않음.
  - 11/27 ③ 끝: REVIEW 620건 중 무작위 20건(씨앗 1127)의 저장된 무더기를 규칙으로 다시 판정해 20건 모두 같음, 무더기 없는 줄 0. 눈으로 본 것: 정보 계정 3건 → 사람 판단, 기관+날짜+장소 4건 → 공개 후보, 단체·예술인 12건 → 동의 필요, 기관인데 날짜 없음 1건 → 사람 판단. 참고(분류는 규칙대로): 장소 칸에 문장이 들어간 것 2건, 서울 공연장(마포아트센터) 1건. ④는 운영자 승인이 있어야 한다(지금 «승인된 공개 후보 없음»).
- **R4·R5 목록 완료, 이동은 승인 대기** — [docs/plan/cleanup_lists_2026-11-26.md](../../docs/plan/cleanup_lists_2026-11-26.md) 끝의 «승인에 필요한 선택» 9개.
- **R4·R5 적용 (11/26 저녁, 운영자 «추천대로 해»)** — 옮기기만 하고 지운 것은 frontend 화면·API뿐(git 기록에 남음).
  - R4(08b740c): 수집기 39개 → `collector/_attic/`(DB를 쓰거나 지우거나 RLS를 여는 9개는 `_attic/danger/`), `main.py`의 쓰지 않는 import 2줄 삭제, 안내서 명령 경로 수정. 최상위 `.py` 16개(목록 작성 뒤 `dedupe`·`genre`·`poster_finder`가 새로 생겨 15를 넘음). `pytest` 164 통과, `import main` 확인.
  - 환경 파일: `collector/.env.local`로 통일. `.env`에만 있던 NAVER 키 2개를 옮기고 `.env`는 `.env.bak-20261126`으로 이름만 바꿈(둘 다 git 밖). 코드 수정 없음(`geocode_venues`는 `.env.local`을 먼저 읽는다).
  - R5(ed17506): 루트 일회성 34개 → `_attic/`(삭제 쿼리 2개는 `_attic/danger/`), 옛 안내서 7개 → `_attic/docs/`, `admin/`(Streamlit)·`testsprite_tests/` 두 곳·frontend 로그 → `_attic/`. `QA_CASE_STUDIES.md`는 남긴 `.agent/`가 가리켜서 루트에 둠.
  - R5 frontend(57ed660): `/admin/stats`·`/admin/blacklist`·`/admin/whitelist`, API `crawlLogs`·`updatePrompt`·`crawl/kopis` 삭제, 의존성 `pg`·`react-datepicker`·`@types/react-datepicker`(frontend)·`instaloader`(루트) 제거. 남김: `/admin/ai-prompt`·`getPrompt`(인박스 사용), `/signup`, `/api/newsletter`. `next build --webpack` 통과, 관리자 화면 14개 200·지운 경로 404.
  - 남은 끝 조건: 11/27 08:20 정기 실행의 출처별 발견 건수를 11/26 15:00 회차와 비교. README 다시 쓰기는 안 함.
  - 11/27 비교 끝: 출처 45곳 가운데 41곳은 발견 건수·상태가 같고, 4곳은 1~2건 차이(창원문화재단 182→180, 부산문화회관 82→81, 해운대문화회관 35→34, KOPIS 경남 96→94 — 끝난 행사가 빠진 범위). 정리 뒤 새로 실패하거나 0건이 된 출처 없음. 헌장 IV의 시각 문구는 2.0.1에서 08:20·15:00으로 고침.
