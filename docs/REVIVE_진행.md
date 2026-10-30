# pick-art 되살리기 진행 기록

브랜치: `revive/2026-10`
계획: 진단과 단계 계획(S0~S6). REVIVAL_PLAN.md(2026-08-20)를 실측에 맞게 정정한 것이다.

## 2026-10-28 진단 (실측)

- DB 연결 불가
  - `collector/.env`가 가리키는 클라우드 Supabase는 DNS에 이름이 없다(8.8.8.8 조회 포함). 프로젝트가 삭제된 상태다.
  - `.env.local` 계열은 로컬 `127.0.0.1:54321`을 가리킨다. Docker Desktop이 꺼져 있어 연결이 거부된다.
- Python 3.13.14, requirements 12종 모두 설치됨(전역)
- frontend `tsc --noEmit` 오류 0건. `npm run build`는 아직 실행하지 않았다.
- 공개 저장소(`new-generation25/pick-art`, PUBLIC)에 키가 노출돼 있다.
  - `collector/.env.example`: 삭제된 프로젝트의 service_role JWT. 프로젝트가 없어져 현재는 무효다.
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
