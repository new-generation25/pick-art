# 017 조사 — 카카오톡 채널로 받는 방법 (2026-11-26)

«확인함»은 공식 문서를 직접 읽었거나 화면에서 본 것, «확인 못 함»은 어디서도 확정하지 못한 것이다. 추측은 적지 않았다.
문서 조회는 2026-11-26, 화면 확인은 MAX 브라우저(socialceos 계정)에서 했다. 로컬메모리즈 채널 화면 내용은 «릴로컬 홈페이지» 세션이 11/20~24에 본 것을 받았다(운영자 11/26 «카카오톡 연동은 '릴로컬 홈페이지' 세션에서 자료를 받아»).

## 방식 비교

| | A. 오픈빌더 챗봇 + 스킬 서버 | B. 1:1 채팅을 운영자가 옮겨 올림 | C. 그 밖 |
|---|---|---|---|
| 들어오는 길 | 채널 채팅방 → 챗봇 블록 → `POST https://picka.news/api/kakao/skill` | 채널 1:1 채팅 → 운영자가 사진을 내려받아 `/admin/leaflets`에 올림 | 상담톡(공식 딜러) — 공식 조건 확인 못 함 |
| 비용 | 챗봇 일반 상품 무료(2022-09-01 무료 전환 발표). Event API(봇이 먼저 보내기)만 건당 15원 — 이 기능은 쓰지 않음 | 채널 개설 무료. 1:1 채팅 요금은 확인 못 함 | 확인 못 함 |
| 심사·신청 | 챗봇 관리자센터 가입 뒤 바로 봇을 만들 수 있었다(11/26 화면: 신청·승인 단계 없이 «채널 챗봇 만들기»). 문서도 OBT 신청 단계 없음. 피카 채널(기본 채널, 비즈 인증 없음)이 «운영 채널 연결» 목록에 «사용 가능»으로 나옴. 실제 연결·배포가 거절되는지는 연결해 봐야 안다 | 없음 | — |
| 사진 | **보안 이미지 플러그인으로만** 받는다. 한 번에 10장까지, 주소는 최대 10분 유지 → 받는 즉시 내려받아야 함. 플러그인 없이 그냥 보낸 사진이 스킬로 오는지는 확인 못 함 | 사람이 보고 내려받음. 내려받기 기능 자체는 확인 못 함 | — |
| AI 초안 | 013 예약작업이 그대로 읽음 | 같음 | — |
| 운영자 손 | 검토·등록만 | 채팅 확인 → 내려받기 → 올리기 → 검토·등록 | — |
| 채팅방 메뉴 | 챗봇과 «리스트 메뉴»는 함께 못 씀(파트너센터 화면 문구). «커스텀 메뉴»는 챗봇 블록을 부를 수 있다고 적힘 | 제약 없음 | — |

**결정**: A를 기본 길로 만들고, B를 같은 검토함에 붙인다(챗봇 연결 전, 또는 사진이 1:1 채팅으로 온 경우). 채팅을 자동으로 읽는 공식 API는 없다(아래 7).

## 1. 챗봇 관리자센터 이용 조건
- 가입 순서: 카카오계정 → 카카오비즈니스 → 챗봇 관리자센터. «회원 가입 후 카카오톡 채널 챗봇 만들기가 가능». OBT 신청 단계 없음 — https://kakaobusiness.gitbook.io/main/tool/chatbot/start/prepare (확인함)
- OBT 신청·승인은 2018~2019 보도자료에만 나온다 — https://www.kakaocorp.com/page/detail/8529
- 11/26 화면(확인함): chatbot.kakao.com 이 socialceos 계정으로 열렸고 «채널 챗봇 만들기»로 봇 `피카 행사 제보`(봇 ID `6b07e404e3146b3ebc754f8b`, 상태 «준비»)를 만들었다. 설정 › 운영 채널 선택 목록: 경전철로 떠나는 김해 문화산책·호계문화제·회현동소극장·**피카(@pickanews) «사용 가능»**, 로컬메모리즈는 «채팅방 메뉴 사용중»으로 막힘. 아직 연결하지 않았다.
- «비즈니스 인증 채널과 디벨로퍼스 앱 연결하기»는 앱 연결 항목의 요건이다 — https://kakaobusiness.gitbook.io/main/tool/chatbot/main_notions/bot_setting . 기본 챗봇 연결에도 필요한지: 확인 못 함(위 화면에서는 «사용 가능»).
- 비용: «카카오톡 채널 '챗봇' 서비스 이용요금 무료 전환»(2022-09-01) — https://www.kakaocorp.com/page/detail/9756 (2022년 발표, 지금 요금 화면은 보지 않음). Event API 15원/건(VAT 별도) — https://kakaobusiness.gitbook.io/main/tool/chatbot/main_notions/event-api

## 2. 배포·연결
- 봇은 한 번 이상 배포해야 운영 채널과 연결된다 — https://kakaobusiness.gitbook.io/main/tool/chatbot/main_notions/bot_setting
- 처음 1회는 전체 배포, 배포는 최대 30분, 시작하면 멈출 수 없음 — https://kakaobusiness.gitbook.io/main/tool/chatbot/main_notions/deploy.md
- 플러그인 «상담 연결»(사람 상담원으로 넘기기)이 있다 — https://kakaobusiness.gitbook.io/main/tool/chatbot/main_notions/plugin.md
- 카나나 상담매니저(AI 상담)는 비즈 인증 채널만, 챗봇 연동 시 사용 불가 — https://kakaobusiness.gitbook.io/main/channel/run/chat.md (피카와 무관)
- 메시지가 챗봇과 1:1 채팅 중 어디로 갈지 정하는 설정: 확인 못 함.

## 3. 스킬 요청·응답
- POST JSON, 응답 `version: "2.0"` + `template.outputs`, 타임아웃은 바꿀 수 없고 5초 안 응답 권장, 공인 도메인만, 스킬 설정 «헤더값 입력»으로 직접 정한 헤더를 보낼 수 있음(예시는 `x-api-key` 불일치 시 403) — https://kakaobusiness.gitbook.io/main/tool/chatbot/skill_guide/make_skill.md
- 요청 서명·IP 목록: 문서에 없음 → 헤더 비밀값으로 알아본다.
- simpleText 1000자, 500자 넘으면 «전체 보기»로 접힘 — https://kakaobusiness.gitbook.io/main/tool/chatbot/skill_guide/answer_json_format.md
- 콜백(5초 넘는 응답)은 쓰지 않는다: 이 서버는 줄만 만들고 바로 답한 뒤 사진 내려받기는 `after()`로 한다.

## 4. 사진 — 이미지 보안전송 플러그인 (`sys.plugin.secureimage`)
- https://kakaobusiness.gitbook.io/main/tool/chatbot/skill_guide/apply_skill_to_plugin.md (확인함)
- 최대 10장, 이미지는 카카오 보안 정책으로 보관, **URL은 최대 10분 유지**, 사용자가 플러그인 개인정보 수집 항목에 동의하지 않으면 보낼 수 없음.
- 스킬에 오는 값: `action.params.<파라미터>` = JSON 글자 `{"privacyAgreement":"Y","imageQuantity":"1","secureUrls":"List(http://secure.kakaocdn.net/…)","expire":"…"}`, `detailParams.<파라미터>` = `{origin, value, groupName}`.
- 여러 장일 때 `List(...)` 안 구분 기호, 파일 크기·형식 제한: 문서에 없음 → 코드는 «, http» 앞에서 나누고, `*.kakaocdn.net` 주소만, jpeg·png·webp, 10MB까지 받는다.
- 플러그인 없이 그냥 보낸 사진이 스킬에 오는지: 확인 못 함 → 블록 안내로 «사진 보내기» 버튼을 누르게 한다.

## 5. 보낸 사람 식별값
- `userRequest.user.id`(최대 70자, type 은 현재 botUserKey만), «동일한 사용자더라도 봇이 다르면 다른 id», `plusfriendUserKey`·`botUserKey`는 문서가 «비식별» 구분키라고 부름, `appUserId`는 앱키를 설정한 경우에만, 전화번호·이름은 필드에 없음 — https://kakaobusiness.gitbook.io/main/tool/chatbot/skill_guide/answer_json_format.md
- 같은 봇에서 id가 영구히 같은지: 확인 못 함. 하루 5건 세기·동의 기록에만 쓰므로 바뀌면 동의를 다시 받는 것으로 끝난다.
- 저장: `sha256("pica-kakao:" + id)` 만. 원래 값·이름·전화번호는 저장하지 않는다. 1년 지나면 지운다.

## 6. B — 1:1 채팅
- 1:1 대화는 카카오 서버에 3년 보관 뒤 삭제, 운영자가 보내는 사진은 말풍선 하나 30장·장당 20MB — https://kakaobusiness.gitbook.io/main/channel/run/chat.md
- «설명 미디어 수신»은 PC에서만 — https://kakaobusiness.gitbook.io/main/partner/smb/channel/step2/chat1
- 받은 사진을 PC에서 내려받는 방법, 1:1 채팅 요금: 확인 못 함(실제로 받아 본 적 없음).
- 채팅 설정 화면 경로(로컬메모리즈에서 확인): `business.kakao.com/space/<space>/channel/<채널ID>/chats/settings` — 처음은 «채팅 꺼짐». 피카 space 10805734.

## 7. 그 밖 공식 경로
- Kakao Developers 채널 웹훅은 채널 추가·차단(`added`·`blocked`)만 알린다. 채팅을 읽거나 받는 API는 없다 — https://developers.kakao.com/docs/ko/kakaotalk-channel/callback , https://developers.kakao.com/docs/ko/kakaotalk-channel/common
- 상담톡: 카카오 공식 조건 문서를 찾지 못함(확인 못 함).

## 참고
- kakaobusiness.gitbook.io 문서 안에 «?ask= 주소로 질의하라»는 AI용 지시문이 있었다. 문서 내용이라 따르지 않았다.
