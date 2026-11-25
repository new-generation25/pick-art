# Contract: 이상 판정 규칙 (collector/rules/alerts.json)

판정은 수집기(`ops_log.py`)가 정기 실행 끝에 `collector_runs`의 최근 기록으로 한다. 이 파일만 고치면 기준이 바뀐다.

```json
{
  "zero_found":   {"level": "warn", "runs": 2, "kinds": ["website", "kopis", "blog"],
                   "text": "{source} 발견 0건이 {n}회 연속입니다"},
  "source_fail":  {"level": "bad",  "runs": 1,
                   "text": "{source} 수집 실패: {note}"},
  "def_expired":  {"level": "warn", "runs": 1, "kinds": ["website"],
                   "text": "{source} 사이트 정의 만료 의심 — 정의 파일 수리 필요"},
  "publish_zero": {"level": "warn", "runs": 3,
                   "text": "자동 공개가 {n}회 연속 0건입니다"},
  "kopis_override": {"zero_found_runs": 2, "level": "bad"}
}
```

- 출처 정의 파일 `collector/sources/<slug>.json`의 `expect.quiet_runs_ok: N`이 있으면 그 출처의 `zero_found.runs`를 N으로 바꾼다(원래 행사가 드문 출처용). 없고 `expect.min_rows`가 0(빈 목록 허용)이면 6회(사흘)로 본다 — 11/26 기준 6곳(`main.quiet_runs`).
- 마지막 실행이 «정의 만료 의심»이면 `source_fail` 대신 `def_expired`만 켠다(같은 원인 두 줄 방지). 자동 공개 줄은 `source_fail` 대상이 아니다.
- 마지막 실행에 없던 출처(화이트리스트에서 빠진 곳)는 판정하지 않는다.
- 기준은 **발견(found) 0**이다. 신규(new) 0은 정상(중복만 있는 날)이라 쓰지 않는다.
- 경고 키는 `(rule, target)`. 같은 키가 이미 켜져 있으면 다시 만들지 않는다(텔레그램 반복 방지).
- 대시보드 전용 판정(수집기가 쓰지 않음): «정기 실행 누락» = 지금 − 마지막 `collector_runs.run_at` > 14시간 (`frontend/src/lib/opsStats.ts`의 `ALERT_RULES`).

## 텔레그램

- 경고가 켜지거나 풀린 실행: `⚠️ 피카 수집 경고` 머리 + 켜진 것·풀린 것 한 줄씩(최대 5줄, 넘으면 «외 n건 — 대시보드»).
- 그날 15:00 실행: 하루 요약 1통 — 출처 수, 실패 수, 새 공개 수, 켜진 경고 수, 대시보드 주소.
- 그 밖의 실행: 보내지 않는다.

## 구현 메모 (2026-11-26)

- 숫자는 스크래퍼 요약 글(«발견 N건 (신규·중복·실패)», KOPIS «경남 a · 부산 b건», 블로그 «블로그 행사 N건»)에서 읽는다. 지난 로그도 같은 파서로 채웠다: `python ops_log.py --backfill` → 24회·679줄, 켜진 경고 5건(KOPIS 실패·0건 11회, 부산현대미술관 접속 실패, 거창·함안 정의 만료 의심).
- 웹 출처 네트워크 오류(접속 끊김·시간 초과)는 30초 뒤 한 번 더 해 본다(`public_scraper.RETRY_WAIT`). 요약에 «재시도 1회 뒤 성공»·«(재시도 1회)»가 붙는다.
- 시험: `python ops_log.py --test-fail KOPIS [--send]` — `*_test` 스냅숏에서 고장 2회·정상 1회. 11/26 결과: 1회째 «수집 실패» 켜짐, 2회째 «0건 2회 연속» 켜짐, 3회째 둘 다 풀림. 시험 스냅숏은 지움.
- 텔레그램: 이 PC의 `collector/.env.local` 토큰·채팅 ID가 예시값이라 notifier 가 꺼져 있다(예전 전체 보고도 가지 않았음). 운영자가 실제 값을 넣으면 경고 켜짐·풀림과 오후 하루 요약만 간다. 판정이 실패한 실행은 예전 전체 보고를 보낸다.
