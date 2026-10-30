# pick-art 되살리기 진행 기록

브랜치: `revive/2026-10`
계획: 진단과 단계 계획(S0~S6). REVIVAL_PLAN.md(2026-08-20)를 실측에 맞게 정정한 것이다.

## 2026-10-28 진단 (실측)

- DB 연결 불가
  - `collector/.env`가 가리키는 클라우드 Supabase는 2026-10-28에 DNS에 이름이 없었다(8.8.8.8 조회 포함). 그래서 「삭제됨」으로 판단했다.
    - **정정(2026-10-30): 판단이 틀렸다.** Management API로 조회하니 이 프로젝트는 살아 있다(`culture-news`, ref `kbmw…`, ap-northeast-1, ACTIVE_HEALTHY). 10-28에는 일시정지 상태였던 것으로 본다(확인 못 함).
    - 테이블은 3개(events, raw_posts, blacklist)뿐이다. events 10건은 시드 더미이고, raw_posts는 0건이다.
  - `.env.local` 계열은 로컬 `127.0.0.1:54321`을 가리킨다. Docker Desktop이 꺼져 있어 연결이 거부된다.
- Python 3.13.14, requirements 12종 모두 설치됨(전역)
- frontend `tsc --noEmit` 오류 0건. `npm run build`는 아직 실행하지 않았다.
- 공개 저장소(`new-generation25/pick-art`, PUBLIC)에 키가 노출돼 있다.
  - `collector/.env.example`: `culture-news` 프로젝트의 service_role JWT. **2026-10-30 확인 결과 이 키는 지금도 유효하다(REST 200).** 키 교체가 필요하다.
  - `frontend/testsprite_tests/tmp/config.json`: TestSprite API 키. **폐기가 필요하다.**
  - 그 밖의 `*.mjs`에 있는 JWT는 로컬 Supabase 기본 데모 키(`iss: supabase-demo`)나 자리표시자라서 위험하지 않다.

## S0 스냅샷과 보안 정리: 완료

- `b66b01f`: 작업 트리 스냅샷, 121개 파일
  - KOPIS API 키를 소스에서 빼 `collector/.env.local`의 `KOPIS_API_KEY`로 옮겼다.
  - `collector/.env.example`을 자리표시자로 바꿨다.
  - `.gitignore`에 `.env.*`와 `!.env.example`을 추가했다.
- 커밋에서 뺀 파일
  - `GOOGLE_SUPPORT_GUIDE.md`: 루트 `.env.local`이 지금 쓰는 Gemini 키가 본문에 그대로 들어 있다.
  - `testsprite_tests/tmp/config.json`: TestSprite 키가 들어 있다.
  - 디버그 산출물(`facebook_debug.*`, `delete_log*.txt`, `*.backup`)과 KOPIS 가이드 PDF
- `61734e7` (2026-10-30): `frontend/testsprite_tests/tmp/config.json`의 git 추적을 해제했다. 파일은 디스크에 남겨 두고 `.gitignore`에 추가했다.
  - 결과: 현재 추적 중인 파일에서 실제 키는 0건이다. 남은 JWT 9개는 데모 키 7개와 `ref:"project"` 자리표시자 2개다.
- 원격 git 이력은 정리하지 않기로 했다(사용자 결정). 과거 커밋에는 키가 그대로 남아 있으므로 TestSprite 키는 따로 폐기해야 한다.

## 2026-10-30 수집 dry-run (DB 없이 실제 코드 실행)

DB가 없어서 저장 대신 가짜 DB로 결과만 받았다. `PublicScraper`는 고치지 않고 그대로 돌렸다.

| 대상 | 결과 | 원인 |
|---|---|---|
| 김해서부문화센터 공연 `wgcc…/show01_01` | 9건 수집 | wgcc 전용 분기 |
| 김해서부문화센터 전시 `wgcc…/show02_01` | 3건 수집 | 같은 분기. 다만 카테고리가 '공연'으로 강제된다(오류) |
| 김해문화의전당 전시 `gasc.ghct.or.kr/board/exhibition01` | 0건 | `ul.img_list li`가 8건 있는데, 이 구조는 wgcc 도메인에서만 쓰게 돼 있다 |
| 국립김해박물관 `020201.html` | 0건 | HTTP 404 "누리집 점검 안내" 페이지(사이트 측) |
| KOPIS API(경남, 60일) | 100건(rows 상한). 이 중 김해 시설 17건 | API는 정상이다. `kopis_scraper.py`는 ImportError라 이 결과는 API를 직접 호출해 얻었다 |
| Instagram 게스트(instaloader) | 실패 | 해시태그는 403 `login_required`, 프로필은 429 |

수집된 12건의 품질: 제목·링크·이미지는 12건 모두 채워졌다. 날짜는 0/12다(AI가 꺼져 있다). 본문은 21~227자다.

## S1 스키마: 파일 작성 완료, DB 적용 전

- `b08f595`
  - 옛 마이그레이션 5개를 `supabase/migrations_legacy/`로 옮겼다.
  - `supabase/migrations/20261028000000_baseline.sql`을 하나 새로 만들었다.
- 테이블 10개: raw_posts, events, whitelist, blacklist, crawl_logs, configs, crawler_configs, profiles, subscribers, keywords. 여기에 버킷 2개(posters, event-images)를 더했다.
- 컬럼은 frontend와 collector 실행 코드가 실제로 읽고 쓰는 것에 맞췄다.
- 바뀐 기본값: `whitelist.auto_publish`를 true에서 false로 바꿨다.
  - true면 수집 직후 raw_posts가 PUBLISHED로 저장된다.
  - 그러면 인박스에 나타나지 않는데 events에도 들어가지 않는다.
- 검증하지 못한 것: SQL이 실제로 적용되는지는 새 프로젝트에 넣어 봐야 안다.

### 2026-10-31 새 프로젝트에 적용: 완료

- 기존 `culture-news`는 사용자가 삭제했다. 노출된 service_role 키 문제는 이것으로 끝났다.
- 새 프로젝트 `pick-art`를 만들었다: ref `bebnijyqhzcftvlueeyn`, ap-northeast-2(서울), Free, 조직은 new-generation25's Org.
  - 무료 플랜의 활성 프로젝트 한도(2개) 때문에 `culture-news`를 지운 뒤에야 만들 수 있었다.
  - DB 비밀번호는 생성 화면의 Generate 버튼으로 만들었다. 저장소 어디에도 기록하지 않았다. 필요하면 Database 설정에서 다시 지정한다.
- SQL Editor로 baseline을 실행했다. 실행 전에 커밋본과 SHA-256이 같은지 확인했고, 결과는 "Success. No rows returned"였다.
- 확인 결과
  - REST 테이블 10개: blacklist, configs, crawl_logs, crawler_configs, events, keywords, profiles, raw_posts, subscribers, whitelist
  - anon 키로 `configs.ai_prompt`를 읽을 수 있다.
  - 버킷 2개가 모두 public이다: posters, event-images.
  - `collector/database.Database()`로 접속된다. whitelist 0건, crawl_logs 0건.
- env 파일에 새 URL과 키를 넣었다: `collector/.env.local`, `collector/.env`, `frontend/.env.local`, 루트 `.env.local`.
  - 기존 파일은 `*.bak-20261031`로 백업했다. git 무시 대상이다.
- 다음 할 일: whitelist가 비어 있다. S2에서 수집 대상을 등록한다.

## S2 수집기가 F:에서 돈다: 완료 (2026-10-31)

### 코드 수정

| 파일 | 내용 |
|---|---|
| `main.py` | 쓰지 않는 `import pytz`를 제거했다(requirements에 없음). `crawl_logs` 시각을 UTC로 기록하게 했다. |
| `public_scraper.py` | `utcnow()`를 `now(timezone.utc)`로 바꿨다. |
| `database.py` | `get_crawl_logs`의 `{"ascending": false}`(NameError)를 `desc=True`로 고쳤다. |
| `notifier.py` | `load_dotenv()`(.env)를 `.env.local`로 바꿨다. |

- `main.py`의 시각 기록 수정 이유: 기존 `datetime.now().isoformat()`은 KST 시각을 시간대 없이 넘겨서, DB에 9시간 어긋나게 저장된다.
- `notifier.py` 수정 이유: 이제 수집기의 모든 모듈이 `.env.local` 하나만 읽는다.
- 계획과 다른 점: 계획에는 `.env`로 통일한다고 적었지만 `.env.local`로 통일했다. main, kopis, ai_extractor가 이미 `.env.local`을 읽고 있기 때문이다. 이제 `collector/.env`는 읽는 코드가 없다.
- `kopis_scraper.py`의 `utcnow`는 S4에서 이 파일을 고칠 때 함께 바꾼다.

### 실행 결과

- whitelist에 1건 등록: 김해서부문화센터 (`webpage`, `https://wgcc.ghct.or.kr/board/show01_01`, auto_publish=false)
- `python -u main.py` 기동: 예외 없이 "Scheduler started"가 출력됐다.
- 수동 요청 1회(crawl_logs id 1): 50초 만에 SUCCESS로 끝났다. "발견 10건 (신규 10, 중복 0, 실패 0)".
- 수동 요청 2회(id 2): 10초 만에 SUCCESS. "신규 0, 중복 10". 중복 처리가 정상이다.
- raw_posts 10건, 모두 COLLECTED 상태. 이미지 10장이 Storage `posters/`에 올라갔고, 공개 URL 10개 모두 HTTP 200을 돌려준다.
- 실행 로그에 Error나 Traceback은 0건이다.

### 남은 문제 (S3 이후)

- 날짜가 10건 모두 비어 있다(AI 꺼짐).
- 텔레그램 토큰이 자리표시자(`your_bot_token`)인데도 알림이 "켜짐"으로 판정된다. 실제 전송은 실패하고 로그만 남는다.
