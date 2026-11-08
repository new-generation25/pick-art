# Tasks: 공개 출시 준비 보완 (launch-readiness)

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/routes.md](contracts/routes.md), [quickstart.md](quickstart.md)

**Tests**: 자동 테스트는 요청되지 않았다. 각 이야기의 확인은 quickstart.md의 Q 항목으로 한다.

## Phase 1: Setup

- [X] T001 (2026-11-02: 1 account, google only → proceed) Check existing email-password accounts before removing email signup: count `auth.users` by provider (service role, read-only) — if any email-only account exists, stop US4-signup work and report (research R5)
- [X] T002 Add `NEXT_PUBLIC_SITE_URL` handling: `frontend/src/lib/site.ts` exporting `SITE_URL` (env or `https://pick-art.vercel.app` in production, `http://localhost:3000` in dev)

## Phase 2: Foundational

- [X] T003 Create shared footer `frontend/src/components/ui/SiteFooter.tsx` (brand line, Instagram, 이용약관 `/terms`, 개인정보처리방침 `/privacy`) and use it in `frontend/src/app/page.tsx` instead of the inline footer; render it on all public pages via `frontend/src/components/MainLayout.tsx` (not on `/admin`)
- [X] T004 [P] Create `frontend/src/components/ui/LegalLinks.tsx`: "계속하면 이용약관과 개인정보처리방침에 동의하는 것으로 봅니다" with links

## Phase 3: User Story 1 - 약관·처리방침 (P1) 🎯 MVP

**Goal**: 비로그인 방문자가 두 문서를 읽고, 로그인·가입·구독 폼에서 동의·이용 목적을 안내받는다.
**Independent Test**: quickstart Q1~Q4, Q10

- [X] T005 [P] [US1] Write `frontend/src/app/privacy/page.tsx` — sections per research R1 in order; items exactly match the R1 table (이메일, 계정 식별자, 닉네임, 지역, 관심 분야, 알림 설정, 내 지역 자동 적용, 전화번호(선택), 뉴스레터·키워드 이메일); 위탁 Supabase/Vercel/Google; 보호책임자 "pica 운영자 / pick.art.pica@gmail.com"; 시행일 2026-11-02; brand tokens; metadata title "개인정보처리방침 | 피카 pica"
- [X] T006 [P] [US1] Write `frontend/src/app/terms/page.tsx` — 목적, 정의, 회원가입(소셜 로그인), 서비스 내용(행사 정보 큐레이션, 정보는 공식 출처 링크 기준·변경 가능), 이용자 의무, 게시물(향후 제보·후기)의 권리, 서비스 변경·중단, 책임 제한, 분쟁, 시행일 2026-11-02; metadata title "이용약관 | 피카 pica"
- [X] T007 [US1] Add `LegalLinks` under social buttons in `frontend/src/app/login/page.tsx` and on the last step of `frontend/src/app/welcome/page.tsx`
- [X] T008 [US1] Add email-use notice under newsletter and keyword forms in `frontend/src/app/page.tsx` ("소식 발송에만 쓰고, 언제든 그만 받을 수 있어요" + 처리방침 링크)
- [X] T009 [US1] Mark phone as optional in `frontend/src/app/settings/page.tsx` (label "전화번호 (선택)", helper text: 비워 둬도 모든 기능을 쓸 수 있음)

## Phase 4: User Story 2 - 공유 미리보기·검색 (P2)

**Goal**: 공유 미리보기가 사이트 주소 기준으로 나오고, 검색엔진 안내가 있다.
**Independent Test**: quickstart Q5~Q7

- [X] T010 [US2] Set `metadataBase` from `SITE_URL` and default `openGraph`/`twitter` (site name 피카 pica, locale ko_KR) in `frontend/src/app/layout.tsx`
- [X] T011 [P] [US2] Create default share image `frontend/public/og-default.png` (1200×630, brand guide colors/wordmark, no '경남', no AI image) rendered from `docs/brand/og-default.html`; referenced explicitly (`DEFAULT_OG_IMAGE`) because a file-based `app/opengraph-image.png` could take priority over event posters
- [X] T012 [US2] Update `generateMetadata` in `frontend/src/app/events/[id]/page.tsx`: title "{행사} | 피카 pica", description fallback from 기간·장소, image = poster or default, `alternates.canonical`
- [X] T013 [P] [US2] Create `frontend/src/app/robots.ts` per contracts/routes.md (Disallow /admin, /api, /settings, /welcome, /auth; Sitemap line)
- [X] T014 [P] [US2] Create `frontend/src/app/sitemap.ts`: home + PUBLISHED events with `event_date_end >= today(KST)`, lastModified = published_at, `revalidate = 3600`

## Phase 5: User Story 3 - 404·오류 화면 (P3)

**Goal**: 없는 주소·없는/비공개 행사는 404 브랜드 화면, 화면 오류는 다시 시도 화면.
**Independent Test**: quickstart Q8

- [X] T015 [P] [US3] Create `frontend/src/app/not-found.tsx` (brand style, "찾을 수 없는 페이지예요", links: 홈, 이번 주 행사 `/?date=week`)
- [X] T016 [P] [US3] Create `frontend/src/app/error.tsx` (client component, 다시 시도 button calling `reset()`, 홈 링크)
- [X] T017 [US3] Call `notFound()` in `frontend/src/app/events/[id]/page.tsx` when the event is missing (covers 비공개 via RLS)

## Phase 6: User Story 4 - 소셜 로그인만 + 배포 (P4)

**Goal**: 이메일·비밀번호 가입을 닫고, 승인 후 배포해 배포 주소에서 확인한다.
**Independent Test**: quickstart Q9, then Q1~Q11 on the deployed site

- [X] T018 [US4] Remove email/password form from `frontend/src/app/login/page.tsx` (keep SocialLoginButtons, copy: "구글로 계속하기 — 카카오는 곧 추가됩니다" only if brand guide tone allows); depends on T001
- [X] T019 [US4] Replace `frontend/src/app/signup/page.tsx` with a redirect to `/login`; depends on T001
- [X] T020 (2026-11-08: user approved; main fast-forwarded to c76e638, Vercel Ready) [US4] Ask the user for deploy approval, then fast-forward `main` to `revive/2026-10`, push, wait for Vercel Ready

## Phase 7: Polish & Cross-Cutting

- [X] T021 Run `npx tsc --noEmit` in `frontend/` (Q12) and fix errors
- [X] T022 Check brand copy: grep public pages for `경남` brand usage (Q11) and fix
- [X] T023 (2026-11-08: ran on branch preview deploy instead of local) Run quickstart Q1~Q11 on local (3000), record results in `specs/001-launch-readiness/quickstart.md` 결과 절
- [X] T024 After deploy, run quickstart on `https://pick-art.vercel.app` and record results

## Dependencies & Execution Order

- Setup (T001~T002) → Foundational (T003~T004) → US1~US3 (independent of each other) → US4 (T018~T019 need T001; T020 needs all stories + user approval) → Polish.
- Parallel within phases: tasks marked [P] touch different files.
- MVP: Phase 1~3 (US1) alone already enables applying for Google OAuth production (privacy URL).
