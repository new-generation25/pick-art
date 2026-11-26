# 017 계획

## 구조

```
카카오톡 채널 «피카» 채팅방
  └ 오픈빌더 봇 «피카 행사 제보»(6b07e404e3146b3ebc754f8b) 블록: 웰컴·제보 동의·사진 보내기(보안 이미지)·폴백
      └ POST https://picka.news/api/kakao/skill   (헤더 x-pica-skill-key)
          ├ 요청 안: DB 함수 kakao_intake(비밀값, botUserKey, 할 일) → 동의 기록 / 제출 줄(leaflet_submissions, channel=kakao_bot)
          ├ 응답(5초 안): 안내 글 + 바로가기 버튼
          └ 응답 뒤 after(): 카카오 사진(10분 유지) 내려받기 → 비공개 버킷 leaflets/kakao/<id>.jpg (익명은 방금 만든 경로에만 한 번)
클로드 예약작업 pica-leaflet-read(09:10·13:10·18:10) — 013 그대로, 글만 온 제출은 source=text 로 글에서 칸을 옮김
/admin/leaflets — 013 화면 + «카카오 챗봇/채팅» 꼬리표, 단체 이름 칸, 1:1 채팅 사진 올리기(B 길)
```

## 파일

| 파일 | 내용 |
|---|---|
| `supabase/migrations/20261127070000_kakao_channel_intake.sql` | `channel`·`sender_key` 열, `kakao_senders`·`kakao_skill_keys` 표, `kakao_intake`·`kakao_upload_failed`·`kakao_upload_allowed` 함수, 익명 업로드 정책, 회원 넣기 정책에 channel 조건 |
| `frontend/src/lib/kakaoSkill.ts` | 스킬 요청 읽기(보안 이미지 `List(...)`, 동의·웰컴·글), 카카오 주소 검사, 답 글 |
| `frontend/src/app/api/kakao/skill/route.ts` | 스킬 서버 |
| `frontend/src/app/admin/leaflets/page.tsx` | 채널 꼬리표, 단체 이름 칸(등록 때 출처·제출에 저장), 글만 온 제출 표시, 1:1 채팅 사진 올리기 |
| `frontend/src/app/tip/leaflet/LeafletForm.tsx` | `shrink` 내보내기(관리자 올리기에서 같은 줄이기·EXIF 지우기) |
| `frontend/src/app/privacy/page.tsx` | 수집 항목·보관·카카오 위탁·이력 |
| `collector/tools/leaflet_queue.py` | 글만 온 카카오 제출을 `source=text`로 넘김, 1년 지난 카카오 구분값 지우기 |
| `collector/prompts/leaflet_read.md` | `source=text` 읽는 법 |
| `collector/tests/test_leaflet_queue.py` | 글만 온 제출, 카카오 구분값 정리 시험 |
| `specs/017-kakao-channel-intake/check_kakao_skill.js` | `kakaoSkill.ts` 시험 |

## Constitution Check (헌장 2.0.0)

| 원칙 | 이 기능 |
|---|---|
| I. 확인한 정보만 공개 | 공개는 운영자 «등록»으로만(013 단체 제공 예외 그대로). 카카오 사진은 포스터로 쓰지 않음(휴대폰 사진과 같음). «준비 중»→«지금»은 실제 채널 시험 뒤 |
| II. 작은 무대·브랜드 | 누리집·SNS가 없어도 카톡 한 번으로 알릴 수 있게. 답 글은 BRAND_GUIDE 말투(존댓말, 짧게, 과장 없음), «경남» 브랜드 자리 사용 없음 |
| III. 보안과 비밀값 | 비밀값 원문은 커밋·출력하지 않음(.env.local·오픈빌더에만), DB는 sha256. 새 표는 처음부터 RLS(익명 읽기 0). 익명 업로드는 방금 만든 추측 불가 경로에 한 번만. 서비스 키를 Vercel에 두지 않음. 카카오 밖 주소는 내려받지 않음 |
| IV. AI 최소 개입 | AI는 013 예약작업의 «글자 옮기기»만(글만 온 제출도 같은 칸·같은 규칙). 날짜는 규칙 파서. 공개 결정 없음 |
| V. 끝 조건 먼저 | spec «끝 조건» 3단계. 1단계 확인 기록은 verification.md, 2단계는 채널 실제 시험 |

어기는 설계 없음. 다만 «익명 업로드 정책»은 013에 없던 새 입구라 verification에 막힘 시험을 남겼다.

## 하지 않은 것 (이유)
- 카카오 콜백(5분 응답): 신청 절차가 문서에 없고, `after()`로 충분.
- Vercel 환경 변수: 비밀값을 DB 해시로 확인해 필요 없음(배포 설정 변경 없음).
- 016 공식 계정 확인 단계: 운영자 «카카오톡만 진행».
