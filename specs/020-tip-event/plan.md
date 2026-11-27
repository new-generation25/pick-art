# 020 계획 — 숨은 행사 제보

명세: [spec.md](spec.md) · 작성 2026-11-27 · 근거: [docs/PLAN_community_2026-11.md](../../docs/PLAN_community_2026-11.md) 12-1절(운영자 결정)

## 요약

`/tip`의 로그인 문턱을 없애고 칸을 «행사 이름 + 링크나 사진 하나»로 줄인다. 공개 화면 꼬리말 위에 제보 띠(버튼 2개)를 둔다.
쿠폰 연락처는 선택 + 동의로 받고 관리자만 본다. 공개 전 확인(헌장 I)은 지금의 «신고·제보 → 행사로 등록» 흐름을 그대로 쓴다.

## 헌장 점검

| 원칙 | 이 기능에서 |
|---|---|
| I. 확인한 정보만 공개 | 제보는 `reports`에 «검토 대기»로만 쌓인다. 공개는 관리자가 원문을 확인해 «행사로 등록»할 때만 |
| II. 작은 무대를 같은 무게로 | 화면 문구는 BRAND_GUIDE 7절(해요체·숫자 먼저·쓰지 않는 말), 색은 확정 화면 팔레트 변수만 |
| III. 보안과 비밀값 | 익명은 표에 직접 넣지 못하고 `submit_tip()` 함수로만 넣는다. 연락처·사진은 관리자만 읽는다. 접속 주소(IP) 저장 안 함 |
| IV. AI 최소 개입 수집 | 제보 사진은 AI로 읽지 않는다(관리자가 직접 본다) |
| V. 끝 조건 먼저 | 아래 «확인 방법» 6개가 통과하면 끝 |

## 기술 맥락

- 프런트: Next.js 16(App Router) · Tailwind 4 종이 테마 변수 · 관리자 화면은 Mantine 8
- DB: Supabase(운영 프로젝트). 마이그레이션 `supabase/migrations/20261127130000_tip_event.sql`
- 저장소: 비공개 버킷 `leaflets`(10MB, jpeg·png·webp)의 `tips/` 폴더
- 정리 작업: `collector/tools/leaflet_queue.py --cleanup`(리플렛 읽기 예약 작업이 매번 부름)

## 데이터

### `reports` (specs/007 표를 넓힘)

| 칸 | 바뀌는 것 |
|---|---|
| `user_id` | NULL 허용(로그인 없는 제보). 오류 신고(kind=error)는 여전히 회원만 — CHECK `user_id IS NOT NULL OR kind = 'tip'` |
| `tip` (jsonb) | `title` 필수, `url` 또는 `photo: true` 가운데 하나 필수. `date_start`·`date_end`·`venue`·`region`은 있을 때만 |
| `photo_path` 새 칸 | `tips/<제보 id>.jpg`. 1년 뒤 정리 작업이 파일을 지우고 비운다 |
| `credit_name` 새 칸 | «제보: ○○»에 쓸 이름(1~30자). 적지 않으면 NULL |
| `reward_contact` 새 칸 | 쿠폰 연락처(5~100자). 있으면 `reward_consent`(동의 문구 판)도 있어야 한다(CHECK) |
| `reward_consent` 새 칸 | 동의한 문구 판. 지금 판 `tip-reward-r1-2026-11-27` |
| `reward_sent_at` 새 칸 | 관리자가 «쿠폰 보냄 · 연락처 지우기»를 누른 때 |

읽기 권한은 그대로다: 회원은 자기 것, 관리자는 전부, 익명은 0줄. 익명 제보(user_id NULL)는 관리자만 읽는다.
회원이 표에 직접 넣는 정책(오류 신고가 씀)은 새 칸 5개가 모두 비어 있어야 통과하게 좁힌다.

### `events.tip_credit` 새 칸

제보로 등록한 행사에 옮겨 적는 표시 이름(1~30자, 공개). 관리자가 «새 행사»에서 켜 둔 채 저장할 때만 들어간다.

### 함수·정책

- `submit_tip(p jsonb) → {id, photo_path}`: 유일한 접수 입구(anon·authenticated). 검사 순서 — 보이지 않는 칸(`website`)이 차 있으면 넣지 않고 성공처럼 답함 → 이름 2~120자 → 링크 형식 → 링크나 사진 하나 → 날짜 형식 → 연락처 있으면 동의 판 → 한도(익명: 사이트 전체 하루 40건 / 회원: 하루 10건) → 같은 이름·같은 링크 하루 한 번. 오류는 `bad_title`·`bad_url`·`need_source`·`bad_date`·`need_consent`·`site_limit`·`daily_limit`·`duplicate`
- `tip_upload_allowed(name)` + 저장소 정책 «Tip upload pending photo»: `tips/<id>.jpg`는 그 경로를 가리키는 제보가 10분 안에 만들어졌고 «검토 대기»일 때만 한 번 넣을 수 있다(덮어쓰기 없음). specs/017 `kakao_upload_allowed`와 같은 방식
- `tip_photo_failed(id)`: 사진 올리기가 실패했을 때 브라우저가 부른다. 10분 안의 제보이고 파일이 실제로 없을 때만 `photo_path`를 비우고 관리자 메모에 «사진 올리기 실패»를 남긴다
- `storage_usage()`: `reports.photo_path`를 «쓰는 파일»로 센다(저장공간 화면의 «안 쓰는 이미지»에 잡히지 않게)

### 주간 집계 (수집 쪽이 읽는 칸)

- 제보 ↔ 행사: `reports.event_id`(«행사로 등록»할 때 들어감), 처리 시각 `reports.handled_at`, 반영 여부 `reports.status = 'done'`
- 한 곳에서 세기: 보기 `public.tip_entries` — `channel`(site·kakao_bot·kakao_chat) · `entry_id` · `created_at` · `done` · `event_id` · `handled_at` · `title` · `url` · `member` · `has_contact` · `reward_sent_at` · `credit_name`. service_role 만 읽는다
- 카카오톡 채널 제보는 specs/017 흐름(`leaflet_submissions`, 권리 확인·글자 읽기)을 그대로 쓴다. 연락처를 받지 않으므로 쿠폰은 채널 1:1 채팅으로만 건넬 수 있다
- 동의 시각 칸은 따로 없다: 동의는 제보를 보낼 때 함께 받으므로 `reports.created_at`이 동의한 때이고, 문구 판은 `reward_consent`에 남는다(연락처를 지워도 남음)

### 보관·파기

| 무엇 | 언제 지우나 | 누가 |
|---|---|---|
| 쿠폰 연락처 | 쿠폰을 보낸 뒤 | 관리자 «쿠폰 보냄 · 연락처 지우기» |
| 쿠폰 연락처(보내지 않은 것) | 제보한 날부터 90일 | 정리 작업 + 관리자 «신고·제보» 화면을 열 때 |
| 제보 사진 | 올린 날부터 1년(리플렛과 같음) | 정리 작업 |
| 제보 글(이름·링크·날짜·장소) | 회원은 탈퇴 때 함께, 익명 제보는 개인정보가 없어 행사 기록과 함께 둠 | — |

## 화면

| 자리 | 파일 | 바뀌는 것 |
|---|---|---|
| 제보 화면 | `frontend/src/app/tip/page.tsx`, `TipForm.tsx` | 로그인 문턱 삭제. 칸: 행사 이름 · 원문 링크 · 사진 한 장 / 접은 칸 «더 알려 주기»(날짜·장소·지역·글) / «커피 쿠폰 받기»(연락처+동의) / «제보: ○○»(이름). 맨 위에 이벤트 한 줄, 아래에 카카오톡 안내 |
| 검사·문구 | `frontend/src/lib/reports.ts` | `TipInput`·`checkTip(t, hasPhoto)`·`tipErrorText(code)`·동의 문구와 판·카카오 채널 주소 |
| 제보 띠 | `frontend/src/components/ui/TipBand.tsx`, `MainLayout.tsx` | 꼬리말 위 띠. `/tip`·`/login`·`/signup`·`/welcome`·`/auth`에서는 숨김(관리자 화면은 MainLayout이 이미 제외) |
| 관리자 제보 | `frontend/src/app/admin/reports/page.tsx` | 보낸 사람(회원/로그인 없이), 사진 보기(10분짜리 주소), 표시 이름, 연락처와 «쿠폰 보냄 · 연락처 지우기», 갈래 «쿠폰 대상», 이번 주 한 줄 요약, 90일 지난 연락처 자동 정리 |
| 새 행사 | `frontend/src/app/admin/events/new/page.tsx` | 제보에서 넘어왔고 표시 이름이 있으면 «행사 화면에 제보: ○○ 보이기»(켜짐) → `events.tip_credit` |
| 행사 상세 | `frontend/src/app/events/[id]/page.tsx` | `tip_credit`이 있으면 정보 줄에 «제보» 한 줄 |
| 처리방침 | `frontend/src/app/privacy/page.tsx` | 처리 항목(로그인 없는 제보·사진·쿠폰 연락처), 보유 기간, 변경 고지 |
| 정리 작업 | `collector/tools/leaflet_queue.py`, `tests/test_leaflet_queue.py` | 90일 지난 쿠폰 연락처 비우기, 1년 지난 제보 사진 지우기 |

### 문구(브랜드 가이드 7절)

- 띠 제목 «피카에 없는 행사, 알려 주세요» / 본문 «매주 5명께 커피 쿠폰을 드려요. 행사 이름과 링크(또는 사진) 하나면 돼요.»
- 버튼 «행사 제보하기» / «카카오톡으로 보내기»
- 제보 화면 이벤트 줄 «매주 5명께 커피 쿠폰을 드려요. 그 주에 확인해서 피카에 실린 제보 가운데 골라요.»
- 쓰지 않는 말(역대급·다양한·풍성한·특별한 경험 등) 없음. 지역 이름을 앞세우지 않음(가이드 1절)

## 배포 순서

1. 운영 DB에 마이그레이션 적용(MAX 브라우저 SQL 편집기) — 옛 화면과도 호환된다(옛 `/tip`은 회원 직접 넣기, 새 정책·CHECK를 통과)
2. main 배포(운영자 «배포해» 뒤)
3. 운영 주소에서 «확인 방법» 다시

되돌리기는 마이그레이션 머리말에 적는다.

## 확인 방법

1. SQL: 운영 DB에서 한 문장(DO 블록) 안에 마이그레이션 적용 → 접수 함수 시험 → 끝에서 오류를 내어 전부 되돌리기(익명 역할로 넣기·한도·중복·동의 없는 연락처·익명 읽기 0줄) — 남는 변경 없음
2. 로컬 빌드(`next build --webpack`) + `tsc --noEmit`
3. 로컬 화면: 로그인하지 않은 브라우저에서 `/tip` 검사 문구(이름만 → 링크나 사진 필요, 연락처+동의 없음 → 동의 필요)
4. 폭 375px에서 홈·행사 상세·`/tip`의 가로 넘침 0, 띠가 `/tip`·`/login`에 없음
5. 수집기 테스트(`pytest collector/tests`) 통과
6. 배포 뒤: 운영 주소에서 실제 제보 1건(링크) + 1건(사진+연락처) → 관리자 화면에서 보임 → 연락처 지우기 → 시험 제보는 «반영 안 함»으로 닫음
