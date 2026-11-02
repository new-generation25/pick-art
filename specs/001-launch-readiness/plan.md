# Implementation Plan: 공개 출시 준비 보완 (launch-readiness)

**Branch**: `revive/2026-10` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-launch-readiness/spec.md`

## Summary

배포된 공개 사이트에 ① 이용약관·개인정보처리방침 페이지와 동의 안내, ② 배포 주소 기준 공유 미리보기·robots·sitemap, ③ 브랜드 404·오류 화면을 더하고, ④ 이메일·비밀번호 가입을 빼 소셜 로그인만 남긴 뒤, 사용자 승인을 받아 main에 반영(자동 배포)한다. 데이터 구조 변경은 없다(전화번호는 기존 칸 유지, '선택' 표시만).

## Technical Context

**Language/Version**: TypeScript 5, React 19 (Next.js 16.1 App Router)

**Primary Dependencies**: Next.js(Metadata API, `sitemap.ts`/`robots.ts` 파일 규약, `not-found.tsx`/`error.tsx`), Mantine 7, Tailwind 4, @supabase/supabase-js

**Storage**: Supabase(Postgres, RLS) — 이번 기능은 읽기만(sitemap 행사 목록). 스키마 변경 없음

**Testing**: `npx tsc --noEmit`, 로컬 개발 서버(webpack, 3000) 화면 확인, 배포 후 `curl`로 상태 코드·메타 태그 확인. 자동 테스트 스위트는 없음

**Target Platform**: Vercel(icn1, 루트 `frontend`), 모바일 우선 브라우저

**Project Type**: web application (frontend + 로컬 수집기). 이번 변경은 `frontend/`만

**Performance Goals**: 법적 문서·404는 정적 페이지. sitemap은 요청 시 생성하되 1시간 캐시

**Constraints**: 개발 서버는 webpack·힙 2GB·하나만. 배포는 사용자 승인 후. 브랜드 가이드 준수('경남' 금지). 비밀값 출력 금지

**Scale/Scope**: 새 페이지 4개(약관, 처리방침, 404, 오류), 메타 파일 2개(robots, sitemap), 기존 화면 6곳 수정(레이아웃, 꼬리말, 로그인, 가입, 설정, 가입 3단계, 행사 상세)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 확인 | 결과 |
|---|---|---|
| I. 확인한 정보만 공개 | 처리방침의 수집 항목을 코드·DB에서 실제로 받는 항목과 대조해 작성(SC-002). sitemap은 공개 피드와 같은 조건(공개·진행 중/예정)만 | ✅ |
| II. 작은 무대·브랜드 가이드 | 새 화면은 리소 테마 토큰·글꼴 사용, '경남' 미사용(FR-011, SC-006). 문서 톤은 가이드 7절 | ✅ |
| III. 보안과 비밀값 | 법적 문서·메타에 비밀값 없음. robots에서 관리자·API 제외. 배포는 승인 후(FR-012). 비공개 행사는 RLS로 이미 익명 차단 → 상세에서 404 처리 | ✅ |
| IV. AI 최소 개입 수집 | 해당 없음(수집기 변경 없음) | ✅ N/A |
| V. 끝 조건·검증 | quickstart.md에 확인 절차(상태 코드·메타·링크 수)를 정의하고 converge에서 대조 | ✅ |

위반 없음 → Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/001-launch-readiness/
├── plan.md              # 이 문서
├── research.md          # Phase 0
├── data-model.md        # Phase 1 (문서·메타 구조)
├── quickstart.md        # Phase 1 (확인 절차)
├── contracts/routes.md  # Phase 1 (공개 경로 계약)
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
frontend/
├── src/app/
│   ├── layout.tsx                 # metadataBase=배포 주소, 기본 openGraph/twitter
│   ├── page.tsx                   # 꼬리말에 약관·방침 링크 (공용 꼬리말 컴포넌트로)
│   ├── terms/page.tsx             # 새: 이용약관
│   ├── privacy/page.tsx           # 새: 개인정보처리방침
│   ├── not-found.tsx              # 새: 브랜드 404
│   ├── error.tsx                  # 새: 오류 화면(다시 시도)
│   ├── robots.ts                  # 새
│   ├── sitemap.ts                 # 새 (공개·진행 중/예정 행사)
│   ├── opengraph-image.png        # 새: 서비스 대표 미리보기 이미지(1200×630, 브랜드 가이드)
│   ├── events/[id]/page.tsx       # 없거나 비공개면 notFound(), 메타 제목 브랜드 표기 정리
│   ├── login/page.tsx             # 이메일·비밀번호 폼 제거, 동의 안내
│   ├── signup/page.tsx            # /login 으로 이동
│   ├── welcome/page.tsx           # 동의 안내 링크
│   └── settings/page.tsx          # 전화번호 '선택' 표시
└── src/components/ui/
    ├── SiteFooter.tsx             # 새: 공용 꼬리말(브랜드·인스타·약관·방침)
    └── LegalLinks.tsx             # 새: "계속하면 … 동의" 안내 + 링크
```

**Structure Decision**: 기존 Next.js App Router 구조에 파일 규약(`not-found`, `error`, `robots`, `sitemap`, `opengraph-image`)을 그대로 쓴다. 법적 문서 본문은 페이지 파일 안의 정적 JSX(서버 컴포넌트)로 두어 빌드 시 정적 생성된다.

## Complexity Tracking

해당 없음.
