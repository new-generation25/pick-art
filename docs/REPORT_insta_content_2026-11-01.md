# 인스타그램 카드뉴스 시범 제작 (2026-11-01)

## 결과

- 오늘(11.1 일) 하루만 열리는 공개 행사 2건으로 캐러셀(1080×1350, 5장)과 캡션을 만들었다.
  산출물은 `C:\Users\user4\Desktop\pick-art_인스타_2026-11-01\` (PNG, `jpeg_for_api\` JPEG, 캡션 txt, `미리보기.html`, `facts\` JSON).
- 생성기 `collector/tools/make_insta_cards.py` 를 남겼다. 게시 기능은 없다. 올리는 것은 사람이 검토한 뒤 한다.

| 행사 | 근거(공식 페이지) | 고른 이유 |
|---|---|---|
| 진주필하모닉오케스트라 Rising Star & Orchestra (진주, 18:00, 무료) | [경남문화예술회관](https://artcenter.gyeongnam.go.kr/concert/concertView.do?CONCERT_ID=CM0001605), [콘테스트 예약](https://contest.co.kr/contest/eview_n/278) | 오늘 하루 공연, 무료, 전체관람가, 예약 못 해도 당일 잔여 티켓 |
| 김해 댕댕파크 멍하니 가을음악회 (김해, 13:00~17:00) | [김해시 새소식(일정 변경)](https://www.gimhae.go.kr/03360/00023/00024.web?amode=view&idx=2594709) | 오늘 하루, 야외·반려견 동반이라 저장·공유가 잘 되는 소재 |

주의: 댕댕파크 포스터에는 변경 전 날짜 `10.24(토)` 가 찍혀 있다. 표지 스티커·2장 안내·캡션에 "11.1(일)로 변경"을 넣었다.
요금은 김해시 공지에 표기가 없어 슬라이드에 넣지 않았다.

## 조사 요약 (채택한 것)

1. **캐러셀 = 저장·공유용, 릴스 = 신규 도달용.** 행사 정보는 다시 꺼내 보는 정보라 캐러셀을 기본으로 했다.
   ([Storrito](https://storrito.com/resources/how-instagram-carousels-beat-reels-for-engagement-in-2026-and-when-to-use-each/), [dev.to 2026 가이드](https://dev.to/fermainpariz/how-to-create-instagram-carousel-posts-that-get-saved-and-shared-2026-guide-1jjm))
2. **5장 구성: 훅 표지 → 언제·어디·얼마 → 무엇 → 가는 법 → 저장·공유 CTA.** 교육형은 8~12장을 권하지만 행사 안내는 정보량이 적어 5장으로 줄였다.
3. **첫 장 훅이 도달을 좌우한다**는 사례(Claude+PIL+Graph API로 8장 자동 생성, 1편 약 9분). 표지에 "오늘 6시 무료 오케스트라"처럼 시간·혜택을 크게 쓴다.
   ([GPTers 후기](https://www.gpters.org/marketing/post/review-8-slides-instagram-qES0yMc4Cvgem5i))
4. **해시태그는 캡션당 5개.** 인스타그램이 게시물·릴스 해시태그를 5개로 줄이고 있다(2025-12 발표).
   그래서 요청받은 15~25개 대신 본 캡션 5개 + 예비 목록(스레드·블로그·교체용)으로 나눴다.
   ([Social Media Today](https://www.socialmediatoday.com/news/instagram-implements-new-limits-on-hashtag-use/808309/))
5. **게시 시각:** 대형 조사들은 일요일 저녁 8~10시를 꼽는다([Buffer](https://buffer.com/resources/when-is-the-best-time-to-post-on-instagram), [Metricool](https://metricool.com/best-time-to-post-instagram/)).
   하지만 "오늘 행사"는 그 시각이면 끝난다. **전날 저녁 8~10시 게시 + 당일 아침 스토리 재공유**로 쓴다.
6. **자동화 흐름:** 데이터(시트/DB) → 템플릿에 글자 합성 → 이미지 호스팅 → Graph API 발행이 공통 구조다.
   Make·n8n·Canva 대량제작 사례가 많다([Make+Canva 영상](https://www.youtube.com/watch?v=GvJMt9FtkAg), [n8n 캐러셀 영상](https://www.youtube.com/watch?v=N60pJk5rd0s), [Blotato 가이드](https://help.blotato.com/blog/automate-instagram-carousels-n8n-make)).
   우리는 이미 Supabase에 행사가 있으므로 Canva 대신 HTML 템플릿 + Playwright로 렌더링한다(한글 글꼴을 직접 통제).
7. **Graph API 제약:** 캐러셀 이미지는 JPEG만, 최대 20장, 첫 장 비율로 나머지를 자른다, 공개 URL에 올려 두어야 한다, 24시간 게시 한도 있음.
   그래서 생성기가 `jpeg_for_api/` 에 JPEG 사본을 같이 만든다. ([Meta 문서](https://developers.facebook.com/docs/instagram-platform/content-publishing/))
8. **사실 검수 단계를 남긴다.** DB `description`·`price_info` 가 비어 있는 행이 많다. 공식 페이지에서 확인한 값만 `--facts` JSON에 넣고, 없는 칸은 슬라이드에서 뺀다.

## 실행 방법

```
cd collector
# 오늘 열리는 후보 (하루 행사·포스터 있는 것 먼저)
python tools/make_insta_cards.py --today 2026-11-01
# 슬라이드 + 캡션 생성
python tools/make_insta_cards.py <event_id> --facts <facts.json> --out <폴더> --slug <파일이름앞부분>
```

- `PYTHONIOENCODING=utf-8` 를 붙여 실행한다. Playwright(Chromium)와 인터넷(글꼴 CDN·포스터) 연결이 필요하다.
- facts 없이 돌리면 DB 값만으로 만든다(시간·요금·가는 법 칸이 빠진다). facts 키 목록은 스크립트 첫머리 주석에 있다.
- 오늘 쓴 facts 예시: 바탕화면 산출물 폴더의 `facts/*.json`.

## 하지 않은 것

- 게시·예약 게시·자동 발행 설정은 하지 않았다(승인 필요).
- 릴스(9:16) 버전은 만들지 않았다.
