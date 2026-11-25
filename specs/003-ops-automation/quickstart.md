# Quickstart: 운영 자동화 검증

## 준비

- 수집기: `collector/` 에서 실행. 비밀값은 `.env.local`(값을 출력하지 않는다).
- 화면: 빌드 후 `.claude/launch.json`의 `pick-art-frontend-prod-3000`(힙 1.5GB)을 `preview_start`로. 관리자 로그인은 Chrome **pica 프로필(pick.art.pica@gmail.com, deviceId 03e1d81e)**에서 `http://localhost:3000/login` → 구글로 계속하기 → 계정 고르기(비밀번호 입력 없음). socialceos 계정은 role=user라 `/admin`이 홈으로 넘어간다.
- 확인 뒤 서버를 끄고 탭을 닫는다.

## 0. 이미 된 것 다시 확인

```powershell
python tools/publish_ops_snapshots.py --no-build
```
기대: `✅ 운영 스냅숏 4개 올림 (metrics …줄, daily …, runs …, stats …)`. 익명 키로 `/rest/v1/ops_snapshots` 조회 → `[]`.

## 1. R0 마무리 (11/26 08:20 이후)

`collector/logs/scheduled_20261126_0820.log` 끝 보고에서:
- `KOPIS: ✅ … 경남 n · 부산 n` (n ≥ 1)
- `인스타 기록 백업: ✅`
- `대시보드 스냅숏: ✅ 운영 스냅숏 4개 올림`

## 2. 대시보드 배포 (main 병합 승인 뒤)

https://pick-art.vercel.app/admin 을 관리자로 열어 «활성 행사»와 «인스타 수집분 검토»가 같은 시각 DB 조회(`events` 활성, `raw_posts` REVIEW 수)와 같으면 통과.

## 3. R1 실행 기록·경고

```powershell
python -m pytest tests/test_ops_log.py
$env:OPS_TEST_FAIL = "KOPIS"; python -c "import ops_log; ops_log.selftest(2)"   # 기록·판정 단계만 2회 흉내
Remove-Item Env:OPS_TEST_FAIL; python -c "import ops_log; ops_log.selftest(1)"
```
기대:
- 2회째에 `collector_alerts`에 `zero_found/KOPIS`가 켜진다(`resolved_at: null`).
- 해제 1회 뒤 그 경고의 `resolved_at`이 채워진다.
- 텔레그램은 켜짐 1통, 풀림 1통이다.
- 이 시험은 수집·공개를 하지 않는다(`events`·`raw_posts` 건수 변화 0).

정기 실행 1회 뒤 확인:
- `collector_runs`에서 마지막 run_at의 줄 수 = 그 실행 보고의 «출처 n곳 처리».
- 대시보드 «출처별 최근 실행» 표가 같다.

## 4. R2 REVIEW 정리

```powershell
python tools/triage_review.py --dry-run
```
기대(11/25 기준 대략): 만료 약 556 · 중복 n · 동의 필요 27 이하(artist 19 + group 8 중 안 끝난 것) · 공개 후보 n · 사람 판단 n. 이 표를 운영자에게 보이고 승인받는다.

```powershell
python tools/triage_review.py --apply
```
이어서 확인한다:
- `review_bucket` 없는 REVIEW가 0이다.
- 무작위 20건을 열어 잘못 분류 0이다.
- 인박스 «공개 후보» 1건을 승인하면, 다음 정기 실행 뒤 공개 피드에 보인다.

## 5. R4·R5 정리

- 이동 전후 정기 실행의 출처별 `found`가 같다(`collector_runs`로 비교).
- `npm run build`가 통과한다.
- 관리자 메뉴의 모든 페이지가 열린다.
- `git log --diff-filter=D` 에 이번 정리로 지운 파일이 0개다.
