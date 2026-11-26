# Quickstart: 014 검증 절차

구현을 끝냈다고 말하기 전에 아래를 차례로 돌린다(헌장 V). 화면 계약은 [contracts/screens.md](contracts/screens.md), 데이터는 [data-model.md](data-model.md)에 있다.

## 준비

- 개발 서버는 하나만 띄운다(webpack, 힙 2GB). `.claude/launch.json`의 프론트 항목을 `preview_start`로 띄우고, 끝나면 `preview_stop`으로 끈다.
- 비교할 기준: 바꾸기 전 운영 사이트 `https://picka.news`, 시안 `docs/design/mockups_2026-11-26_v4/mockups_v4.html`.

## 1. 빌드·형 검사

```powershell
Set-Location F:\projects\pick-art\frontend; npx tsc --noEmit; if ($?) { npm run build }
```
기대: 오류 0. 빌드는 `next build --webpack`.

## 2. 리소 색이 남지 않음 (SC-008)

```powershell
Set-Location F:\projects\pick-art\frontend\src; Select-String -Path (Get-ChildItem -Recurse -Include *.tsx,*.ts,*.css) -Pattern '2350d8|ff4fa3|ecede6' -CaseSensitive:$false | Where-Object { $_.Line -notmatch 'data-pica-theme="riso"|\[data-pica-theme="riso"\]' }
```
기대: 공개 화면 코드에 0건. `globals.css`의 보관용 `riso` 묶음과 관리자 화면은 빼고 센다.

## 3. 묶음별 건수 (SC-004)

같은 필터 주소 다섯 개(`/`, `/?region=김해&date=week`, `/?category=공연`, `/?kids=1`, `/region/gimhae`)를 바꾸기 전 운영 사이트와 로컬에서 각각 연다. 묶음별 건수(«오늘 6» 같은 숫자)를 표로 적는다.
기대: 모두 같다.

## 4. 홈 첫 화면 (SC-001)

375×812에서 `/`를 연다.
기대: 칩 줄과 «오늘» 선반의 포스터 3장이 스크롤 없이 보인다. 스크린숏을 남긴다.

## 5. 지도는 누를 때만 (SC-002)

홈을 새로 연 뒤 네트워크 요청 목록에서 `map.naver` / `oapi.map.naver.com`을 찾는다.
기대: 0건. «지도»를 누른 뒤 1건 이상이고, 시트 머리의 «N건 · 장소 N곳»이 홈 건수와 같다.

## 6. 안내 그림 → 글자 포스터 (SC-003)

- 채움 도구를 돌린 뒤 DB에서 `poster_placeholder = true`인 공개 행사 수를 센다. 처음 표시한 지문 2개(`239e6b7f…`, `c5e19531…`)에 해당하는 행사가 모두 true여야 한다.
- 「Art: ON 김해 〈구지가, 가야의 탄생〉」, 「제3회 정기연주회 김해이리스여성합창단」, 「김해시의사회 … 송년음악회」, 「제23회 김해시립소년소녀합창단 정기연주회」를 홈 선반, 상세, `/venues/<김해서부문화센터 id>`에서 연다.
- 기대: 안내 그림은 한 번도 보이지 않고, 글자 포스터(날짜·제목·«정보: …»)가 보인다.
- 관리자 화면에서 표시를 풀면 다시 그림으로 보이고, 표시하면 다시 글자 포스터로 돌아온다(시험 뒤 원래대로 둔다).

## 7. 기능 빠짐 점검 (SC-005)

화면별 계약표(contracts/screens.md)의 칸을 하나씩 눌러 표에 ✓/✗를 적는다. 최소 다음 항목을 확인한다.
- 필터 칩 5개
- 검색
- 찜(로그인)
- 공유
- 캘린더 추가와 구독
- 오류 신고
- 제보·리플렛 등록 입구
- 원본 안내 열기
- 길찾기
- 개인 휴대전화가 가려지는지(휴대전화가 든 행사 1건)
- `/saved`·`/settings`·`/calendar`·`/nearby` 주소

기대: ✗ 0개.

## 8. 협약 배지

관리자 화면에서 시험 공간 하나에 오늘 날짜로 협약을 넣는다. 공간 페이지에 배지가 보이는지 확인하고, 협약을 풀면 사라지는지 확인한다. 시험이 끝나면 `partner_since`를 비우고 `partner_note`도 시험 전 값으로 되돌린다.
기대: 배포 직후 배지가 보이는 공간·단체는 0곳이다.

## 9. 명암비 (SC-006)

화면 팔레트의 글자·바탕 조합(글자/종이, 보조/종이, 흰 글자/초록, 초록/종이, 글자/흰 면)을 WCAG 공식으로 계산한다.
기대: 모두 4.5 이상. 4.5에 못 미치는 조합은 쓰는 자리를 큰 글자로 제한하거나 색을 고쳐 가이드에 적는다.

## 10. 첫 화면 속도 (SC-007)

바꾸기 전 운영 사이트와 바꾼 뒤 미리보기 배포에서 홈을 각각 3번 연다. `performance.getEntriesByType('paint')`의 first-contentful-paint와 LCP를 적는다.
기대: 바꾼 뒤 평균이 바꾸기 전 평균보다 늘지 않는다.
