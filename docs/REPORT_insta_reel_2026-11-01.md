# 자동 숏폼(릴스·쇼츠) 시범 제작 (2026-11-01)

## 결과

- 생성기 `collector/tools/make_insta_reel.py` — 카드 생성기와 같은 facts JSON(키 `id` 필수)으로 1080×1920 mp4 를 만든다.
- 첫 시안은 카드 이미지를 차례로 넘기는 슬라이드쇼였다 → "그대로 숏폼으로 만들면 누가 보냐"는 지적을 받고
  **0.5초 박자 컷·큰 글자·카운트다운** 구조로 다시 짰다.
  - `week` : 훅 4박(2초, "이번 주 / 김해 / 뭐 하고 / 놀지?") → 5→1 카운트다운(행사마다 6박 3초:
    번호+색면 와이프 → 포스터 당겨짐 → 날짜 쾅·흔들림 → 한마디 → 제목 띠) → 저장·태그 CTA 4박. 5건 = 19초
  - `single` : 훅 4박 → 포스터 당겨짐 → 날짜 쾅 → 한마디 2컷 → 언제·몇 시·어디(각 1초) → 제목 띠 → CTA. 약 10.5초
  - 배경은 그 행사 포스터를 흐리게 깔아 화면을 꽉 채우고, 위에 5칸 진행 바
- 시범 2편: `김해_이번주_5곳_reel.mp4`(19초), `분청도자기축제_reel.mp4`(10.5초).
  바탕화면 `pick-art_숏폼_김해_11월1주\`. **게시하지 않았다.**

## 조사 요약 → 채택한 원칙

1. **첫 장면이 곧 훅.** 첫 1.5초 안에 4~7단어 큰 글자로 결론(날짜·"이번 주 김해 뭐 하지? 5곳")을 박는다.
   훅 창이 캡션 오버레이가 뜨기 전 1.5초라는 지적과, 3초 규칙은 "방향은 맞지만 늦다"는 지적을 따랐다.
   ([quso.ai Shorts playbook](https://quso.ai/blog/how-to-get-more-views-on-shorts), [dev.to Hook Engineering](https://dev.to/bulkdl/hook-engineering-the-science-of-the-first-3-seconds-in-short-form-video-2026-2jp9))
2. **짧게, 끝까지 보게.** 짧고 완주율 높은 쪽이 도달이 낫다는 쪽으로 자료가 모인다. 모음 19초(카운트다운으로 끝까지 붙잡기), 단일 10.5초.
   ([klap 2026](https://klap.app/blog/how-long-should-reels-be), [opus.pro Shorts](https://www.opus.pro/blog/ideal-youtube-shorts-length-format-retention))
3. **글자는 안전 구역 안.** 인스타 UI 가 위 약 14%·아래 약 35%를 덮는다는 가이드에 맞춰 핵심 글자를 y 270~1250 에 둔다.
   ([fliki 규격 가이드](https://fliki.ai/blog/instagram-reel-dimensions-and-size-guide))
4. **자동화 = 대본 → 그림 → 음성·자막 → FFmpeg 합성** 이 공통 구조다(유튜브 「코드 5개로 완전 자동화」,
   「무료 AI로 쇼츠 자동 제작」 자막 확인). 우리는 대본·그림을 AI 로 만들지 않는다 — 대본은 공식 페이지로
   검수된 facts, 그림은 **공식 포스터만** 쓴다. 그래서 사실 오류·초상권·저작권 위험이 작다.
   ([uXflS-5t-ho](https://www.youtube.com/watch?v=uXflS-5t-ho), [ifU-ZlD2Br0](https://www.youtube.com/watch?v=ifU-ZlD2Br0), [EUi09O_b7so](https://www.youtube.com/watch?v=EUi09O_b7so))
5. **자막 싱크가 수작업에서 가장 오래 걸린다**(위 영상) → 나레이션 없이 화면 글자가 곧 자막이 되게 짰다.
   소리 없이 보는 시청자도 정보를 다 받는다.
6. **템플릿 통일.** 같은 스타일 문구를 붙여 그림체를 통일하라는 팁 → 사이트·카드와 같은 리소 테마
   (종이 바탕·형광 분홍·파랑·Black Han Sans)로 장면을 고정했다.
7. **음원은 직접 합성.** 무료 BGM 팩도 라이선스 확인이 필요하다 → 페이지 안 WebAudio 로 120bpm 킥·스네어·
   하이햇·베이스와 구간 히트를 직접 만들었다(외부 음원 0개). 화면 컷이 박자에 맞물린다.
8. **마지막은 저장·공유 CTA + 출처.** 외주 사례들이 공통으로 훅–정보–CTA 3단을 쓴다.
   ([크몽 숏폼 기획 사례](https://kmong.com/gig/775130))

## 실행 방법

```
cd collector
# 행사 1건
python tools/make_insta_reel.py single <facts.json> --out <폴더> --slug <이름>
# 모음
python tools/make_insta_reel.py week a.json b.json c.json --region 김해 --range "11.2 ~ 11.8" --out <폴더> --slug <이름>
# 굽기 전에 몇 장만 확인
python tools/make_insta_reel.py week ... --sample 1.5,4,8,12
```

- `PYTHONIOENCODING=utf-8`, Node.js, ffmpeg, 크롬이 필요하다. 굽기는 `F:\projects\html-to-video\build.js`(가상 시계로 30fps 정확히 캡처).
- facts 숏폼 키: `short`(띠 제목), `reel_day`(날짜 쾅 글자), `reel_punch`(한마디 2개), `reel_hook`(single 훅 4단어),
  `poster`(DB 대신 쓸 공식 포스터). 없으면 카드용 값으로 채운다.
- 메모리 때문에 한 번에 한 편만 굽는다.

## 한계

- 나레이션(TTS)이 없다. 넣으려면 Windows 한국어 음성이나 유료 TTS 를 붙이고 문장별 길이로 장면 시간을 맞춰야 한다.
- 반주는 단순한 합성음이다. 음악 품질을 높이려면 라이선스가 명시된 음원을 따로 골라야 한다.
- 한마디(`reel_punch`)·날짜 글자는 사람이 facts 에 써 넣었다. 자동화하려면 LLM 이 쓰고 사람이 검수하는 단계가 필요하다.
- 포스터가 세로로 아주 긴 경우(배너형) 화면에서 작게 보인다 — 일반 비율 포스터를 facts `poster` 로 지정하는 것이 낫다.

## 2차 — "포스터 내용 그대로"에서 "가고 싶게"로 (story 모드)

지적: 영상이 포스터에 적힌 것 그대로라 볼 이유가 없다 → 프로그램을 조사하고 작년 현장을 보여 줄 것.

**벤치마킹에서 가져온 것**
- 축제 프로모는 첫 3초 콜드 오픈 → 분위기(B-roll) → 정보 타이포 → 한 가지 행동 유도. 정보 글자가 없으면
  "예쁜 B-roll" 일 뿐이고, 사람 얼굴·현장 열기가 드론 전경보다 낫다.
  ([fixr 2026](https://blog.fixr.co/festival-event-marketing-2026-what-will-sell-tickets),
  [Event Planner Expo](https://www.theeventplannerexpo.com/?p=22340), [Ticket Fairy](https://www.ticketfairy.com/blog/festival-marketing-on-tiktok-reels-short-form-video-strategies-to-ignite-buzz-and-ticket-sales.md))
- 지자체 숏폼(충주·양산 등)이 먹힌 건 "정보"보다 "볼거리·재미"가 먼저였기 때문이라는 보도.
  ([서울신문](https://go.seoul.co.kr/news/newsView.php?id=20240722021004), [전북일보](https://jjan.kr/article/20250613580079))
- 그래서 구성: **사회적 증거(작년 5만 8천 명) → 올해 바뀐 점(장유로) → 가서 할 거 4가지(가격·시간) → 먹거리 → 꿀팁 → 저장·태그**.

**자료와 권리**
- 작년 방문객 5만 7,800여 명: [쿠키뉴스 2025-11-10](https://www.kukinews.com/article/view/kuk202511100052).
- 올해 프로그램·가격: 축제 누리집 [행사안내](http://festival.buncheong.co.kr/00001/00010/00037.web)
  (물레체험 5,000원, 천인의 분청 무료 선착순 1,000명, 가족도자기만들기대회 11.8 10:30 사전접수, 공개 경매 11.8 16:00, 부녀회 음식부스 추어탕·소고기국밥).
- 작년 현장 사진: [한국관광콘텐츠랩](https://api.visitkorea.or.kr/) "김해분청도자기축제" — **공공누리 제3유형**
  (출처 표시·상업 이용 가능·**변경 금지**). 그래서 사진은 자르기·흐림·글자 얹기 없이 원본 비율 그대로 화면에 넣고
  (통째로 미끄러져 들어오는 이동만), 글자는 사진 바깥 위쪽에, 출처는 사진 아래에 둔다.
- 작년 영상: 공식 채널(김해문화관광재단·김해시TV) 영상은 모두 유튜브 표준 라이선스라 **쓰지 않았다.**
  쓰려면 주최 측 허락이 필요하다.

**생성기**: `story` 모드 — facts 의 `reel_script`(장면 목록: beats·solid·big·photo·head·hsub·phcap·poster·chip·hit)대로 컷을 만든다.
```
python tools/make_insta_reel.py story <facts.json> --out <폴더> --slug <이름>
```
