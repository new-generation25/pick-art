# 배포 준비 점검 (2026-11-01)

## 지금 상태

| 항목 | 상태 | 근거 |
|---|---|---|
| 배포 주소 | https://pick-art.vercel.app (Vercel 프로젝트 `pick-art`, 팀 new-generation25's projects) | `vercel list pick-art` |
| 마지막 배포 | 2026-01-04, `main`의 `5d93c7f` | 같은 명령 |
| 주소를 열면 | **404 NOT_FOUND** | `curl -I` |
| 404 원인 | 프로젝트 설정이 Root Directory `.`, Framework `Other`. Next.js 앱은 `frontend/`에 있어 아무것도 빌드되지 않았다(빌드 4~5초) | `vercel project inspect pick-art` |
| 환경 변수 | **없음** | `vercel env ls` |
| GitHub | `main`만 있고 1월 4일에 멈춤. 작업 브랜치 `revive/2026-10`은 푸시한 적 없음 | `git ls-remote` |
| 두 번째 프로젝트 `pick-art-pica` | 최근 3번 빌드 실패, 주소 404. 손대지 않음 | `vercel list pick-art-pica` |

## 이번에 끝낸 준비 (커밋 `cdad4ac`)

- `frontend/vercel.json`에 `"framework": "nextjs"`를 넣었다. 프로젝트 설정의 Framework가 `Other`여도 Next.js로 빌드된다.
- 이 PC에서만 의미 있는 API 5개는 배포 환경(`VERCEL=1`)에서 501로 막았다. 파이썬 수집기를 실행하거나 `.env.local`을 읽고 쓰는데 로그인 검사가 없어서, 공개 서버에 열려 있으면 안 된다.
  - `/api/collector/status`(GET은 "꺼짐"으로 답해 관리자 화면이 깨지지 않게 함), `/api/crawl/kopis`, `/api/getPrompt`, `/api/updatePrompt`, `/api/crawlLogs`
- 배포용 빌드 통과. `VERCEL=1`로 띄워 위 API가 막히고 홈이 200인 것을 확인했다.
- DB 권한(RLS) 정비는 이미 적용했다(`4568d5f`). 공개 주소에서 익명 사용자는 공개 행사만 읽는다.

## 배포에 필요한 일 (승인 필요)

| # | 할 일 | 누가·어디서 | 되돌리기 |
|---|---|---|---|
| 1 | Vercel 환경 변수 2개: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production·Preview) | 내가 Vercel CLI로 넣는다(값은 `frontend/.env.local`, 화면에 출력하지 않음). anon 키는 원래 브라우저에 공개되는 키다 | `vercel env rm` |
| 2 | 배포 방식 고르기 (아래 A 또는 B) | - | - |
| 3 | Supabase 인증 URL 설정: Site URL을 `https://pick-art.vercel.app`으로, Redirect URLs에 `https://pick-art.vercel.app/**` 추가. 안 하면 배포 주소에서 구글 로그인 후 localhost로 돌아간다 | 내가 크롬(Supabase 대시보드)에서 바꾼다 | 원래 값으로 되돌림 |
| 4 | 배포 후 확인: 홈·필터·상세·로그인·관리자 화면, 보안(익명 쓰기 거절) | 나 | - |

### 배포 방식

- **A. GitHub 연결 배포 (권장)**: `revive/2026-10`을 GitHub에 푸시하고 `main`에 합친다. Vercel 프로젝트의 Root Directory를 `frontend`로 바꾼다(대시보드, 로그인 필요). 이후 `main`에 푸시할 때마다 자동 배포된다.
- **B. CLI로 지금 바로 배포**: `frontend/` 폴더를 Vercel CLI로 올려 `--prod` 배포한다. GitHub 푸시 없이 지금 코드 그대로 나가지만, GitHub 연결 자동 배포는 여전히 Root Directory 설정 때문에 404로 남는다.

## 배포해도 이 PC에 남는 것

- 파이썬 수집기(하루 두 번 04:00·18:00), 인스타그램 매일 수집, 자동 공개. 결과는 Supabase에 쓰이므로 배포 사이트에 바로 보인다.
- 관리자 화면의 "수집기 켜기/상태", AI 프롬프트 수정은 배포 주소에서는 동작하지 않는다(501 안내). 이 PC의 `localhost:3000`에서 쓴다.

## 배포 전에 알아 둘 것

- 구글 로그인은 테스트 모드다. 등록된 테스트 사용자 3명만 로그인된다. 공개하려면 구글 OAuth 앱을 프로덕션으로 게시해야 하고, 홈페이지·개인정보처리방침 주소가 필요하다.
- 이전 구글 클라이언트 보안 비밀(`****9Grw`)이 아직 사용 설정 상태다.
- 이용약관·개인정보처리방침 페이지가 없다. 회원가입을 받으려면 필요하다.
