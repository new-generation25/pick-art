# Contract: ops_snapshots 묶음별 JSON

읽는 쪽: `frontend/src/app/admin/page.tsx`(관리자 세션, RLS). 쓰는 쪽: 수집기(service 키). 쓰기는 `upsert(on_conflict=name)` 후 다시 읽어 `updated_at`이 같으면 성공으로 센다(헌장 V, `publish_ops_snapshots.py`와 같은 방식).

## insta_metrics · insta_daily · insta_runs · insta_stats (있음)

`collector/tools/insta_report.py` 출력 파일 그대로. 대시보드가 쓰는 칸:
- `insta_metrics.rows[kind=summary]`: `id, group, name, value, unit, status(ok|warn|none), target, what`
- `insta_metrics.rows[kind=day]`: `date, posts, posts_small, posts_public`

insta_report.py가 칸 이름을 바꾸면 대시보드가 깨진다. 바꿀 때 이 문서와 대시보드를 같이 고친다.

## collector_runs (R1)

```json
{
  "rows": [
    {"run_at": "2026-11-26T08:20:05+09:00", "source": "KOPIS", "kind": "kopis",
     "status": "SUCCESS", "found": 194, "new": 12, "dup": 182, "fail": 0,
     "expired_def": false, "note": "✅ KOPIS 수집 완료: 경남 94 · 부산 100건 …"}
  ],
  "meta": [{"label": "보존", "value": "최근 60회"}, {"label": "원본", "value": "collector/logs/scheduled_*.log"}]
}
```

- 정렬: run_at 내림차순, 같은 실행 안에서는 실행 순서.
- 대시보드는 마지막 run_at의 줄을 «출처별 최근 실행» 표로, 출처별 최근 10회 found를 작은 막대로 보여 준다.

## collector_alerts (R1)

```json
{
  "rows": [
    {"rule": "zero_found", "target": "KOPIS", "level": "bad",
     "text": "KOPIS 발견 0건이 2회 연속입니다 (11/25 15:00부터)",
     "since": "2026-11-25T15:00:03+09:00", "resolved_at": null}
  ],
  "meta": [{"label": "규칙", "value": "collector/rules/alerts.json"}]
}
```

- 대시보드 «살펴볼 것»에 `resolved_at == null`인 줄을 위에 둔다. 최근 7일 안에 풀린 것은 접힌 목록으로.
- `text`는 데이터다. 화면은 글자로만 그린다(HTML로 넣지 않는다).
