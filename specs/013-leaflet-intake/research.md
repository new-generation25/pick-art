# Research: 리플렛 한 장으로 행사 등록 (013)

작성 2026-11-26. 명세 [spec.md](spec.md)의 근거. 코드·설정은 이 날짜에 저장소에서 읽은 것, 단가는 이 날짜에 공급자 문서에서 읽은 것이다. 확인하지 못한 것은 «확인 안 함»으로 적었다.

## R1. 지금 AI를 어떻게 쓰고 있나

- `collector/ai_extractor.py`: `AIExtractor.__init__`이 첫 줄에서 `self.enabled = False`로 두고 `"⚠️ AI extraction temporarily disabled due to cost concerns."`를 출력한 뒤 바로 돌아온다. 그 아래(실행되지 않는 코드)는 `GEMINI_API_KEY` 또는 `NEXT_PUBLIC_GEMINI_API_KEY`로 `google.generativeai`를 설정하고 모델 `gemini-2.5-flash`를 쓴다. 이미지 URL을 받아 함께 보내는 경로도 있다(`extract_metadata(text, image_urls)`).
- `collector/requirements.txt`: `google-generativeai>=0.3.0`, `pillow>=10.1.0`.
- 프론트: AI SDK를 쓰는 코드 없음. `frontend/src/app/admin/ai-prompt/page.tsx`는 Gemini 지시문(`configs.ai_prompt`)을 고치는 화면일 뿐 AI를 부르지 않는다.
- 결론: 지금 운영 경로에서 AI는 꺼져 있다. 이 기능은 **새 경로·새 상한**으로 켜야 하고, 기존 추출기를 켜는 것과 섞지 않는다.

### 키·공급자 (이름만, 값은 읽지 않음)

| 파일 | 변수 이름 (값이 비어 있지 않음) |
|---|---|
| `collector/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `NEXT_PUBLIC_GEMINI_API_KEY`, `GEMINI_API_KEY`, `INSTAGRAM_USERNAME`, `INSTAGRAM_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `KOPIS_API_KEY` |
| `frontend/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_NAVER_MAP_KEY_ID` |

- AI 공급자는 Gemini 하나. OpenAI·Anthropic 키 없음.
- 프론트(로컬)에는 AI 키가 없다. Vercel 환경 변수에 AI 키가 있는지는 **확인 안 함**.
- 그 Gemini 키가 무료 등급인지 유료 등급인지 **확인 안 함**(R2의 데이터 사용 조건 때문에 중요).
- 알릴 것(고치지 않음): 수집기 `.env.local`에 `NEXT_PUBLIC_GEMINI_API_KEY`라는 이름이 있다. 수집기(파이썬)에서는 노출되지 않지만, 같은 이름을 프론트 환경 변수로 옮기면 Next.js가 브라우저 묶음에 싣는다. 이 기능은 서버 전용 이름만 쓴다(spec FR-016).

## R2. 비용 — 한 장당 추정 (모델은 운영자가 고름)

### 단가 (Google AI Studio 가격 문서, 2026-11-26 읽음, 유료 등급 Standard, 100만 토큰당 USD)

| 모델 | 입력(글·이미지) | 출력(생각 토큰 포함) | 무료 등급 입력의 제품 개선 사용 |
|---|---|---|---|
| Gemini 2.5 Flash | 0.30 | 2.50 | 무료: 사용 / 유료: 사용 안 함 |
| Gemini 2.5 Flash-Lite | 0.10 | 0.40 | 같음 |
| Gemini 3.5 Flash-Lite | 0.30 | 2.50 | 같음 |
| Gemini 3.8 Flash | 0.75 (2027-01-01부터 1.50) | 3.75 (2027-01-01부터 7.50) | 같음 |

- 같은 문서: **Gemini 2.5 Flash는 지원 종료 예정이며 2026-12-01부터 요청이 Gemini 3.5 Flash-Lite로 넘어가 그 단가로 청구된다.** 기존 추출기의 모델 이름(`gemini-2.5-flash`)을 그대로 쓰면 12월부터 다른 모델이 답한다.
- 무료 등급은 입력을 제품 개선에 쓴다고 적혀 있다 → 리플렛(개인 연락처 가능)에는 유료 등급만(spec FR-017).

### 이미지 토큰 (Gemini 이미지 이해 문서, 2026-11-26 읽음)

- 두 변이 모두 384px 이하면 258토큰. 더 크면 768×768 조각으로 나눠 조각마다 258토큰. 조각 수 계산 예: 960×540 → 6조각.
- 요청 한 번의 인라인 크기 상한 20MB(글·지시문 포함). 형식 PNG·JPEG·WEBP·HEIC·HEIF.
- Gemini 3 계열의 `media_resolution`별 토큰 수는 그 문서에 숫자가 없었다 → 3.x 모델은 아래 추정이 다를 수 있다. 시험(SC-005)에서 실제 값을 잰다.

### 추정 (가정: 긴 변 2048px로 줄인 A판 비율 이미지 = 6조각 ≈ 1,550토큰 + 지시문 ≈ 750토큰 → 입력 ≈ 2,300토큰. 출력 JSON 11칸 ≈ 500토큰, 생각 토큰이 붙으면 ≈ 2,500토큰. 환율 1달러 = 1,400원으로 가정)

| 모델 | 출력 500토큰 | 출력 2,500토큰 |
|---|---|---|
| Gemini 3.5 Flash-Lite | 약 0.0019달러 ≈ 3원 | 약 0.0069달러 ≈ 10원 |
| Gemini 3.8 Flash (2026년 단가) | 약 0.0036달러 ≈ 5원 | 약 0.011달러 ≈ 16원 |
| Gemini 3.8 Flash (2027년 단가) | 약 0.0072달러 ≈ 10원 | 약 0.022달러 ≈ 31원 |

- 한 달 300장이면 약 900원~9,300원. 상한은 이 숫자를 보고 정한다(spec «정할 것» 1).
- 생각 토큰을 끄거나 줄이는 설정이 있으면 출력 500토큰 쪽에 가깝다 — 모델별로 계획 단계에서 확인.
- 다른 공급자(Claude·OpenAI) 단가는 이 세션에서 확인하지 않았다. 고를 때 같은 표로 다시 본다.

### AI가 아닌 대안 (헌장 IV에 더 가까움)

- **OCR + 규칙 분류**: 글자만 뽑고(OCR), 날짜·시간·요금은 정규식, 장소는 `venues` 표 이름 맞추기로 칸을 채운다. LLM이 «분류»하지 않아 지어낼 여지가 작다. 다만 리플렛은 글꼴·배치가 제각각이라 제목·장소 구분이 약하다.
  - Google Cloud Vision 글자 인식 단가: 공식 페이지를 이 세션에서 읽지 못함(**확인 안 함**). 계획 단계에서 확인.
  - PC 로컬 OCR(Tesseract 등): 비용 0, 한글 디자인 글꼴 정확도는 **시험 안 함**. PC에서만 돌아 R3의 수집기 안과 같은 제약.
- 시험 묶음(SC-001)으로 «OCR+규칙»과 «비전 LLM»을 같이 재면 고르기 쉽다.

## R3. AI를 어디서 돌리나

| | 서버 경로 (Next.js API, Vercel `icn1`) | 수집기 (운영자 PC, 파이썬) | Supabase Edge Function |
|---|---|---|---|
| 단체가 바로 확인(US2) | 된다(수 초) | 안 된다 — 04:00·18:00 루틴 또는 PC가 켜 있을 때. 단체는 알림을 받고 다시 들어와야 함 | 된다 |
| 키가 있는 곳 | Vercel 서버 환경 변수(새로 넣어야 함) | 이미 있음(`collector/.env.local`) | Supabase 비밀값(새로 넣어야 함) |
| 노출면 | 공개 서버의 API — 로그인 검사·하루 한도·월 상한을 반드시 먼저 | 밖에서 부를 수 없음 | 공개 함수 — 서버 경로와 같음 |
| 헌장 III `localOnly` | 해당 없음(파이썬·파일을 쓰지 않음). 단 `blockOnDeploy`를 붙이면 안 됨 — 배포에서 돌아야 함 | 해당 없음 | 해당 없음 |
| 비용 통제 | DB 집계(`ai_usage`)로 상한 | 루틴 안에서 장수 제한 | DB 집계 |
| 날짜 파서 | 수집기 파서를 TS로 다시 구현 또는 같은 규칙 표 공유 | 기존 파이썬 파서 그대로 | TS(Deno)로 다시 구현 |
| 새 운영 부담 | 적음(지금 스택) | 없음 | 배포 경로가 하나 늘어남 |

- 기본안: **서버 경로**. US2(단체가 그 자리에서 확인)가 헌장 I을 지키는 핵심이라서. 날짜 파서를 두 언어로 두는 부담은 «규칙 표(JSON) 하나 + 양쪽 시험 같은 예문»으로 줄인다.
- 큰 이미지는 서버를 거치지 않는다: 브라우저 → 비공개 버킷에 직접 올리고, 서버 경로는 제출 id만 받아 서비스 키로 버킷에서 읽는다. Vercel 함수의 요청 본문 한도·실행 시간 한도에 걸리지 않게 하려는 것이다(정확한 한도 숫자는 이 세션에서 확인하지 않음 — 계획 단계에서 Vercel 문서로 확인).
- 수집기 안은 «정할 것» 5에서 고를 수 있게 남긴다(비용·노출이 가장 작지만 단체 경험이 나쁨).

## R4. 표를 새로 만들까, 007 `reports`를 넓힐까

- `reports`(007)는 `body NOT NULL 2~2000자`, `kind IN ('error','tip')`, tip은 `title`·`url` 필수(CHECK). 리플렛 제출은 이미지·AI 결과·확정 값·상태가 더 많고, `url`이 (b)에서는 없다.
- `kind='leaflet'`을 더하면 CHECK를 바꾸고 jsonb 한 칸에 모두 넣어야 한다. 관리자 «신고·제보» 화면을 같이 쓸 수 있는 장점은 있다.
- 기본안: 새 표 `leaflet_submissions`(spec FR-020) + 공개 전 검토는 `raw_posts REVIEW`. 007 화면에는 «단체 제공 N건» 링크만.
- `raw_posts`는 관리자 전용 RLS(`20261101030000_security_rls.sql` «Admin only»)라 회원이 직접 넣을 수 없다 → 서버 경로가 서비스 키로 넣는다(spec FR-021).

## R5. 저장소 — 기존 버킷과 정책

- `20261028000000_baseline.sql`: 버킷 `posters`(수집기), `event-images`(직접 등록) 둘 다 `public=true`, 누구나 읽기.
- `20261101030000_security_rls.sql`: `event-images` 올리기는 관리자만.
- 그래서 리플렛 원본용으로 **새 비공개 버킷**이 필요하다(spec FR-001·002). 공개 포스터로 쓸 때만 공개 버킷으로 복사(FR-032).
- `storage_usage()`(관리자 «저장공간» 화면)는 `events.poster_image_url`·`raw_posts.image_urls`에 걸리지 않은 파일을 «안 쓰는 이미지»로 센다. 새 버킷 파일은 `leaflet_submissions.image_path`로 걸리므로, 그 함수의 참조 목록에 더하지 않으면 전부 «안 쓰는 이미지»로 보인다 → 계획 단계에서 함수 고치기를 작업에 넣는다.

## R6. 원본 링크 규칙의 실제 코드

- `collector/tools/publish_verified.py` 대상: `raw_posts.status IN ('COLLECTED','PENDING')`. `REVIEW`는 대상이 아니다 → 단체 제공 초안은 정기 공개에 걸리지 않는다.
- 링크 검사: `collector/utils.py check_link` — `http`로 시작하지 않으면 실패, aiohttp GET(리다이렉트 따라감, 20초, 두 번) 후 `status < 400`.
- 공개 행 `events.original_url = raw_posts.source_url`. (b)를 고르면 피카 페이지 주소가 여기 들어가고, `source_url NOT NULL`(baseline)도 그 주소로 채운다.
- 중복 판정(제목 정규화 + 시작일, 느슨한 제목 + 시작일 + 지역)은 단체 제공에도 그대로 쓴다.
