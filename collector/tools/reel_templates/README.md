# 릴스 형식 템플릿

`F:\projects\html-to-video\build.js` 로 굽는 9:16(1080×1920) HTML 페이지. 화면 글자는 270~1250px 안, 반주는 페이지 안 WebAudio 합성음.

| 형식 | 파일 | 길이 | 줄거리 | 상태 |
|---|---|---|---|---|
| 우체통 룰렛 | `roulette.html` | 15초 | 훅 3박(「오늘 뭐 볼지 / 모르겠으면 / 룰렛 돌림」) → 빨간 우체통 슬롯이 그날 게시물 포스터 8장을 돌리다 감속 → 「당첨!」 도장 → 날짜·시각·요금·장소 한 박씩 → 「다음 룰렛은 내일」 → 로고 | 2026-11-18 시험판, 운영자 보관 지시 |

## 룰렛 쓰는 법 (지금은 손으로)
1. `p/` 폴더에 포스터 8장(긴 변 900px 안팎 jpg)을 두고, 페이지 맨 아래 `ITEMS`(파일 이름)·`WIN`(당첨 칸 번호)·`W`(분야·제목·정보 박자)를 바꾼다.
2. 정보 박자(`W.beats`)는 facts 에서 공식 출처로 확인된 값만 쓴다.
3. 확인: `node F:/projects/html-to-video/capture.js roulette.html --sample 20,60,192,205,290,390,440 --out samples`
4. 굽기: `node F:/projects/html-to-video/build.js roulette.html --sec 15 --out 결과.mp4`
5. 최대 음량이 0dB 에 닿는다 — 굽기 전에 `--master -3` 쯤으로 낮출 것.
