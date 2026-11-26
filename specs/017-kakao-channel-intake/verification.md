# 017 확인 기록

## 2026-11-26 — DB·검토함 (배포 전)

### 운영 DB (bebnijyqhzcftvlueeyn, MAX Chrome SQL 편집기)
- `20261127070000_kakao_channel_intake.sql` 본문 + 스킬 비밀값 해시 1줄 → «Success. No rows returned».
- 보완(sender_key NULL 허용 CHECK) → 적용, 같은 실행의 집계 `kakao_bot | read | 2 | with_key 2`.

### 익명(anon) 키 시험 — 시험 사용자 `pica-test-…`
```
wrong secret: {"ok": false, "error": "auth"}
status before agree: {"ok": true, "agreed": false}
image before agree: {"ok": false, "error": "not_agreed", "agreed": false}
agree: {"ok": true, "agreed": true}
status after agree: {"ok": true, "agreed": true}
image: {"id": "1909afdf-…", "ok": true, "image_path": "kakao/1909afdf-….jpg"}
anon upload own path: 200
anon upload same path again: 400 (409 Duplicate — 덮어쓰기 안 됨)
anon upload random kakao path: 400 (403 row-level security)
anon upload other folder: 400 (403 row-level security)
text attaches: {"attached": true}   ← 10분 안 글이 사진 제출의 «더 알려 준 것»에 붙음
anon read leaflet_submissions / kakao_senders / kakao_skill_keys: 200 []
upload_failed wrong secret: false
anon list kakao folder: []
```

### 예약작업 순서(013 `leaflet_read.md`)로 읽기
- `leaflet_queue.py --pending`(이 브랜치 코드, 운영 DB) → 대기 1건 `source=image, channel=kakao_bot`, 확대 조각 2장 → 이미지를 읽어 JSON → `--save` → «칸 7/10 · 날짜 2026-12-20~2026-12-20 · status=read».
- 글만 보낸 시험 사용자 → `--pending` 이 `source=text`, `file=null`, `text=보낸 글`로 넘김 → `--save` → «칸 7/10 · 날짜 2026-12-20~2026-12-20 · status=read».
- `--cleanup`(dry-run) → «… 카카오 구분값 동의 0·제출 0», 오류 없음.

### 검토함
- 지금 배포된 https://picka.news/admin/leaflets (MAX, 관리자 로그인)에 두 건이 «읽음»으로 뜨고 제목 «겨울 손님»·지역 김해·날짜 2026-12-20·장소·관람료·무료가 미리 채워짐 — `captures/admin_leaflets_drafts_2026-11-26.jpg`.
  (배포 전 화면이라 «카카오 챗봇» 꼬리표·단체 이름 칸은 아직 없다. 이 브랜치 화면은 배포 뒤 확인)

### 코드
- `npx tsc --noEmit` 통과(frontend).
- `node ../specs/017-kakao-channel-intake/check_kakao_skill.js <임시 폴더>` → «kakaoSkill tests passed» (보안 이미지 1장·2장, 동의 N, 카카오 밖 주소 버림, 동의·웰컴·글, 틀린 요청 null, 답 모양·1000자).
- `pytest tests/test_leaflet_queue.py` → 101 passed(글만 온 제출, 카카오 구분값 1년 정리 포함).

### 못 한 것
- 스킬 서버(`/api/kakao/skill`)를 실제로 띄워 부르기: 로컬 서버는 운영자 승인 없이 띄우지 않는다(메모리 규칙), 배포는 이 세션이 하지 않는다 → 배포 뒤 T010.
- 채널에서 실제로 사진 보내기(끝 조건 2): 배포·채널 연결 뒤 T012.

### 남은 시험 데이터 (T012 뒤 함께 지움)
- `leaflet_submissions` id `1909afdf-0219-4217-95ba-bf7eb7023e6c`(사진, 버킷 `leaflets/kakao/1909afdf-….jpg`), `fa7fe9a8-1d88-4a42-b6e9-ac02c2816585`(글) — 둘 다 «[시험]» 글, 관리자 화면에서 «등록»하지 말 것.
- `kakao_senders` 시험 사용자 2줄.
