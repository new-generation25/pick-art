# Contract: REVIEW 정리 도구 (collector/tools/triage_review.py)

```text
python tools/triage_review.py --dry-run          # 바꾸지 않고 표만
python tools/triage_review.py --apply            # 적용 (첫 적용은 운영자가 dry-run 표를 승인한 뒤)
```

## 입력

`raw_posts`에서 `status='REVIEW'` 전부(1,000건씩 읽기). 쓰는 칸: `content.ai_suggestion.{date_start, date_end, role, venue, region, image_only}`, `content.title`.

## 규칙 (위에서부터 처음 맞는 것)

| 순서 | 조건 | 결과 | review_reason |
|---|---|---|---|
| 1 | 끝나는 날(없으면 시작일)이 있고 오늘(KST)보다 앞 | status `EXPIRED` | `ended` |
| 2 | 공개된 행사와 같음(시작일 같고 제목 한쪽이 다른 쪽을 포함 — `review_instagram.py`의 기존 판정 재사용) | status `DUPLICATE` | `published_same` |
| 3 | role `artist`·`group` | bucket `consent` | `small_needs_consent` |
| 4 | role `official` + 날짜 있음 + 장소 있음 | bucket `candidate` | `official_complete` |
| 5 | 그 밖(제보 계정, 날짜 없음, 포스터만) | bucket `human` | `informant` · `no_date` · `image_only` |

- 이미 bucket이 있는 REVIEW는 규칙 1·2만 다시 본다(끝났거나 공개된 것 정리). bucket은 사람이 바꾼 것을 덮어쓰지 않는다.
- 지우지 않는다. 상태와 `content` 키만 바꾼다.

## 출력

- 표준 출력 마지막 줄(정기 실행 보고용): `✅ REVIEW 정리: 만료 556 · 중복 n · 동의 필요 n · 공개 후보 n · 사람 판단 n (남은 REVIEW n)`
- dry-run은 `collector/logs/triage/triage_<날짜>.json`에 줄마다 `{id, title, rule, result}`를 남긴다(운영자 확인용).

## 정기 실행 연결

인스타 수집(`collect_instagram.py`) 다음에 `--apply`. 실패해도 루틴은 계속한다(다른 도구와 같은 `run_tool` 방식).
