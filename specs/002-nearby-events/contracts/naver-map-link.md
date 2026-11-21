# Contract: 네이버지도 길찾기 링크 (`frontend/src/lib/naverMap.ts`)

화면에는 버튼 하나(「네이버지도 길찾기」)와 작은 링크 하나(「앱이 없으면 웹에서 보기」)를 둔다. 버튼은 `mode: "public"`으로 열고, 이동수단은 네이버지도 안에서 바꾼다(2026-11-21 운영자 결정). 함수는 `car`도 계속 지원한다.

순수 함수. 입력 `{ name: string, region?: string, lat?: number, lng?: number, mode: "public" | "car", platform: "ios" | "android" | "desktop", appname: string }` → 출력 `{ primary: string, fallback: string }`.

| 경우 | primary (버튼) | fallback (「웹에서 보기」 링크) |
|---|---|---|
| 아이폰 + 좌표 있음 | `nmap://route/{mode}?dlat={lat}&dlng={lng}&dname={enc(name)}&appname={appname}` | `https://map.naver.com/p/search/{enc(name [+ " " + 시군])}` |
| 안드로이드 + 좌표 있음 | `intent://route/{mode}?…#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end` | 이름 검색(위와 같음) |
| PC 또는 좌표 없음 | 이름 검색 | 이름 검색 |

- 출발지(`slat/slng`)는 **넣지 않는다**. 앱이 현재 위치를 쓴다(방문자 위치를 피카가 넘기지 않음).
- 좌표 기반 **웹** 길찾기 주소는 공식 문서로 확인하지 못해 쓰지 않는다(research §6). 웹은 장소 이름 검색으로 연다.
- 버튼은 `primary`만 연다. 웹으로 **자동 전환하지 않는다** — 예전의 「1.5초 안에 페이지가 숨겨지지 않으면 fallback으로 이동」은 아이폰 Chrome에서 앱이 열린 뒤에도 브라우저로 되돌아오게 해서 뺐다(2026-11-21 운영자 실기기). `fallback`은 「앱이 없으면 웹에서 보기」 링크가 새 탭으로 연다.
- 테스트: `node --test`로 경우별 출력 문자열을 고정 검사한다. 아이폰·안드로이드 실기기에서 버튼을 각 1회 눌러 길찾기 화면이 열리고, 그 안에서 대중교통·자동차를 바꿀 수 있는지 확인한다(T031).
