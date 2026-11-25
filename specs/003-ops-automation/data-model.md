# Data Model: 운영 자동화와 운영 대시보드

새 테이블·새 컬럼·새 상태 값은 없다. 아래는 모두 이미 있는 자리 안의 모양이다.

## 1. ops_snapshots (적용됨, `supabase/migrations/20261125000000_ops_snapshots.sql`)

| 칸 | 형 | 뜻 |
|---|---|---|
| name | text PK | 묶음 이름 |
| data | jsonb | `{rows: [...], meta: [...]}` |
| updated_at | timestamptz | 마지막 쓰기 |

RLS: 관리자(`is_admin()`)만 SELECT. 쓰기는 service 키(이 PC의 수집기)만.

| name | 쓰는 곳 | 행 | 언제 |
|---|---|---|---|
| `insta_metrics` · `insta_daily` · `insta_runs` · `insta_stats` | `tools/publish_ops_snapshots.py` | insta_report.py 출력 그대로 | 정기 실행 끝(있음) |
| `collector_runs` | `ops_log.py` (R1) | 실행 1회 × 출처 1곳 | 정기 실행 끝 |
| `collector_alerts` | `ops_log.py` (R1) | 경고 1건 | 정기 실행 끝 |

모양은 [contracts/ops-snapshots.md](contracts/ops-snapshots.md).

### 수집 실행 기록 줄 (collector_runs.rows[])

| 칸 | 뜻 | 규칙 |
|---|---|---|
| run_at | 실행 시작 시각(ISO, KST 오프셋) | 같은 실행의 줄은 같은 값 |
| source | 출처 이름(화이트리스트 name 또는 `KOPIS`·`instagram`·`publish`) | |
| kind | `website` · `kopis` · `blog` · `instagram` · `publish` · `geo` · `backup` | |
| status | `SUCCESS` · `WARN` · `FAIL` | 정의 만료 의심은 WARN |
| found · new · dup · fail | 정수 | 없으면 null(0과 구별) |
| expired_def | bool | 정의 파일의 목록 선택자 0건 |
| note | 짧은 글(200자) | summary 원문 |

보존: 최근 60회(run_at 기준). 넘으면 오래된 실행부터 버린다(로그 파일 원본은 `collector/logs/`에 남음).

### 경고 (collector_alerts.rows[])

| 칸 | 뜻 |
|---|---|
| rule | 규칙 id (`zero_found`, `source_fail`, `def_expired`, `publish_zero`) |
| target | 출처 이름(전체 규칙이면 `*`) |
| level | `bad` · `warn` |
| text | 대시보드·텔레그램에 그대로 쓰는 한 줄 |
| since | 처음 생긴 실행의 run_at |
| resolved_at | 풀린 실행의 run_at, 켜져 있으면 null |

상태 변화: (없음) → 켜짐(since) → 풀림(resolved_at). 풀린 경고는 7일 보존 뒤 버린다. 텔레그램은 켜짐·풀림 때만.

«정기 실행 누락»은 저장하지 않는다. 대시보드가 `collector_runs`의 마지막 run_at으로 판정한다(실행이 없으면 쓸 주체가 없으므로).

## 2. raw_posts (있음)

상태 값은 기존 것만: `COLLECTED`(인박스) · `REVIEW`(인스타 후보) · `PUBLISHED` · `REJECTED` · `EXPIRED` · `DUPLICATE`.

새로 쓰는 JSON 키(`content` 안):

| 키 | 값 | 뜻 |
|---|---|---|
| review_bucket | `consent` · `candidate` · `human` | REVIEW일 때만. 무더기 |
| review_bucket_at | ISO | 분류한 시각 |
| review_reason | 짧은 글 | 왜 그 무더기인지(규칙 이름) |
| publish_approved_at | ISO | «공개 후보» 묶음 승인 시각. 다음 정기 실행이 `publish_verified --ids`로 공개 |

전이(R2):

```text
REVIEW ──(끝나는 날 < 오늘)──────────────▶ EXPIRED
REVIEW ──(공개된 행사와 같음)───────────▶ DUPLICATE
REVIEW ──(남은 것)──▶ REVIEW + review_bucket
REVIEW+candidate ──(관리자 승인)──▶ publish_approved_at ──(정기 실행 검증 통과)──▶ PUBLISHED
                                                    └──(검증 실패)──▶ REVIEW 유지, review_reason 갱신
REVIEW+consent ──(동의 받음, 인스타 세션 기존 흐름: curated → publish_verified --curated)──▶ PUBLISHED
```

## 3. 규칙 파일 collector/rules/alerts.json (R1)

이상 판정 기준. 모양은 [contracts/alert-rules.md](contracts/alert-rules.md). 출처 정의 파일 `sources/<slug>.json`의 `expect.quiet_runs_ok`가 있으면 그 출처는 그 값을 쓴다.
