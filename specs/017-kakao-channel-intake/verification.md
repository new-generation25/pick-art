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

## 2026-11-26 — 배포 뒤 운영 주소 (T010) · 오픈빌더 설정 (T011 일부)

- 운영자 승인 «둘 다 진행»(배포 요청 + 카카오 챗봇 연결) → «피카 앱 개선» 세션이 배포: `origin/main` 735c0be(코드)·3a76256(문서).
- `POST https://picka.news/api/kakao/skill` 흉내 요청(운영자 PC에서, 비밀값은 `.env.local`에서 읽고 출력 안 함):
```
헤더 없음: 403 · 틀린 비밀값: 403
웰컴(동의 전): 200 소개 + 권리 확인 두 문장, 버튼 «동의하고 보내기»
글(동의 전): 200 같은 동의 안내 (저장 안 함)
동의: 200 «동의해 주셔서 고맙습니다…», 버튼 «사진 보내기»
웰컴(동의 뒤): 200 사진 보내기 안내
카카오 밖 사진 주소: 200 «사진을 받지 못했어요…» (내려받지 않음)
글(동의 뒤): 200 «글로 받았어요…» → 제출 1건(시험 사용자 pica-test-de62515c972e)
```
- 오픈빌더 봇 «피카 행사 제보»(6b07e404e3146b3ebc754f8b):
  - 스킬 «피카 제보 서버» = `https://picka.news/api/kakao/skill`, 기본 스킬, 헤더 키 `x-pica-skill-key` (값은 운영자 입력 ✋ — 비어 있음)
  - 블록: 웰컴(켬, 스킬데이터) · 폴백(스킬데이터) · «제보 동의»(발화 `동의하고 보내기`, 스킬데이터) · «사진 보내기»(발화 `사진 보내기`·`리플렛 보내기`·`포스터 보내기`, 필수 파라미터 `secureimage` = `sys.plugin.secureimage`, 되묻기 «리플렛·포스터 사진을 보내 주세요(한 번에 10장까지)…», 버튼 «사진 고르기», 개인정보 수집 항목: 피카(picka.news) · 행사 리플렛·포스터 이미지 · 행사 정보 확인과 피카 게재 검토 · 받은 날부터 1년, 스킬데이터)
  - 설정 › 운영 채널 = **피카(@pickanews) 연결됨**(기본 채널, 거절 없음), 봇 카테고리 문화/엔터테인먼트 > 공연/전시/축제. 저장 때 뜬 «배포를 진행하시겠습니까?»는 헤더 값이 들어간 뒤 하려고 취소.
- 아직: 운영자 헤더 값 입력 → 봇 배포(최대 30분) → 휴대폰으로 사진 한 장(카카오 사진 주소 내려받기·익명 업로드는 이 시험으로만 확인 가능).

### 남은 시험 데이터 (T012 뒤 함께 지움)
- `leaflet_submissions` id `1909afdf-0219-4217-95ba-bf7eb7023e6c`(사진, 버킷 `leaflets/kakao/1909afdf-….jpg`), `fa7fe9a8-1d88-4a42-b6e9-ac02c2816585`(글) — 둘 다 «[시험]» 글, 관리자 화면에서 «등록»하지 말 것.
- `leaflet_submissions` 시험 사용자 pica-test-de62515c972e 의 글 1건(배포 확인용).
- `kakao_senders` 시험 사용자 3줄.
