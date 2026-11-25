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

- 출처 정의 파일 `collector/sources/<slug>.json`의 `expect.quiet_runs_ok: N`이 있으면 그 출처의 `zero_found.runs`를 N으로 바꾼다(원래 행사가 드문 출처용).
- 기준은 **발견(found) 0**이다. 신규(new) 0은 정상(중복만 있는 날)이라 쓰지 않는다.
- 경고 키는 `(rule, target)`. 같은 키가 이미 켜져 있으면 다시 만들지 않는다(텔레그램 반복 방지).
- 대시보드 전용 판정(수집기가 쓰지 않음): «정기 실행 누락» = 지금 − 마지막 `collector_runs.run_at` > 14시간 (`frontend/src/lib/opsStats.ts`의 `ALERT_RULES`).

## 텔레그램

- 경고가 켜지거나 풀린 실행: `⚠️ 피카 수집 경고` 머리 + 켜진 것·풀린 것 한 줄씩(최대 5줄, 넘으면 «외 n건 — 대시보드»).
- 그날 15:00 실행: 하루 요약 1통 — 출처 수, 실패 수, 새 공개 수, 켜진 경고 수, 대시보드 주소.
- 그 밖의 실행: 보내지 않는다.
