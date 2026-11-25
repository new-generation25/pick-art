# 피카 릴스 자동 제작 계획 (2026-11-19 초안)

하루 1편, 그날 모은 행사 facts로 15초 안팎의 세로 영상을 자동으로 만든다.

> **2026-11-25 현황 (운영자 결정에 맞춤)**: 아래는 11/19 초안이다. 그 뒤 시리즈 릴스 「이번 주, 어디 가」가 확정됐다(확정본 6차 `docs/reels/pica_reel_이번주어디가_6차.mp4`, 1080×1920·43.6초, 조립 `docs/reels/build/build_reel.py`). 11/25 18:57 @picka.news 에 릴스로 올라갔다(`docs/insta/roundups.json` 기록). 1절 2번(AI)과 7번(길이)은 아래처럼 고쳤다. 세 포맷(룰렛·퀴즈·0원)은 시범으로 남아 있다.
목표는 **팔로워가 아닌 사람에게 닿는 것**이다(30일 조회한 사람 2명 → 릴스로 비팔로워 도달을 시험).

## 1. 원칙

1. **포스터를 나열하지 않는다.** 남의 콘텐츠를 모아 올리는 계정은 비팔로워 추천에서 빠진다(Mosseri, 출처 7). 매 편에 피카가 만든 장치(퀴즈·룰렛·「0원」 고르기·비교)가 있어야 한다.
2. **사실은 facts 값만 쓴다.** 날짜·시간·장소·요금은 `docs/insta/<날짜>/facts/*.json`의 공식 출처 확인값만 쓴다. 비어 있는 칸(`"-"`)은 쓰지 않는다. 그림은 공식 포스터만 쓴다. AI 이미지는 쓰지 않는다(브랜드 가이드). 예외는 브랜드 가이드 0절 7번뿐이다: 소개 릴스 끝 까치 동작(11/20), 시리즈 릴스의 첫머리 까치 장면 6초 이내와 사람이 나오는 동네 장면(11/25). 장면에 행사·단체 이름과 간판 글자를 넣지 않고, 행사 정보는 화면 글자와 실제 포스터로만 알린다. 예외를 쓴 릴스는 게시할 때 「AI 정보」를 켠다(2026-11-25 운영자 결정에 맞춤).
3. **0~1초에 질문이나 숫자를 띄운다.** 「얼마게?」, 「공짜로 갈 수 있는 7곳」, 「룰렛 돌림」처럼 숫자·도전·비교 훅을 데이터에서 고른다(출처 2·3).
4. **1~1.3초마다 화면이 바뀐다.** 컷이 아니어도 된다. 글자 교체, 도장, 흔들림이 컷을 대신한다(local `auto-short-video/research/13`, `21`).
5. **글자는 y 270~1250 안에 둔다.** 인스타그램 UI가 위아래를 덮는다. 소리 없이 봐도 다 이해되게 만든다.
6. **끝은 행동 하나로 맺는다.** 퀴즈는 댓글, 「0원」은 저장, 룰렛은 친구에게 보내기. 공유(보내기)는 비팔로워 확산의 핵심 신호다(출처 8).
7. **길이는 13~18초(시범 포맷).** 시리즈 「이번 주, 어디 가」는 노래 길이에 맞춘다(확정본 6차 43.6초, 2026-11-25 운영자 결정에 맞춤). 마지막 화면은 처음과 이어지게 만든다(다시 보기 유도).

## 2. 포맷 세 가지와 고르는 규칙

| 포맷 | 파일 | 필요한 데이터 | 끝맺음 |
|---|---|---|---|
| 우체통 룰렛 | `collector/tools/reel_templates/roulette.html` | 포스터 6~8장 + 당첨 1건 정보 | 「다음 룰렛은 내일」 |
| 이 공연 얼마게? | `docs/insta/reel_proto/quiz.html` (템플릿화 예정) | **요금이 확인된** 행사 3건 (무료 1건 이상이면 좋음) | 「몇 개 맞혔어? 댓글로」 |
| 공짜로 갈 수 있는 N곳 | `docs/insta/reel_proto/free.html` (템플릿화 예정) | 요금 「무료」 행사 **4건 이상** | 「저장해 두고 골라 가 📌」 |

그날 고르는 순서:
1. 무료가 4건 이상이고 최근 3일 안에 「0원」을 안 했으면 → **0원**
2. 요금이 확인된 행사가 3건 이상이면 → **퀴즈** (오답 보기는 정답과 겹치지 않는 그럴듯한 값)
3. 나머지 → **룰렛**
4. 같은 포맷은 연속 이틀 쓰지 않는다. 2주 동안 세 포맷을 고르게 돌려 비교한다.

## 3. 매일 흐름 (10:00 작업의 한 부분)

1. 1부 게시가 끝나면 그날 facts에서 포맷을 고르고 행사를 뽑는다.
2. 템플릿 데이터를 채우고, 포스터를 `docs/insta/<날짜>/reel/p/`에 복사한다(저화질 규칙은 카드와 같음).
3. `capture.js --sample`로 장면별 12장을 뽑아 시트를 만들어 **눈으로 검사**한다. 확인할 것:
   - 글자가 잘리지 않는가
   - 세이프존을 벗어나지 않는가
   - 포스터가 맞는가
   - 날짜·요금이 facts와 같은가
4. `build.js --master -3`으로 mp4를 굽는다. 최대 음량이 −1dB 아래인지 확인한다.
5. 게시한다. 게시 방식은 아래 4절 결정을 따른다. 캡션에는 행사 계정 `@태그`와 출처를 넣고, 「친구에게 보내기」 문구를 넣는다.
6. 리포트(`activity.json`)에 kind `릴스`로 남긴다. 다음 날 3부에서 그 릴스의 조회·좋아요·공유·저장을 읽는다.

자동화의 경계: 렌더·데이터 채우기·게시는 자동이다. 훅 문구와 사실 대조는 실행 세션이 프레임 시트로 검사한다. 이상하면 게시하지 않고 보고한다(local `research/15`: 훅·검수를 넘긴 사례는 결과가 나빴다).

## 4. 음악 (결정 대기)

- 비즈니스 계정은 유행 음악 보관함을 쓸 수 없다. 웹으로 릴스를 올릴 때는 음악 고르기 단계가 없다(2026-11-19 웹에서 확인).
- 크리에이터로 전환하는 것은 **앱에서만** 할 수 있다(웹 설정에 메뉴가 없음).
- 갈래:
  - **A. 영상만 매일 자동 제작, 게시는 폰에서 유행곡 붙여서.** 하루 1분 정도 손이 간다.
  - **B. 웹으로 자동 게시, 합성 효과음만 넣음.** 직접 만든 소리라 저작권 문제가 없다. YouTube Shorts에도 그대로 쓸 수 있다(출처 9).

## 5. 측정과 되돌아보기

- 매일: 릴스별 조회·도달·좋아요·공유·저장·댓글 (인사이트). 평균 시청시간을 볼 수 있으면 같이 본다.
- 2주 뒤(2026-12-03): 포맷별로 「도달 대비 공유·저장」과 「팔로우 전환」을 비교한다. 약한 포맷은 빼고 새 포맷 하나를 넣는다.
- Trial Reels(팔로워에게 먼저 안 보이는 시험 게시)를 우리 계정에서 쓸 수 있는지 앱에서 확인한다(출처 10, 계정 조건이 기사마다 다름).

## 6. 할 일 (순서)

1. `collector/tools/make_reel.py`를 만든다.
   - `--format auto|roulette|quiz|free`, 입력은 facts 폴더다.
   - 세 템플릿이 같은 데이터 형식(JSON)을 읽게 정리한다.
   - 프레임 시트와 mp4를 자동으로 만든다.
2. 10:00 예약 작업에 「릴스」 부를 넣는다. 음악 결정에 따라 게시를 웹 자동으로 할지, 폴더에 놓고 폰 게시를 알릴지 정한다.
3. 2주 측정 후 포맷을 조정한다.

## 출처

조사 2026-11-19. YouTube는 페이지에서 제목·채널·날짜를 확인했다. 내용은 2번만 자막으로 확인했고, 나머지는 설명란 기준이다.

1. [유료 쇼츠 강의에서 쇼츠 만드는 방법을 코드 5개로 완전 자동화 했습니다 — 투더제이 TTJ (2026-02-26)](https://www.youtube.com/watch?v=uXflS-5t-ho)
2. [숏폼 영상, 알고리즘의 선택을 받는 방법 — 크몽 (2026-04-22)](https://www.youtube.com/watch?v=DtFBDIh3RNs)
3. [I Analysed 1000+ hooks, here's what works on instagram in 2026 — Vista Social (2026-06-01)](https://www.youtube.com/watch?v=CUwV4gmcTiE)
4. [One-Click Video Automation: Make.com, JSON2Video & Airtable — Automation-Tribe (2025-02-04)](https://www.youtube.com/watch?v=Asttb5aEeGg)
5. [How people are generating videos with Claude Code (Remotion Skill) — Leonardo Grigorio (2026-01-22)](https://www.youtube.com/watch?v=7OR-L0AySn8)
6. [Render videos programmatically from a dataset — Remotion 문서](https://www.remotion.dev/docs/dataset-render)
7. [New Instagram Policies Target Reposted Content — PetaPixel (2026-04-30)](https://petapixel.com/2026/04/30/new-instagram-policies-target-reposted-content/)
8. [Instagram Shares Algorithm Insights To Inform Strategy — Social Media Today (2025-01-22)](https://www.socialmediatoday.com/news/instagram-shares-algorithm-2025/738034/)
9. [Can You Use Copyrighted Music on Instagram? (2026) — Foxi Music, 음원 업체 블로그](https://www.foximusic.com/blog/instagram-reels-music-copyright-legal-guide/)
10. [Instagram rolls out 'trial reels' — TechCrunch (2024-12-10)](https://techcrunch.com/2024/12/10/instagram-rolls-out-trial-reels-that-arent-shown-to-a-creators-followers)

로컬 참고:
- `F:\projects\auto-short-video\research\13-editing-grammar.md` (편집 문법 실측)
- `15-automation-boundary.md` (자동화 경계)
- `21-ref-ki1-reel.md` (리듬 1.3초)
- `collector/tools/make_insta_reel.py` (11/1 시범, 0.5초 박자)
- `docs/REPORT_insta_reel_2026-11-01.md`
