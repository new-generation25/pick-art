# R4·R5 정리 목록 (승인용) — 2026-11-26

근거: `specs/003-ops-automation/plan.md` R4·R5, `docs/plan/restructure_2026-11-25.html`.
이 문서는 읽기 전용 분석 결과다. 파일을 옮기거나 지우지 않았다. 분석 시점: 브랜치 `revive/2026-10`. `collector/main.py`·`public_scraper.py`는 커밋 전 수정 상태(R1 작업 중)다.

## 승인 받을 목록 (요약)

| 구분 | 건수 | 내용 |
|---|---|---|
| R4 최상위 `.py` | 전체 52 = 유지 15 + `_attic` 28 + `_attic/danger` 9 | 계획의 37개와 같은 37개(= `_attic` 28 + danger 9). 유지 15에는 R1 신규 `ops_log.py` 포함 |
| R4 `tools/*.py` | 24 = 모두 유지 제안 | 이동 없음. 단 `backfill_posters.py`·`make_insta_weekly.py`는 참조 0이라 «보류» 표시(표 5) |
| R4 환경 파일 | collector 안 5개 | 코드는 거의 전부 `.env.local`을 읽는다. `.env`는 `geocode_venues.py`가 NAVER 키 때문에 읽는다 → 통합 시 NAVER 키 2개를 옮겨야 함 |
| R5 루트 일회성 | 34 → `_attic/` | `.mjs` 12 + `.py` 4 + `.ts` 1 + `.sql` 17. 코드 참조는 0건. 문서에만 이름이 있는 것이 14개 |
| R5 안내서 `.md` | 8 → `_attic/docs/` 후보 | `README.md`·`CLAUDE.md`·`PRD_Pick_Art.md`는 유지 |
| R5 접을 폴더 | 4곳 | `admin/`(Streamlit) · `.agent/` · `testsprite_tests/`(루트) · `frontend/testsprite_tests/` |
| R5 쓰지 않는 화면·API | 화면 3 + 백업 1 + API 3 (+ 조건부 2) | `/admin/stats`, `/admin/blacklist`, `/admin/whitelist`, `sources/page.tsx.backup` / API `crawl/kopis`·`crawlLogs`·`updatePrompt` |
| R5 쓰지 않는 의존성 | frontend 3 + 루트 1 | `pg`, `react-datepicker`, `@types/react-datepicker` / 루트 `instaloader` |

위험하거나 먼저 정해야 할 것:

1. **R1 작업 중인 파일과 겹친다.** `main.py`·`public_scraper.py`가 커밋 전 수정 상태이고 `ops_log.py`·`rules/`·`tools/triage_review.py`가 untracked(새 파일)다. R4를 지금 하면 같은 파일을 두 세션이 만진다. R1·R2 커밋 뒤에 이동하는 편이 안전하다.
2. **danger 후보가 계획(`delete_*` 4개)보다 5개 많다.** `init_db.py`는 RLS 정책을 `USING (true)`로 여는 SQL을 담고 있어 가장 위험하다. 나머지 4개(`seed_data`, `reprocess_raw_posts`, `debug_db_insert`, `cleanup_logs`)는 운영 DB에 쓴다.
3. **`main.py`의 import 줄은 이동 전에 먼저 고쳐야 한다**(표 4). `InstaScraper`·`FacebookScraper`는 import만 하고 호출하지 않는다. `fb_scraper_service.py`(봇 탐지 우회 코드)는 계획이 «따로 물음»으로 둔 항목이라 **보류**로 두었다.
4. **프런트 `/api/crawl/kopis`는 `kopis_scraper.py` 이름을 문자열로 실행한다.** `kopis_scraper.py`는 유지 대상이라 이동과 무관하게 동작한다.
5. **`getPrompt` API는 쓰는 중이다**(`admin/inbox/page.tsx:357`). 계획이 «ai-prompt와 getPrompt/updatePrompt 모두 접기»라고 적었지만, getPrompt를 지우려면 인박스 화면부터 고쳐야 한다. 그리고 `/admin/ai-prompt`는 `admin/sources/page.tsx:275`에서 링크로 연결된다.
6. 아래 «참조 있음»은 **문서·권한 허용목록에만 이름이 나온다**는 뜻이다. 실행 경로에서 쓰는 것은 아니다.

---

## 1. R4 — 수집기 `collector/*.py`

실행 경로(유지 기준): `run_once.ps1` → `main.py --once` → `main.py`가 import하는 모듈 + `run_tool(...)`로 부르는 `tools/` 스크립트(`collect_instagram`, `discover_instagram`, `geocode_venues`, `backup_insta`, `publish_ops_snapshots`, `sync_insta_posts`) + `tools.publish_verified`(main.py:183에서 import) + 그 파일들이 import하는 것.
방법: AST로 모든 `import`(함수 안 지연 import 포함)를 읽고, 문자열로 적힌 `*.py` 이름도 따로 찾았다. 코드가 아닌 참조는 `grep -F <파일명>`으로 `docs/`·`specs/`·`.claude/`·`.agent/`·루트 `.md`·`frontend/src`에서 찾았다(`docs/insta/backup_*`는 중복이라 제외). 작업 스케줄러에는 «pick-art 정기 수집» 하나가 `collector\run_once.ps1`을 부르는 것을 확인했다.

### 표 1. 유지 (15)

| 파일 | 근거 |
|---|---|
| `main.py` | `run_once.ps1`이 실행 |
| `database.py` | main·거의 모든 스크립트가 import |
| `public_scraper.py` | main.py:9 |
| `kopis_scraper.py` | main.py:10 (+ `frontend/src/app/api/crawl/kopis/route.ts`가 파일명을 실행) |
| `naver_blog_scraper.py` | main.py:11, `insta_browser_scraper.py`·`tools/review_instagram.py`·`tools/triage_review.py`가 import |
| `notifier.py` | main.py:13 |
| `ai_extractor.py` | main.py:14·227, `public_scraper.py:10`·387 |
| `utils.py` | `public_scraper`·`kopis_scraper` 등 8곳이 import |
| `rule_extractor.py` | `public_scraper.py`가 import |
| `source_loader.py` | `public_scraper.py`와 `tools/try_source.py`·`tools/backfill_posters.py`가 import |
| `venue_norm.py` | `tools/geocode_venues.py`·`tests/test_venue_norm.py`가 import, specs/002 참조 |
| `insta_browser_scraper.py` | `tools/collect_instagram.py`·`tools/discover_instagram.py`가 import |
| `ops_log.py` | **새 파일(untracked)**. main.py가 `import ops_log` 한다(R1) |
| `insta_scraper.py` | main.py:8이 import만 하고 호출하지 않음 → 지금은 «유지(import 있음)». **이동 후보(표 3 보류)** |
| `fb_scraper_service.py` | main.py:12가 import만 하고 호출하지 않음 → 지금은 «유지(import 있음)». **이동 후보(표 3 보류)** |

`insta_scraper`·`fb_scraper_service`를 옮기면 최상위 `.py`는 15 → 13이 된다. 안 옮겨도 15라서 「≤ 15」 조건은 맞지만, 새 모듈이 하나 더 생기면 16이 된다.

### 표 2. `_attic/`로 이동 (28)

실행 경로에서 import되지 않는다. 이 28개를 가리키는 import는 유지 파일 어디에도 없다(표 4). «참조» 열의 «문서»는 옛 안내서에만 이름이 있다는 뜻이다.

| 파일 | 하는 일 | 참조 | 비고 |
|---|---|---|---|
| `analyze_failure.py` | 실패 로그 분석 | 없음 | 읽기 |
| `analyze_kimhae_museum.py` | 김해박물관 구조 분석 | 문서(REVIVAL_PLAN.md) | 읽기 |
| `check_ai_results.py` | AI 결과 점검 | 없음 | 읽기. `../frontend/.env.local` 사용 |
| `check_fb_data.py` | 페이스북 수집 점검 | 없음 | 읽기 |
| `check_ghct_results.py` | 가야문화권 결과 점검 | 없음 | 읽기 |
| `check_raw_posts.py` | raw_posts 점검 | 없음 | 읽기. `../frontend/.env.local` 사용 |
| `check_whitelist.py` | 화이트리스트 점검 | 없음 | 읽기 |
| `debug_detail_page.py` | 상세 페이지 디버그 | 없음 | 읽기 |
| `debug_fb.py` | 페이스북 디버그 | 없음 | `fb_scraper_service`를 import (같이 이동하면 문제없음) |
| `debug_kimhae_selectors.py` | 선택자 디버그 | 문서(REVIVAL_PLAN.md) | 읽기 |
| `debug_kopis_item.py` | KOPIS 항목 디버그 | 없음 | 읽기 |
| `debug_logs.py` | 로그 디버그 | 없음 | 읽기 |
| `debug_names.py` | 이름 디버그 | 없음 | 읽기 |
| `debug_public.py` | public_scraper 디버그 | 없음 | 읽기 |
| `find_exhibition_selector.py` | 선택자 탐색 | 문서(REVIVAL_PLAN.md) | 읽기 |
| `find_kimhae_container.py` | 컨테이너 탐색 | 문서(REVIVAL_PLAN.md) | 읽기 |
| `inspect_gasc.py` | 가야문화권 사이트 조사 | 문서(REVIVAL_PLAN.md) | 읽기 |
| `list_failed_logs.py` | 실패 로그 목록 | 없음 | 읽기 |
| `list_recent_fb.py` | 최근 FB 목록 | 없음 | 읽기 |
| `qa_autopilot.py` | 실패 로그 분석(AI 에이전트용) | 문서(`.agent/system/personas/qa_agent.md`) | 읽기. `.agent/`를 접으면 같이 낡음 |
| `show_full_item.py` | 항목 전체 출력 | 없음 | 읽기 |
| `test_insta_scraper.py` | 인스타 시험 | 없음 | pytest가 아닌 스크립트. 최상위 `test_*.py`는 `pytest collector`로 돌리면 수집될 수 있다 |
| `test_kimhae_museum.py` | 김해박물관 시험 | 문서(REVIVAL_PLAN.md) | `crawl_logs`·`raw_posts`에 실제로 쓴다(스크레이퍼 경유) |
| `test_wgcc_direct.py` | 우곡 직접 시험 | 문서(TROUBLESHOOTING.md 등 4곳) | 스크레이퍼 경유로 쓴다 |
| `test_whitelist_match.py` | 화이트리스트 매칭 시험 | 문서(WHITELIST_FIX.md) + `.claude/settings.local.json` 허용 목록 | 읽기 |
| `verify_crawl.py` | 수집 검증 | 문서(LOGGING_GUIDE.md, TROUBLESHOOTING.md, WHITELIST_FIX.md) + `.claude/settings.local.json` | 읽기 |
| `verify_crawling.py` | 수집 검증(구판) | 문서(`.agent/.../qa_agent.md`) | 읽기 |
| `watch_logs.py` | 로그 감시 | 문서(LOGGING_GUIDE.md, TROUBLESHOOTING.md) | 읽기 |

문서가 **현재 운영 안내**로 쓰는 것은 `collector/LOGGING_GUIDE.md`·`collector/TROUBLESHOOTING.md`다. 이동하면 두 문서의 명령어 경로가 어긋나므로, 문서 경로 갱신을 같은 커밋에 넣을지 정해야 한다.

### 표 3. `_attic/danger/`로 이동 (9) + 보류 (2)

DB 행을 쓰거나 지우거나 권한 정책을 바꾸는 일회성 스크립트. 인자 확인·dry-run이 없다.

| 파일 | 하는 일 | 근거(줄) | 참조 |
|---|---|---|---|
| `delete_all_fb.py` | `raw_posts`에서 `source=facebook` & `status=COLLECTED` 전부 삭제 | :15-18 | 문서(REVIVAL_PLAN.md) |
| `delete_gasc_data.py` | 가야문화권 `COLLECTED` 삭제 | :16-19 | 문서(REVIVAL_PLAN.md) |
| `delete_test_data.py` | `raw_posts` 한 행 삭제(id 고정) | :15 | 없음 |
| `delete_wgcc_item.py` | `source_url` 일치 행 삭제 | :18 | `.claude/settings.local.json` 허용 목록 |
| `init_db.py` | `CREATE TABLE`·`DROP POLICY`·`CREATE POLICY ... FOR ALL USING (true)` | :16-50 | 없음 (**RLS 전면 개방, 가장 위험**) |
| `seed_data.py` | `events`에 더미 행 insert | :166 | 없음 |
| `reprocess_raw_posts.py` | `COLLECTED` 전부를 `events`로 insert + 상태 변경 | :20, :68, :72 | 없음 |
| `debug_db_insert.py` | `raw_posts`에 더미 insert | :30 | 없음 |
| `cleanup_logs.py` | `crawl_logs`의 `RUNNING` 행을 일괄 update | :13, :30 | 없음 |

계획은 `delete_*` 4개만 danger로 적었다. 나머지 5개는 이 분석에서 추가한 것이다. danger에 둘지 일반 `_attic`에 둘지 결정이 필요하다.

보류(둘 다 `main.py` import 줄을 고쳐야 옮길 수 있음):

| 파일 | 이유 | 이동하려면 |
|---|---|---|
| `insta_scraper.py` | main.py:8이 import만 하고 호출하지 않음. `instaloader`를 쓴다. 문서 `docs/REPORT_instagram_2026-11.md`에 이름 있음 | main.py:8 삭제 + `test_insta_scraper.py`와 같이 이동 |
| `fb_scraper_service.py` | main.py:12가 import만 하고 호출하지 않음. 봇 탐지 우회 코드. 계획이 «따로 물음» | main.py:12 삭제 + `debug_fb.py`와 같이 이동. **처리 방법 승인 필요** |

### 표 4. 이동하면 깨지는 import (file:line)

유지 파일이 표 2·3의 37개를 import하는 줄은 **0건**이다(AST 전수). 37개만 옮기면 정기 실행 경로의 import는 깨지지 않는다. 깨지는 것은 아래뿐이다.

| 줄 | 내용 | 조건 |
|---|---|---|
| `collector/main.py:8` | `from insta_scraper import InstaScraper` | `insta_scraper.py`를 옮길 때 |
| `collector/main.py:12` | `from fb_scraper_service import FacebookScraper` | `fb_scraper_service.py`를 옮길 때 |
| `collector/debug_fb.py` → `fb_scraper_service` | 같이 옮기면 문제없음 | |
| `collector/test_insta_scraper.py` → `insta_scraper` | 같이 옮기면 문제없음 | |

(`main.py` 줄 번호는 R1이 고치는 중이라 달라질 수 있다.)

이동한 스크립트 자체의 문제: 옮긴 파일은 `from database import ...`처럼 `collector/`를 import 경로에 두고 있다. `_attic/`에서 `python _attic/x.py`로 돌리면 `database`를 못 찾는다(`sys.path[0]`이 `_attic/`가 됨). 실행하려면 `collector/`에서 `PYTHONPATH=.`가 필요하다. 보관이 목적이면 `_attic/README.md`에 한 줄 적는 정도로 충분하다.

문자열 참조(이동해도 깨지지 않는 것): `frontend/src/app/api/crawl/kopis/route.ts`는 `kopis_scraper.py`를, `api/collector/status/route.ts`는 `main.py`를 이름으로 실행한다. 둘 다 유지 대상이다. `collector/Dockerfile`도 `main.py`를 쓴다.

### 표 5. `collector/tools/*.py` (24) — 전부 유지 제안

R4 이동 대상(37개)은 최상위 `.py`뿐이다. `tools/` 중 실행 경로에서 도는 것은 8개이고, 나머지는 다른 세션(인스타 운영)이 손으로 돌리는 것이다. 인스타 운영 문서(`docs/INSTA_DAILY.md`, `INSTA_ENGAGE.md`, `INSTAGRAM_PIPELINE.md`, `INSTA_REELS.md`)와 `docs/insta/process.html`이 아래 이름을 부른다.

| 파일 | 판정 | 근거 |
|---|---|---|
| `backup_insta.py` | 유지(실행 경로) | main.py `run_tool` |
| `collect_instagram.py` | 유지(실행 경로) | main.py `run_tool`, `discover_instagram`이 import |
| `discover_instagram.py` | 유지(실행 경로) | main.py `run_tool` |
| `geocode_venues.py` | 유지(실행 경로) | main.py `run_tool` |
| `publish_ops_snapshots.py` | 유지(실행 경로) | main.py `run_tool`, 안에서 `insta_report`를 실행 |
| `sync_insta_posts.py` | 유지(실행 경로) | main.py `run_tool` |
| `publish_verified.py` | 유지(실행 경로) | main.py:183 import, `review_instagram`이 import |
| `insta_report.py` | 유지 | `publish_ops_snapshots`가 부름, `frontend/src/lib/opsStats.ts`가 언급 |
| `triage_review.py` | 유지(새, untracked) | R2 산출물 |
| `review_instagram.py` | 유지 | 참조 있음: `docs/INSTAGRAM_PIPELINE.md`, specs/003 |
| `add_curated.py` | 유지 | 참조 있음: `docs/INSTA_DAILY.md` 등 |
| `insta_approved_to_curated.py` | 유지 | 참조 있음: `docs/INSTA_ENGAGE.md` |
| `hide_events.py` | 유지 | 참조 있음. **events 일괄 숨김(쓰기)**. `--backup` 필수·`--dry-run` 있음 → danger 아님 |
| `insta_state.py` | 유지 | 참조 있음: `docs/INSTA_DAILY.md`, `docs/insta/*/rec.py`, `insta_report` |
| `insta_runs.py` | 유지 | 참조 있음: `docs/insta/process.html`, `report/runs.json` |
| `make_insta_cards.py` | 유지 | 참조 있음: `docs/BRAND_GUIDE.md`, `INSTA_DAILY.md` |
| `make_insta_reel.py` | 유지 | 참조 있음: `docs/INSTA_REELS.md` |
| `make_insta_roundup.py` | 유지 | 참조: `docs/insta/process.html`. **지금 수정 중(커밋 전)** |
| `make_reel.py` | 유지 | 참조 있음: `docs/INSTA_REELS.md`, `docs/SHORTFORM_MANUAL.md` |
| `probe.py` | 유지 | 사이트 정의 추가 절차 도구. 참조: `docs/REPORT_2026-11_등록.md`, REVIVAL_PLAN.md |
| `try_source.py` | 유지 | 사이트 정의 시험. 참조: `docs/REPORT_sources_2026-11-01.md` |
| `collect_naver_blog.py` | 유지 | 참조: `docs/REPORT_instagram_2026-11.md`만 |
| `backfill_posters.py` | **보류** | **참조 0건.** 포스터 보충 일회성. `raw_posts`·`events.poster_image_url`을 쓴다(slug 없이 실행하면 전체) |
| `make_insta_weekly.py` | **보류** | **참조 0건.** 카드 생성기(쓰기는 파일). 인스타 세션이 쓸 수 있음 |

`reel_templates/` 폴더는 유지. 보류 둘을 옮겨도 import를 깨는 곳은 없다(둘을 import하는 파일이 없다). 다만 `tools/` 안 스크립트는 `os.path.dirname(os.path.dirname(...))`로 collector 폴더를 계산하므로, 한 단계 더 깊은 `tools/_attic/`로 옮기면 경로 계산이 어긋난다.

### 표 6. 최상위의 그 밖의 파일 (이동하지 않고 목록만)

| 파일 | 상태 | 비고 |
|---|---|---|
| `facebook_debug.html`, `facebook_debug.png` | untracked | 계획이 «처리 방법을 묻는다»고 적은 디버그 산출물 |
| `collector_log.txt`, `collector_log_new.txt`, `collector_updated.log`, `kopis.log` | 옛 로그 | 같은 항목. 삭제가 아니라 방법을 질문 |
| `Dockerfile`, `start_collector.bat`, `requirements.txt`, `run_once.ps1` | 유지 | `run_once.ps1`은 작업 스케줄러가 부름 |
| `LOGGING_GUIDE.md`, `TROUBLESHOOTING.md` | 유지 | 명령어가 표 2의 파일을 가리킴 |
| `tests/test_venue_norm.py` | 유지 | pytest 대상 |

---

## 2. 환경 파일 (이름만, 값은 열지 않음)

### collector 안

| 파일 | git | 들어 있는 키 이름 |
|---|---|---|
| `.env.local` | 무시됨 | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_KEY, NEXT_PUBLIC_GEMINI_API_KEY, GEMINI_API_KEY, INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, KOPIS_API_KEY |
| `.env` | 무시됨 | SUPABASE_URL, SUPABASE_KEY, INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, NAVER_SEARCH_CLIENT_ID, NAVER_SEARCH_CLIENT_SECRET |
| `.env.example` | **추적됨** | SUPABASE_URL, SUPABASE_KEY, INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, KOPIS_API_KEY |
| `.env.bak-20261031`, `.env.local.bak-20261031` | 무시됨 | 10/31 백업 사본(키 목록은 확인하지 않음) |

collector 밖: 루트 `.env.local`(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_GEMINI_API_KEY, GOOGLE_CLOUD_PROJECT), `frontend/.env.local`·`frontend/.env.local.bak-20261031`, `admin/.env.example`(추적됨).

### 누가 무엇을 읽는가

- **`collector/.env.local`** (`load_dotenv(".env.local")`, 작업 폴더 `collector/` 기준): `main.py`, `ops_log.py`, `ai_extractor.py`, `kopis_scraper.py`, `notifier.py`, `insta_scraper.py`, 그리고 `tools/`의 `add_curated`, `backfill_posters`, `collect_instagram`, `collect_naver_blog`, `discover_instagram`, `geocode_venues`, `hide_events`, `make_insta_cards`, `make_reel`, `publish_ops_snapshots`, `publish_verified`, `review_instagram`, `sync_insta_posts`, `triage_review`. 이동 대상 37개 중에서도 대부분이 읽는다. 정기 실행에 필요한 키는 모두 여기에 있다.
- **`collector/.env`**: 읽는 파일은 `tools/geocode_venues.py:27`(`load_dotenv(".env")`)과 `insta_scraper.py:9`(`load_dotenv()`, 인자 없음) 뿐이다. `NAVER_SEARCH_CLIENT_ID/SECRET`은 `.env`에만 있고 `geocode_venues.py`가 읽는다. **통합할 때 이 두 키를 옮기지 않으면 좌표 채우기가 멈춘다.** `.env`와 `.env.local`에서 이름이 겹치는 키(SUPABASE_*, INSTAGRAM_*, TELEGRAM_*)의 값이 같은지는 확인하지 않았다(값을 열지 않는 조건).
- **`frontend/.env.local`**: 수집기 쪽에서 `tools/insta_report.py:242`, `tools/insta_approved_to_curated.py:30`, 이동 대상 `check_ai_results.py`·`check_raw_posts.py`가 읽는다.
- **`database.py`** 는 환경변수만 읽는다(`SUPABASE_URL` 또는 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_KEY` 또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`). 파일 로드는 부르는 쪽이 한다.
- 코드가 직접 읽는 그 밖의 환경변수: `AUTO_PUBLISH`, `INSTAGRAM_DAILY`(main.py), `AI_PROMPT`, `GEMINI_API_KEY`, `NEXT_PUBLIC_GEMINI_API_KEY`(ai_extractor), `KOPIS_API_KEY`·`KOPIS_REGION_FILTER`·`KOPIS_SIDO_CODE`(kopis_scraper), `INSTA_BACKUP_DIR`, `INSTA_DIR`, `HTML_TO_VIDEO`. 선택 항목이다.

통합안 확인 사항: 계획은 «`collector/.env` 하나로»라고 적었다. 그러나 코드가 실제로 많이 읽는 쪽은 `.env.local`이고 `.env`를 읽는 곳은 2곳뿐이다. 이름을 `.env`로 통일하면 `load_dotenv(".env.local")`을 부르는 거의 모든 파일(수십 곳)을 고쳐야 한다. `.env.local`로 통일하면 `.env`의 NAVER 키 2개만 옮기면 되고 코드 수정이 없다. 어느 쪽으로 할지 정해야 한다.

---

## 3. R5 — 저장소 루트

### 표 7. 루트 일회성 34개 → `_attic/` (코드 참조 0건)

«문서 참조»는 `.md`·`.html` 안내나 다른 일회성 파일에만 이름이 있다는 뜻이다. 마지막 수정일은 `git log -1 --format=%cs` 값이다. 34개 모두 루트 `package.json`(scripts 없음)·`vercel.json`·frontend 코드·수집기 코드에서 호출되지 않는다.

| 파일 | 종류 | 마지막 수정 | 문서 참조 | 비고 |
|---|---|---|---|---|
| `add_detailed_log_column.mjs` | mjs | 2026-10-28 | 없음 | `pg` 사용, 스키마 변경 |
| `apply_fix.mjs` | mjs | 2026-10-28 | REVIVAL_PLAN.md, QA_CASE_STUDIES.md, `collector/qa_autopilot.py` | `pg` 사용, 스키마 변경 |
| `create_admin.mjs` | mjs | 2026-01-02 | 없음 | 관리자 계정 생성. 새 환경 구성에 다시 필요할 수 있음 |
| `create_configs_direct.mjs` | mjs | 2026-01-02 | REVIVAL_PLAN.md | |
| `create_table_and_init.mjs` | mjs | 2026-01-02 | 없음 | |
| `fix_profiles_direct.mjs` | mjs | 2026-01-02 | 없음 | |
| `fix_profiles_raw.mjs` | mjs | 2026-01-02 | 없음 | `pg` 사용 |
| `fix_sub_data.mjs` | mjs | 2026-01-02 | 없음 | 구독자 데이터 수정 |
| `init_configs.mjs` | mjs | 2026-01-02 | 없음 | |
| `run_fix_profiles.mjs` | mjs | 2026-01-02 | 없음 | `fix_profiles_table.sql`을 실행 |
| `seed_data.mjs` | mjs | 2026-01-02 | 없음 | 더미 데이터 insert |
| `setup_storage.mjs` | mjs | 2026-01-02 | 없음 | Storage 버킷 생성. 새 프로젝트에 다시 필요할 수 있음 |
| `check_columns.py` | py | 2026-10-28 | 없음 | |
| `check_models.py` | py | 2026-01-02 | 없음 | |
| `clear_inbox.py` | py | 2026-01-02 | REVIVAL_PLAN.md | **삭제 쿼리 있음(DB 행 삭제)** |
| `trigger_test_crawl.py` | py | 2026-10-28 | 없음 | |
| `check_sub.ts` | ts | 2026-01-02 | 없음 | |
| `add_dummy_subscribers.sql` | sql | 2026-01-02 | 없음 | 더미 insert |
| `clean_seed.sql` | sql | 2026-01-02 | 없음 | **DELETE 포함** |
| `create_configs_table.sql` | sql | 2026-01-02 | `.agent/.../backend_agent.md`, `supabase/migrations/20261028000000_baseline.sql`, 위 mjs 2개 | 이름만 언급 |
| `database_init.sql` | sql | 2026-01-02 | 없음 | |
| `database_updates.sql` | sql | 2026-01-02 | 없음 | |
| `fix_permissions.sql` | sql | 2026-10-28 | 없음 | |
| `fix_profiles_rls.sql` | sql | 2026-01-02 | REVIVAL_PLAN.md | |
| `fix_profiles_rls_final.sql` | sql | 2026-01-02 | REVIVAL_PLAN.md | |
| `fix_profiles_table.sql` | sql | 2026-01-02 | `run_fix_profiles.mjs` | |
| `fix_schema_columns.sql` | sql | 2026-10-28 | `apply_fix.mjs`, REVIVAL_PLAN.md | |
| `local_schema.sql` | sql | 2026-01-02 | 없음 | |
| `restore_subscribers.sql` | sql | 2026-01-02 | 없음 | |
| `schema.sql` | sql | 2026-01-02 | `.agent/workflows/deploy.md`, `collector/tools/hide_events.py`(주석에 «옛 제약 목록»으로 언급) | 현행 스키마는 `supabase/migrations/`가 맡는다 |
| `seed_all.sql` | sql | 2026-01-02 | 없음 | 더미 데이터 |
| `seed_full_pipeline.sql` | sql | 2026-01-02 | 없음 | 더미 데이터 |
| `seed_v2.sql` | sql | 2026-01-02 | 없음 | 더미 데이터 |
| `storage_policy.sql` | sql | 2026-01-02 | 없음 | Storage 정책 |

현재 DB 스키마의 기준은 `supabase/migrations/20261028000000_baseline.sql` 이후 13개 파일이다.

따로 알림: `create_admin.mjs`·`setup_storage.mjs`는 새 환경 구성용 도구에 가깝다. `clean_seed.sql`·`clear_inbox.py`는 삭제를 포함하므로 `_attic/danger/` 후보다.

### 표 8. 루트의 `.md`·`.pdf`

| 파일 | git | 문서 참조 | 판정 |
|---|---|---|---|
| `README.md` | 추적 | 여러 곳 | 유지(계획: 지금 구조로 다시 씀) |
| `CLAUDE.md` | 추적 | constitution 등 | 유지 |
| `PRD_Pick_Art.md` | 추적 | project-orchestrator 에이전트 | 유지 |
| `PRD_Gyeongnam_Art_Navigator.md` | 추적 | 없음 | 보류(옛 기획) |
| `REVIVAL_PLAN.md` | 추적 | `docs/REVIVE_진행.md` | `_attic/docs/` 후보 |
| `AUTO_COLLECTOR_GUIDE.md` | 추적 | REVIVAL_PLAN.md, restructure html | `_attic/docs/` (계획이 E: 경로가 적힌 옛 안내서로 지목) |
| `COLLECTOR_SETUP_GUIDE.md` | 추적 | 없음 | `_attic/docs/` 후보 |
| `CRAWL_CONTROL_GUIDE.md` | 추적 | 없음 | `_attic/docs/` 후보 |
| `ADD_PROFILE_FIELDS.md` | 추적 | 없음 | `_attic/docs/` 후보 |
| `LEE_KWON_PROFILE.md` | 추적 | 없음 | 보류(개인 프로필 문서, 운영자 판단) |
| `QA_CASE_STUDIES.md` | 추적 | `.agent/` 여러 곳, `qa_autopilot.py` | `.agent/`를 접을 때 같이 |
| `WGCC_AUTO_CLASSIFICATION.md` | 추적 | WHITELIST_FIX.md | `_attic/docs/` 후보 |
| `WHITELIST_FIX.md` | 추적 | COLLECTOR_SETUP_GUIDE.md | `_attic/docs/` 후보 |
| `GOOGLE_SUPPORT_GUIDE.md` | **untracked** | `docs/REVIVE_진행.md` | 다른 세션이 만든 새 파일. 건드리지 않음 |
| `공연예술통합전산망OpenAPI개발가이드.pdf` | untracked | `kopis_scraper.py`가 이름을 언급 | 유지(KOPIS 참조 문서) |

«`_attic/docs/` 후보 8개»는 REVIVAL_PLAN, AUTO_COLLECTOR_GUIDE, COLLECTOR_SETUP_GUIDE, CRAWL_CONTROL_GUIDE, ADD_PROFILE_FIELDS, QA_CASE_STUDIES(`.agent/`와 함께), WGCC_AUTO_CLASSIFICATION, WHITELIST_FIX 이다.

### 표 9. 접을지 결정할 폴더

| 폴더 | 크기 | 근거 |
|---|---|---|
| `admin/` | 14 KB | Streamlit `app.py`. 참조는 `README.md`·PRD뿐. 마지막 사용 1월(계획의 판단) |
| `.agent/` | 201 KB | 설계 문서·에이전트 스크립트. 참조: `.claude/agents/project-orchestrator.md`, REVIVAL_PLAN.md |
| `testsprite_tests/` (루트) | 304 KB | `.gitignore`에도 이름이 있음. 참조는 `docs/REVIVE_진행.md`뿐 |
| `frontend/testsprite_tests/` | 232 KB | 위와 같음 |
| `frontend/` 안 로그 | — | `delete_log.txt`, `delete_log_2.txt`, `testsprite_debug.log`, `testsprite_final.log`, `testsprite_final_run.log`, `testsprite_run.log` (`testsprite_*.log` 4개는 추적됨) |
| `supabase/migrations_legacy/` | — | `docs/REVIVE_진행.md`와 baseline 주석에 언급. 기록용이라 이동 대상 아님 |
| `supabase/snippets/` | 1개(`Untitled query 886.sql`) | 참조 0 |

---

## 4. R5 — frontend

### 표 10. 화면(`src/app/**/page.tsx`)

인바운드 링크를 `grep -F "<경로>"`로 `src/`·`public/`·`docs/`·`specs/`에서 찾았다.

| 화면 | 인바운드 | 판정 |
|---|---|---|
| `/admin/stats` | **0** (`AdminHeader` 메뉴에 없음, 다른 화면의 링크 없음. 문서는 restructure html만) | **접기 후보** (계획: `/admin`과 같은 숫자) |
| `/admin/blacklist` | **0** | **접기 후보.** 같은 `whitelist`·`blacklist` 테이블을 `/admin/sources` 탭이 다룬다(`sources/page.tsx:86,131,148`) |
| `/admin/whitelist` | **0** | 위와 같음 |
| `/admin/sources/page.tsx.backup` | 파일 자체가 백업(222줄) | **접기 후보** |
| `/admin/ai-prompt` | `admin/sources/page.tsx:275` 링크 1곳 | 조건부. AI가 꺼져 있다는 계획의 판단. 지우려면 sources의 링크도 같이 고쳐야 함 |
| `/admin/configs` | `AdminHeader.tsx` 사용자 메뉴 | 유지 |
| `/admin`, `/inbox`, `/sources`, `/manual`, `/subscribers`, `/venues`, `/reports`, `/storage` | `AdminHeader.tsx` 메뉴 | 유지 |
| `/signup` | 인바운드는 `public/sw.js`뿐. 화면 코드의 링크는 grep에 나오지 않음 | **확인 필요**(가입 흐름이 `/login`의 소셜 로그인으로 통합됐는지 이 분석에서는 모름). 지우지 말고 질문 |
| `/welcome`, `/auth/callback`, `/saved`, `/tip`, `/privacy`, `/terms`, `/nearby`, `/calendar`, `/settings`, `/login` | `Header`·`SiteFooter`·로그인 화면 등에서 링크 있음 | 유지 |
| `/events/[id]`, `/events/[id]/ics`, `/calendar.ics` | 컴포넌트에서 링크 | 유지 |

### 표 11. API(`src/app/api/**`)

| 라우트 | 코드 사용처 | 판정 |
|---|---|---|
| `/api/collector/status` | `admin/sources/page.tsx` | 유지. `main.py`를 이름으로 실행(`status/route.ts:44,59`) |
| `/api/getPrompt` | **`admin/inbox/page.tsx:357`** | **사용 중.** 계획의 «접기» 항목이지만 인박스 화면 수정이 먼저 |
| `/api/updatePrompt` | **코드 사용처 0** (`docs/DEPLOY_checklist.md`에 이름만) | **접기 후보.** `blockOnDeploy()`로 배포에서는 이미 막힘 |
| `/api/crawlLogs` | **코드 사용처 0** (문서 `DEPLOY_checklist.md`만) | **접기 후보** |
| `/api/crawl/kopis` | **코드 사용처 0** (문서만) | **접기 후보.** 로컬에서 `python kopis_scraper.py`를 실행하는 «수동 KOPIS 수집» 라우트라 흔적이 있다 |
| `/api/keywords` | `app/page.tsx` | 유지 |
| `/api/newsletter` | `app/page.tsx`, RPC `subscribe_newsletter` | 사용 중. 계획은 «구독자 0명 → 남길지 질문». 구독자 수는 DB를 읽지 않아 이 분석에서 확인하지 못했다 |

`docs/DEPLOY_checklist.md`는 `/api/collector/status`, `/api/crawl/kopis`, `/api/getPrompt`, `/api/updatePrompt`, `/api/crawlLogs`가 배포 환경에서 차단되는 라우트라고 적고 있다(코드의 `blockOnDeploy()`). 그 5개 중 `getPrompt`는 인박스가, `collector/status`는 sources 화면이 로컬에서 쓴다.

### 표 12. 의존성

`frontend/package.json`의 `dependencies`를 `frontend/src`·`public`에서 `grep -F`로 찾았다. 설정 파일에서 쓰는 것은 따로 확인했다. `npm ls`·빌드는 돌리지 않았다.

| 패키지 | `src` 사용 | 판정 |
|---|---|---|
| `pg` | **0** (`from "pg"` 없음) | **쓰지 않음** (계획과 일치) |
| `react-datepicker` | **0** | **쓰지 않음** (계획에 없던 항목) |
| `@types/react-datepicker` | **0** | **쓰지 않음**(위 패키지의 타입) |
| `postcss-preset-mantine`, `postcss-simple-vars` | `src` 0, **`postcss.config.mjs:4-5`가 사용** | 유지 |
| `@mantine/core`(20개 파일), `@mantine/hooks`(2), `@supabase/supabase-js`(1), `@vercel/analytics`(1), `clsx`(1), `lucide-react`(30), `tailwind-merge`(1) | 사용 | 유지 |
| `next`, `react`, `react-dom` | 프레임워크 | 유지 |

devDependencies(`@tailwindcss/postcss`, `tailwindcss`, `eslint`, `eslint-config-next`, `typescript`, `@types/*`)는 설정·빌드가 쓰므로 목록에서 뺐다.

루트 `package.json`: 의존성 4개 중 `@supabase/supabase-js`, `dotenv`, `pg`는 루트 `.mjs`가 쓴다. **`instaloader`(npm)는 어디에서도 import되지 않는다**(수집기는 파이썬 패키지 `instaloader`를 `insta_scraper.py`에서 쓴다). 표 7의 `.mjs` 12개를 `_attic/`으로 옮기면 루트 `package.json`·`node_modules/` 전체가 사용처를 잃는다. 이것도 처리 방법을 정해야 한다.

---

## 5. 승인 뒤 실행 순서와 끝 조건 (제안)

| 단계 | 하는 일 | 무엇으로 확인 |
|---|---|---|
| ① R1·R2 커밋 확인 | `git status`에서 `main.py`·`public_scraper.py`가 깨끗한지 | 수정 파일 0 |
| ② `main.py` 미사용 import 줄 삭제 | 표 4의 :8(·:12) | `python -m pytest collector/tests` + `python -c "import ast;ast.parse(open('collector/main.py',encoding='utf-8').read())"` |
| ③ `git mv` 28개 → `_attic/`, 9개 → `_attic/danger/` | 표 2·3 | `ls collector/*.py`가 15개 이하 |
| ④ 정기 실행 1회 | `collector/run_once.ps1` | 이동 직전 회차와 출처별 발견 건수 같음(`collector/logs/scheduled_*.log` 비교) |
| ⑤ 환경 파일 통일 | 선택지 결정 후 | `geocode_venues.py --dry-run`에서 NAVER 키가 읽히는지 |
| ⑥ R5 이동 | 표 7·8 | `npm run build`(frontend) 통과, 관리자 메뉴 전 페이지 열림 |

## 승인에 필요한 선택 (맨 뒤에 한데 모음)

1. `init_db.py`·`seed_data.py`·`reprocess_raw_posts.py`·`debug_db_insert.py`·`cleanup_logs.py`를 `delete_*` 4개와 함께 `_attic/danger/`로 보낼지(9개), 아니면 4개만 danger로 하고 나머지는 일반 `_attic/`로 보낼지(계획 원안 4 + 33).
2. `fb_scraper_service.py`(+`debug_fb.py`)와 `insta_scraper.py`(+`test_insta_scraper.py`)를 이번에 옮길지(최상위 15 → 13), 두고 갈지.
3. `tools/backfill_posters.py`·`tools/make_insta_weekly.py`(참조 0)를 `tools/`에 둘지.
4. 환경 파일 이름: `.env.local`로 통일(NAVER 키 2개만 옮김, 코드 수정 없음) vs `.env`로 통일(수십 곳 코드 수정).
5. 루트 34개 중 `create_admin.mjs`·`setup_storage.mjs`(새 환경용), `clean_seed.sql`·`clear_inbox.py`(삭제 포함)를 어디에 둘지.
6. 루트 옛 안내서 `.md` 8개의 `_attic/docs/` 이동 범위, `PRD_Gyeongnam_Art_Navigator.md`·`LEE_KWON_PROFILE.md` 처리.
7. 폴더 `admin/`·`.agent/`·`testsprite_tests/`(2곳)·`frontend` 안 로그 6개를 접을지.
8. frontend: `/admin/stats`·`/admin/blacklist`·`/admin/whitelist`·`page.tsx.backup`·API `crawlLogs`·`updatePrompt`·`crawl/kopis`를 지울지, `/admin/ai-prompt`·`getPrompt`(인박스가 사용 중)를 같이 손볼지, `/signup`·`/api/newsletter`는 어떻게 할지.
9. 의존성: `pg`, `react-datepicker`, `@types/react-datepicker`(frontend)와 `instaloader`(루트)를 제거할지.
