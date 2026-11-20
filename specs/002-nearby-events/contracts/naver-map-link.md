# Contract: 네이버지도 길찾기 링크 (`frontend/src/lib/naverMap.ts`)

화면에는 버튼 하나(「네이버지도 길찾기」)만 둔다. 화면은 `mode: "public"`으로 열고, 이동수단은 네이버지도 안에서 바꾼다(2026-11-21 운영자 결정). 함수는 `car`도 계속 지원한다.

순수 함수. 입력 `{ name: string, lat?: number, lng?: number, mode: "public" | "car", isMobile: boolean, appname: string }` → 출력 `{ primary: string, fallback: string }`.

| 경우 | primary | fallback |
|---|---|---|
| 휴대폰 + 좌표 있음 | `nmap://route/{mode}?dlat={lat}&dlng={lng}&dname={enc(name)}&appname={appname}` | 네이버지도 웹 길찾기(좌표, 형식은 research §6 확인 후 확정) 또는 `https://map.naver.com/p/search/{enc(name)}` |
| PC + 좌표 있음 | 웹 길찾기(위와 같음) | 이름 검색 |
| 좌표 없음 | `https://map.naver.com/p/search/{enc(name + " " + 시군)}` | (같음) |

- 출발지(`slat/slng`)는 **넣지 않는다**. 앱이 현재 위치를 쓴다(방문자 위치를 피카가 넘기지 않음).
- 휴대폰에서 앱 스킴을 열고 약 1.5초 안에 페이지가 숨겨지지 않으면 `fallback`으로 이동한다.
- 테스트: `node --test`로 네 경우의 출력 문자열을 고정 검사한다. 아이폰·안드로이드 실기기에서 각 1회 눌러 길찾기 화면(대중교통·자동차)이 열리는지 확인한다.
