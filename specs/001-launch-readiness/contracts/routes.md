# Contract: 공개 경로

| 경로 | 방법 | 상태 | 내용 |
|---|---|---|---|
| `/terms` | GET | 200 | 이용약관 HTML, 로그인 불필요 |
| `/privacy` | GET | 200 | 개인정보처리방침 HTML, 로그인 불필요 |
| `/robots.txt` | GET | 200 | `Allow: /`, `Disallow: /admin`, `/api`, `/settings`, `/welcome`, `/auth`; `Sitemap: <사이트 주소>/sitemap.xml` |
| `/sitemap.xml` | GET | 200 | 홈 + 공개·진행 중/예정 행사 `/events/{id}` (lastModified = published_at) |
| `/events/{없는 id}` | GET | 404 | 브랜드 404 화면 |
| `/events/{비공개 id}` | GET | 404 | 같음 (RLS로 익명 조회 결과 없음) |
| `/아무거나-없는-경로` | GET | 404 | 브랜드 404 화면 |
| `/signup` | GET | 307/308 → `/login` | 소셜 로그인만 |
| 모든 공개 페이지 | GET | 200 | `<meta property="og:url|og:image">`가 사이트 주소 기준 절대 주소 |
