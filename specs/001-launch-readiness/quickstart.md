# Quickstart: 공개 출시 준비 보완 확인 절차

## 준비

- 로컬: 3000번 개발 서버(webpack, 힙 2GB) 하나만. 이미 떠 있으면 그대로 쓴다.
- 배포: 사용자 승인 후 `revive/2026-10` → `main` 반영, Vercel 배포 완료(Ready) 확인.
- `BASE`는 로컬 `http://localhost:3000` 또는 배포 `https://pick-art.vercel.app`.

## 확인 (모두 통과해야 완료)

| # | 확인 | 명령·방법 | 기대 |
|---|---|---|---|
| Q1 | 약관·방침 열림 | `curl -o /dev/null -w "%{http_code}" $BASE/terms` (privacy도) | 200, 200 |
| Q2 | 처리방침 항목 대조 | 처리방침 본문의 수집 항목 ↔ research R1 대조표 | 빠짐·초과 0 (SC-002) |
| Q3 | 링크 도달 | 홈·행사 상세·로그인·가입 3단계 화면 HTML에 `/privacy` 링크 | 모두 있음 (SC-001) |
| Q4 | 동의 안내 | 로그인·가입 3단계·뉴스레터 폼에 안내 문구 | 있음 (FR-004, FR-005) |
| Q5 | 미리보기 | 홈·행사 상세 3건 HTML의 `og:url`, `og:image` | 사이트 주소 기준 절대 주소, 상세는 행사 이름·포스터 (SC-003) |
| Q6 | robots | `curl $BASE/robots.txt` | 관리자·API 제외, sitemap 줄 |
| Q7 | sitemap 수 | sitemap의 `/events/` 수 ↔ 공개 피드 진행 중·예정 행사 수 | 같음 (SC-004) |
| Q8 | 404 | 없는 경로, 없는 행사 ID, 비공개 행사 ID | 3개 모두 404 + 브랜드 화면 (SC-005) |
| Q9 | 가입 경로 | `curl -I $BASE/signup` / 로그인 화면 | `/login`으로 이동, 이메일·비밀번호 입력 없음 |
| Q10 | 전화번호 | 설정 화면 | '선택' 표시 |
| Q11 | '경남' | 공개 화면 HTML에서 `경남` 검색 | 브랜드 문구 0건(시군·행사 내용 제외) (SC-006) |
| Q12 | 타입 검사 | `npx tsc --noEmit` (frontend) | 오류 0 |

## 결과

### 2026-11-08 — 브랜치 미리보기 (revive/2026-10 @ 1661165)

로컬 서버 대신 Vercel 미리보기 배포(`pick-jmo6h4sns-new-generation25s-projects.vercel.app`, Vercel 로그인 보호)에서 확인했다. 미리보기도 프로덕션 빌드라 `SITE_URL`은 `https://pick-art.vercel.app`이다.

| # | 결과 | 측정값 |
|---|---|---|
| Q1 | 통과 | /terms 200, /privacy 200 |
| Q2 | 통과 | R1 항목·보호책임자·위탁 3곳 빠짐 0 |
| Q3 | 통과 | 홈(꼬리말)·로그인·가입 3단계 HTML에 `/privacy` 있음 |
| Q4 | 통과 | 로그인 동의 문구 있음, 홈 소식 받기 폼 2곳에 안내 문구 |
| Q5 | 통과 | 홈 og:url `https://pick-art.vercel.app`, og:image `/og-default.png` 절대 주소. 상세 3건: 제목 "{행사} \| 피카 pica", og:url 사이트 주소 기준, og:image 포스터 |
| Q6 | 통과 | Disallow /admin /api /settings /welcome /auth, Sitemap 줄 |
| Q7 | 통과 | sitemap `/events/` 389 = REST 조회(PUBLISHED, 종료일 ≥ 오늘) 389 |
| Q8 | 통과 | 없는 경로·없는 UUID·형식 틀린 ID 모두 404 + 브랜드 화면 |
| Q9 | 통과 | /signup → /login, 로그인 화면에 이메일·비밀번호 입력 없음 |
| Q10 | 통과(코드) | 설정 화면은 로그인해야 그려져 HTML에는 없음. 배포된 `app/settings/page-*.js`에 "전화번호 (선택)" 있음 |
| Q11 | 통과 | 홈·로그인·가입·약관·방침·404 본문에 '경남' 0건 |
| Q12 | 통과 | `npx tsc --noEmit` 오류 0 |
