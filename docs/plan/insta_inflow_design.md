# 인스타 → 피카 앱 유입: 링크·utm 설계안

작성: 피카 앱 개선 세션 · 요청: 인스타 운영 세션(운영자 11/26 결정 「자동 처리」) · 상태: **B 단계 완료(11/26, 운영자 승인 「Add the columns」), C·D는 대기**

> **바뀜 11/26 (운영자)**: 「인스타 따로 구분하지 말고 합쳐」 「원본 소스에만 아이콘으로(나에게 보이는 대시보드에서)」 「사람들은 정보의 출처가 중요하지는 않고 정보가 중요하지」 → `/insta` 페이지와 상세의 공개 링크를 없앴다. 방문자에게는 인스타 구분이 보이지 않고, **관리자로 로그인했을 때만** 상세 「출처」 줄 옆에 인스타 아이콘(피카 게시물 링크)이 보인다(`components/ui/AdminInstaMark.tsx`, 커밋 0c72cb5, 배포 확인). 프로필 링크(D)는 홈 주소 `https://pick-art.vercel.app/?utm_source=instagram&utm_medium=social&utm_campaign=profile`로 한다. 아래 ②의 `/insta` 추천과 ④의 「피카 인스타에서 보기」는 이 결정으로 대체됐다.
>
> 진행 11/26 (C, 위 결정으로 대체): 상세 「피카 인스타에서 보기」(insta_post_url 있는 행사만, 새 창)와 `/insta` 모음 페이지(최근 14일, 소개한 날 최신순, 지역 칩) 구현. `npm run build` 통과, 로컬 화면 확인(데스크톱·375px 가로 넘침 없음). **main 병합(배포) 전.** D(프로필 링크를 `https://pick-art.vercel.app/insta?utm_source=instagram&utm_medium=social&utm_campaign=profile`로 교체)는 배포 뒤 운영자 승인으로 인스타 세션이 한다.
>
> 진행 11/26: `events.insta_post_url`·`insta_posted_at` 적용(`supabase/migrations/20261126000000_events_insta_post.sql`), `collector/tools/sync_insta_posts.py`를 정기 수집에 연결. 첫 반영 소개한 행사 110 중 공개 행 95 채움, 15개는 posted.json의 event_id가 숨긴(HIDDEN) 행이라 반영 안 함.

## 전제 (확인한 것)

- **캡션·카드에는 링크를 넣지 않는다**(브랜드 가이드 5-5·5-6, 2026-11-21). 그래서 인스타에서 눌리는 곳은 **프로필 링크뿐**이다. 스토리 링크 스티커는 당분간 쓰지 않는다.
- 캡션은 이미 «이번 주 다른 공연·전시는 프로필 링크(피카 사이트)에서 지역별로 볼 수 있어요»라고 보낸다(브랜드 가이드 5-6).
- 홈은 이미 `/?region=김해`처럼 주소로 지역을 받는다(`app/page.tsx`).
  - 로그인 회원의 «내 지역 자동 적용»은 주소에 `region`이 없을 때만 걸린다(`FilterBar.tsx`).
  - 필터를 바꿔도 주소의 다른 값(utm 포함)은 남는다.
- 행사 상세 `/events/<id>`는 공개(PUBLISHED) 행만 읽힌다(RLS). 숨긴 행(HIDDEN)은 404다.
  - 상세의 `canonical`은 utm 없는 `/events/<id>`라서 utm이 붙어도 공유·검색 주소가 갈라지지 않는다.
- Vercel Web Analytics가 이미 켜져 있다(`app/layout.tsx`, 쿠키 없음).

## ① 행사 상세 주소 형식

```
https://pick-art.vercel.app/events/<events.id>?utm_source=instagram&utm_medium=social&utm_campaign=<자리>&utm_content=<게시물 코드>
```

| 값 | 쓰는 것 |
|---|---|
| utm_source | `instagram` (고정) |
| utm_medium | `social` (고정) |
| utm_campaign | 링크가 놓인 자리: `profile` · `story` · `reel` · `post` |
| utm_content | 인스타 게시물 코드(예: `DfzXqXxFPOl`, `/p/` 뒤 글자). 없으면 뺀다 |

- **개인 정보는 넣지 않는다.** 계정 이름, 댓글 단 사람, DM 상대는 넣지 않는다. 게시물 코드는 공개 주소의 일부라 괜찮다.
- `events.id`는 **PUBLISHED 행**의 UUID여야 한다. 같은 공연이 겹쳐 하나를 HIDDEN으로 숨겼다면 남은 행의 id를 쓴다.
  - 쓰기 전에 그 id가 공개 행인지 확인하는 단계를 둔다(익명 키로 `events?id=eq.<id>&select=id` → 1줄).
- 지금은 캡션에 링크를 넣지 않으므로 이 형식이 실제로 쓰이는 곳은 스토리 스티커(나중)와 아래 ②의 모음 페이지 안이다.

## ② 프로필 링크

**지금 바로 가능 (코드 변경 없음):**

```
https://pick-art.vercel.app/?utm_source=instagram&utm_medium=social&utm_campaign=profile
```

- 지역을 고정하지 않는다. 처음 온 방문자는 지역 칩으로 고르고, 로그인 회원은 자기 지역이 자동 적용된다.
- 지역별 링크도 지금 된다: `/?region=김해&utm_source=instagram&utm_medium=social&utm_campaign=profile`.
  - 한글은 주소에서 `%EA%B9%80%ED%95%B4`로 바뀐다.
  - 인스타 프로필은 링크를 여러 개 넣을 수 있다. 몇 개까지인지는 프로필 편집 화면에서 확인해야 한다(확인 못 함).

**추천 (코드 변경, 승인 필요): «인스타에서 본 행사» 모음 페이지 `/insta`**

- 캡션을 보고 프로필 링크를 누른 사람은 **방금 본 그 행사**를 찾는다. 지금 홈은 그 행사를 찾을 실마리가 없다.
- 최근 14일에 피카 인스타에 소개한 행사를 게시일 최신순으로 보여 주고, 지역 칩을 둔다. 각 카드는 상세로 간다.
- 프로필 링크는 이 페이지 하나로: `https://pick-art.vercel.app/insta?utm_source=instagram&utm_medium=social&utm_campaign=profile`
- 필요한 데이터: 어느 행사를 언제 어느 게시물로 소개했는지가 **공개로 읽혀야** 한다. 지금은 이 PC의 `docs/insta/posted.json`에만 있다. → ④와 같은 칸을 쓴다.

## ③ 유입을 어디서 세나

1. **Vercel Web Analytics (이미 켜짐)**: 방문을 utm_source·utm_medium·utm_campaign·utm_content 기준으로 집계한다(Vercel 문서, Web Analytics API의 `utmSource`·`utmCampaign` 차원).
   - **이 계정의 무료 플랜 화면에 UTM 패널이 보이는지는 확인하지 못했다.** Vercel 대시보드 → pick-art → Analytics에서 확인한다.
   - 안 보이면 같은 화면의 «Referrers»에서 `l.instagram.com`·`instagram.com`으로 들어온 방문을 본다. 인스타 앱 안 브라우저는 이 리퍼러로 들어온다.
2. **앱 운영 대시보드(/admin)에 붙이기**는 나중에 한다.
   - Vercel Web Analytics API를 서버에서 부르려면 Vercel 토큰을 서버 비밀값으로 둬야 한다.
   - 1번으로 숫자를 몇 주 본 뒤 필요하면 별도 승인을 받아 붙인다.
3. 앱 안에서 직접 세는 방식(우리 DB에 방문 기록)은 하지 않는다. 개인 정보와 쿠키 고지가 늘어난다.

## ④ 상세에 «피카 인스타에서 보기»

- **추천: 넣는다. 다만 소개한 행사에만, 작게 둔다.**
  - 자리: 상세의 공유 버튼 옆, 글자 링크 «피카 인스타에서 보기 ↗»
  - 효과: 출처 확인(브랜드 «믿고 보는 지역 채널»)과 팔로우로 이어진다.
  - 위험: 앱 밖으로 나가는 문이 하나 늘어난다. 새 창으로 열어 막는다.
- 필요한 데이터 칸(②와 공용, **스키마 변경이라 운영자 승인 필요**):
  - `events.insta_post_url text`: 피카 인스타 게시물 주소. 공개 행이면 익명이 읽어도 된다. 이미 공개된 인스타 게시물 주소다.
  - `events.insta_posted_at date`: 게시일. 모음 페이지의 정렬·14일 범위에 쓴다.
- 채우는 방법: **정기 수집이 끝날 때 `docs/insta/posted.json`을 읽기만 해서 DB에 반영한다.**
  - 인스타 세션의 도구(`insta_state.py` 등)는 고치지 않는다.
  - posted.json의 `event_id`가 HIDDEN 행을 가리키면 반영하지 않고 경고로 남긴다(«인스타 기록이 숨긴 행을 가리킴»). 대시보드에 보인다.
  - 한 행사를 여러 번 소개했으면 최신 게시물로 채운다.

## 순서와 승인

| 단계 | 내용 | 승인 |
|---|---|---|
| A (지금) | 인스타 프로필 링크를 ②의 «지금 바로 가능» 주소로 바꿈 | 프로필 변경이라 운영자 승인 — 인스타 세션이 한다 |
| B | `events.insta_post_url`·`insta_posted_at` 칸 + 정기 실행 동기화 | **스키마 변경 승인** |
| C | 상세의 «피카 인스타에서 보기» + `/insta` 모음 페이지 | main 병합(배포) 승인 |
| D | 프로필 링크를 `/insta?utm…`로 교체 | 운영자 승인 |

- **끝 조건:**
  - A: 프로필 링크로 들어간 방문이 Vercel Analytics에 `utm_campaign=profile`(또는 리퍼러 instagram)로 1건 이상 잡힌다.
  - B: posted.json의 공개 행 수와 `insta_post_url`이 채워진 공개 행 수가 같다.
  - C: 소개한 행사 상세에만 링크가 보인다. `/insta` 첫 카드가 posted.json 최신 게시 행사다.
- **되돌리기:**
  - B: 칸 두 개를 버리는 `ALTER TABLE … DROP COLUMN` 한 줄. 행사 데이터는 그대로다.
  - C: `git revert` 또는 Vercel 이전 배포로 되돌린다.
