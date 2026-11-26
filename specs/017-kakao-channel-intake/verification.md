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

## 2026-11-26 — 끝 조건: 운영자 휴대폰·PC → 채널 → 검토함 (T012)

- 처음엔 휴대폰에서 «찾을 수 없는 채널»: 채널이 비공개였다(파트너센터 대시보드 «공개 설정하기·검색 허용하기·채팅 사용하기» 미완). 운영자가 직접 설정 → 대시보드 «채팅 상담중 09:00~18:00».
- 오픈빌더 스킬 헤더 값: 운영자 입력(43자 확인, 값은 읽지 않음) → «스킬서버로 전송» 시험에 피카 서버가 동의 안내로 응답 → 봇 v1.0 전체 배포(17:25), 봇 상태 «실행», 운영 채널 «피카».
- 운영자 시험 결과(DB, 보낸 사람 구분값 `cc440f3c…`, 동의 08:34:56 UTC):
  - 08:36:39 «사진 보내기»(보안 이미지 플러그인)로 보낸 사진 → 제출 `715618ef…`, 버킷 `leaflets/kakao/715618ef….jpg` 2,668,412바이트 → 예약작업 순서로 읽기(«칸 3/10», 날짜는 인쇄돼 있지 않아 비움) → **운영 /admin/leaflets 에 «카카오 챗봇» 꼬리표와 함께 사진·제목·지역(부산)·단체 이름이 채워진 초안** — `captures/admin_kakao_phone_photo_2026-11-26.jpg`. **끝 조건 충족.**
  - 08:35:40 PC에서 채팅창에 붙여 넣은 사진 → 폴백 블록에 **발화로 사진 주소**(`https://talk.kakaocdn.net/dna/…`)가 왔다(공식 문서에 없던 길). 그때 코드는 글로 저장(제출 `1f0094b5…`, «글로 받았어요» 답). 같은 주소를 15분 뒤 내려받아도 200 image/png 7,514,338바이트.
- 운영자 의견(원문): «pc에서 복붙으로 이미지를 보냈는데. 이미지가 아니고 텍스트라고 하고, 첨부 기능으로 사진을 보냈는데, 보낸 사진이 표시가 되지는 않네. 그냥 일반 채팅하듯이 보내면 좋겠는데»
  → 보완: 발화가 카카오 사진 주소뿐이면 사진으로 받는다, 안내 글은 «이 채팅창에 그냥 보내 주세요»(사진 보내기 버튼 안내 뺌), 저장 전 긴 변 2048px JPEG(sharp, EXIF 지움 — 없으면 원본). `check_kakao_skill.js`에 그냥 보낸 사진 1·2장, 글 섞임, 카카오 밖 주소 시험 추가 → 통과, tsc·eslint 통과. 배포 뒤 운영자 재시험 필요.

### 남은 시험 데이터 (T012 뒤 함께 지움)
- `leaflet_submissions` id `1909afdf-0219-4217-95ba-bf7eb7023e6c`(사진, 버킷 `leaflets/kakao/1909afdf-….jpg`), `fa7fe9a8-1d88-4a42-b6e9-ac02c2816585`(글) — 둘 다 «[시험]» 글, 관리자 화면에서 «등록»하지 말 것.
- `leaflet_submissions` 시험 사용자 pica-test-de62515c972e 의 글 1건(배포 확인용).
- `leaflet_submissions` 운영자 시험 2건 `715618ef…`(사진, 버킷 파일), `1f0094b5…`(주소 글) — 실제 행사 배너(«2026 동남권 모두의 창업 페스타») 사진, 등록하지 않음.
- `kakao_senders` 시험 사용자 3줄 + 운영자 1줄(운영자 줄은 남겨도 됨 — 다시 보낼 때 동의 생략).

## 2026-11-26 — 보완 배포 뒤 재시험: 채팅창에 그냥 보낸 사진 (T012b)

- 보완 배포: «피카 앱 개선» 세션, `main` a56e82c(코드)·26415f9(문서).
- 운영 주소 흉내 요청(운영자가 PC에서 보낸 사진 주소 그대로 발화로): 동의 전 사진 → 동의 안내(저장 안 함) · 동의 → «…이 채팅창에 보내 주세요» · 같은 사진 → «사진 1장 받았어요» → 제출 `991ff5bb…`, 버킷 파일 391,957바이트 image/jpeg(원본 PNG 7,514,338바이트 → 2048px JPEG). 운영(Vercel)에서도 sharp 줄이기가 동작.
- **운영자 휴대폰 재시험**(채팅창에 사진을 그냥 한 장, 이미 동의한 사용자 `cc440f3c…`): 09:55:37 UTC 제출 `647baebf…` → 2초 뒤 버킷 `leaflets/kakao/647baebf….jpg` 463,473바이트, 1448×2048 JPEG, EXIF 0개 → 예약작업 순서로 읽기(«칸 7/10», 날짜 2025-03-19) → **운영 /admin/leaflets 맨 위에 «읽음 · 카카오 챗봇 · 휴대폰 사진(포스터로 안 씀)» 초안**(제목·지역 김해·장소·날짜·단체 이름 채워짐) — `captures/admin_kakao_chat_photo_2026-11-26.jpg`. **끝 조건 2 충족(그냥 보낸 사진 길).**
- 시험 사진은 지난 행사(2025-03-19 «김해시 유관기관 통합설명회») 포스터 — 등록하지 않음.

### 시험 데이터 삭제 (서비스 키, 11/26 19시쯤)
- `leaflet_submissions` channel=kakao_bot **7줄 전부** 삭제(모두 uploaded·read, 공개된 것 없음): `1909afdf` `fa7fe9a8` `5cda118b` `1f0094b5` `715618ef` `991ff5bb` `647baebf`.
- 버킷 `leaflets/kakao/` 파일 4개 삭제(1909afdf·715618ef·991ff5bb·647baebf) → 목록 비어 있음.
- `kakao_senders` 시험 사용자 4줄 삭제, 운영자 줄 `cc440f3c…` 하나만 남김(다음에 보낼 때 동의 생략).
- 운영자 PC `collector/.cache/leaflets/` 에 남은 시험 이미지·조각·JSON도 지움.

## 2026-11-26 — 제보는 «행사 알리기» 메뉴로만, 일반 문의는 운영자 상담 연결 (T014)

- 운영자(원문): «그런데 카카오톡 문의오는게 예술단체 제보만 있는게 아닌데, 일반 사용자들도 있잖아.» «제보는 메뉴형태로 들어오도록 해야되지 않겠어»
- 근거(공식 문서, 11/26): 스킬 응답 버튼 action `operator` = "상담 연결 기능을 제공합니다"(answer_json_format.md, textCard·basicCard 버튼, 바로가기 응답 quickReplies 에는 없음). 상담 연결은 "채널관리자센터의 1:1 채팅 혹은 상담톡 기능을 사용할 경우" 가능(main_notions/plugin.md). 피카 채널은 1:1 채팅이 켜져 있다(대시보드 «채팅 상담중 09:00~18:00»). 상담 연결 뒤 챗봇으로 돌아오는 방법·시간은 문서에 없음 → 운영자 휴대폰 시험으로 확인.
- 바뀐 흐름: 웰컴·제보 시간 밖의 글·사진 → **저장하지 않고** 카드 «운영자에게 문의»(operator) · «행사 알리기». «행사 알리기» → 동의 전이면 동의 안내, 동의했으면 30분 제보 시간(`kakao_senders.tip_until`). 동의·제보 저장 때마다 30분 연장. 보안 이미지 플러그인 블록(«사진 보내기»)으로 온 사진은 그 자체가 제보 뜻이라 제보 시간을 연다.
- 운영 DB: `20261127080000_kakao_tip_menu.sql` SQL 편집기로 적용(«Success. No rows returned»). 익명 키 + 스킬 비밀값으로 시험(시험 사용자, 끝난 뒤 줄 삭제 확인):
```
동의 전 글: not_agreed (저장 안 함)     동의 전 start: ok, agreed=false
동의: ok                                 제보 시간 안 글: ok → 제출 1건
제보 시간 지난 글: not_tip (저장 안 함)  다시 start → 사진: ok → 제출 1건(image_path)
틀린 비밀값: auth
```
- 코드: `kakaoSkill.ts`(TIP_TEXT «행사 알리기», MSG.welcome·notTip textCard), `route.ts`, `/partners` «카카오톡으로 보내기» 상자(«지금», 채팅방 링크 pf.kakao.com/_xoxdxkvX/chat). tsc·eslint·`check_kakao_skill.js` 통과. 커밋 3465208 → 배포 요청.
- 남음: 배포 → 운영 주소 흉내 요청 → 운영자 휴대폰(문의 글 → 카드 → «운영자에게 문의» 연결, «행사 알리기» → 사진) → 채팅방 메뉴(커스텀 메뉴)에 «행사 알리기» 넣기.
