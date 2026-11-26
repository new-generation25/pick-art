/**
 * 카카오톡 채널로 행사 정보 받기 (specs/017). 카카오 i 오픈빌더(챗봇 관리자센터) 스킬 요청을 읽고 답을 만든다.
 * 화면·DB 없이 시험할 수 있게 순수 함수만 둔다. 실제 저장은 app/api/kakao/skill/route.ts → DB 함수 kakao_intake().
 *
 * 공식 문서(2026-11-26 확인): 요청은 POST JSON, 응답은 version "2.0" + template.outputs, 5초 안에 답하라고 권장.
 * 사진은 두 길로 온다.
 *  1) 채팅창에 그냥 보낸 사진: 폴백 블록에 발화(utterance)로 사진 주소(https://talk.kakaocdn.net/dna/…)가 온다.
 *     공식 문서에는 없고 2026-11-26 운영자 PC 시험에서 확인(보낸 지 15분 뒤에도 200 image/png). 운영자 요청(«일반 채팅하듯이»)으로 이 길을 안내한다
 *  2) «이미지 보안전송 플러그인»(sys.plugin.secureimage): 최대 10장, 주소 최대 10분 유지. 값은 JSON 글자
 *     {"privacyAgreement":"Y","imageQuantity":"1","secureUrls":"List(http://secure.kakaocdn.net/…)","expire":"…"}
 *     보낸 사진이 채팅방에 보이지 않아(운영자 시험) 안내하지 않지만, 블록은 남겨 둔다
 * https://kakaobusiness.gitbook.io/main/tool/chatbot/skill_guide/apply_skill_to_plugin.md
 * https://kakaobusiness.gitbook.io/main/tool/chatbot/skill_guide/answer_json_format.md
 *
 * 채널로 오는 말은 제보만이 아니다(운영자 11/26 «일반 사용자들도 있잖아», «제보는 메뉴형태로»).
 * «행사 알리기»를 누른 뒤 30분 동안 보낸 사진·글만 제보로 받는다(DB kakao_senders.tip_until).
 * 그 밖의 말은 저장하지 않고 «운영자에게 문의»(버튼 action "operator" = 상담 연결, 채널 1:1 채팅으로 넘김)·«행사 알리기»를 보인다.
 */
import { RIGHTS_CHECKS, RIGHTS_VERSION, PRIVACY_NOTE } from "./leaflets";

export const SKILL_KEY_HEADER = "x-pica-skill-key";
/** 동의 버튼이 보내는 말. 오픈빌더 «제보 동의» 블록의 발화와 같아야 한다 */
export const AGREE_TEXT = "동의하고 보내기";
/** 사진 받기 버튼이 보내는 말. 오픈빌더 «사진 보내기» 블록(보안 이미지 파라미터)의 발화와 같아야 한다 */
export const PHOTO_TEXT = "사진 보내기";
/** 제보 메뉴. 웰컴 카드 버튼·채팅방 메뉴가 보내는 말 */
export const TIP_TEXT = "행사 알리기";
const TIP_WORDS = new Set([TIP_TEXT, "제보", "제보하기", "행사 제보", PHOTO_TEXT, "리플렛 보내기", "포스터 보내기"]);
/** 오픈빌더 «행사 알리기» 블록 이름. 이 블록에서 온 요청은 발화와 상관없이 제보 시작으로 읽는다 */
export const TIP_BLOCK = "행사 알리기";
/** 상담 연결 버튼 이름(스킬 응답 버튼 action "operator") */
export const OPERATOR_LABEL = "운영자에게 문의";
/** 채팅방 메뉴 «운영자 문의»가 부르는 오픈빌더 블록 이름. 채팅방 메뉴는 상담 연결을 직접 못 걸어서(연결 종류: URL·챗봇·소식·쿠폰·채널 프로필·QR)
 *  이 블록이 상담 연결 버튼 카드로 답한다 */
export const ASK_BLOCK = "운영자 문의";
const ASK_WORDS = new Set([OPERATOR_LABEL, ASK_BLOCK, "문의", "문의하기", "상담", "상담원 연결", "운영자 연결"]);
export const MAX_IMAGES = 10;
/** 카카오에서 내려받을 때 상한(PC에서 보낸 원본 PNG 7.5MB 확인). 저장 전에 긴 변 2048px JPEG 로 줄인다 */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export type SkillAction =
    | { kind: "welcome" }
    | { kind: "agree" }
    | { kind: "tip" }
    | { kind: "ask" }
    /** plugin: 보안 이미지 플러그인(«사진 보내기» 블록)으로 온 사진 — 그 블록을 부른 것 자체가 제보 뜻이다 */
    | { kind: "image"; urls: string[]; plugin?: boolean }
    | { kind: "text"; text: string };

export type SkillRequest = { userKey: string; action: SkillAction };

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** 카카오 이미지 주소만 받는다(다른 곳 주소를 서버가 대신 내려받지 않게) */
export function isKakaoImageUrl(u: string): boolean {
    try {
        const url = new URL(u);
        return (url.protocol === "https:" || url.protocol === "http:") && /(^|\.)kakaocdn\.net$/i.test(url.hostname);
    } catch {
        return false;
    }
}

/** «List(url1, url2)» 또는 배열 → 주소 목록. 여러 장일 때 구분 기호는 문서에 없어 «, http» 앞에서 나눈다 */
export function parseSecureUrls(v: unknown): string[] {
    let list: string[] = [];
    if (Array.isArray(v)) list = v.map(str);
    else {
        const s = str(v).trim();
        const inner = s.replace(/^List\(/, "").replace(/\)$/, "");
        list = inner.split(/,\s*(?=https?:\/\/)/);
    }
    return list.map(x => x.trim()).filter(isKakaoImageUrl).slice(0, MAX_IMAGES);
}

/** 파라미터 값 하나가 보안 이미지 플러그인 값이면 주소 목록, 아니면 null */
function secureImageUrls(v: unknown): string[] | null {
    let o: Json | null = null;
    if (typeof v === "string" && v.includes("secureUrls")) {
        try { o = obj(JSON.parse(v)); } catch { o = null; }
    } else if (v && typeof v === "object") {
        const vo = obj(v);
        if ("secureUrls" in vo) o = vo;
        else if (typeof vo.value === "string" && vo.value.includes("secureUrls")) {
            try { o = obj(JSON.parse(vo.value)); } catch { o = null; }
        }
    }
    if (!o || !("secureUrls" in o)) return null;
    if (str(o.privacyAgreement) && str(o.privacyAgreement) !== "Y") return [];
    return parseSecureUrls(o.secureUrls);
}

/** 스킬 요청 → 보낸 사람 식별값(botUserKey)과 할 일. 모양이 틀리면 null */
export function parseSkillRequest(body: unknown): SkillRequest | null {
    const b = obj(body);
    const ur = obj(b.userRequest);
    const user = obj(ur.user);
    const props = obj(user.properties);
    const userKey = str(user.id) || str(props.botUserKey) || str(props.plusfriendUserKey);
    if (!userKey || userKey.length > 200) return null;

    const action = obj(b.action);
    for (const bag of [obj(action.params), obj(action.detailParams)]) {
        for (const v of Object.values(bag)) {
            const urls = secureImageUrls(v);
            if (urls) return { userKey, action: { kind: "image", urls, plugin: true } };
        }
    }
    const utterance = str(ur.utterance).trim();
    const blockName = str(obj(ur.block).name);
    // 채팅창에 그냥 보낸 사진: 발화가 카카오 사진 주소뿐이면 사진으로 받는다
    const words = utterance.split(/\s+/).filter(Boolean);
    if (words.length > 0 && words.length <= MAX_IMAGES && words.every(isKakaoImageUrl)) {
        return { userKey, action: { kind: "image", urls: words } };
    }
    if (utterance === AGREE_TEXT) return { userKey, action: { kind: "agree" } };
    if (TIP_WORDS.has(utterance) || blockName === TIP_BLOCK) return { userKey, action: { kind: "tip" } };
    if (ASK_WORDS.has(utterance) || blockName === ASK_BLOCK) return { userKey, action: { kind: "ask" } };
    if (/웰컴|welcome/i.test(blockName) || !utterance) return { userKey, action: { kind: "welcome" } };
    return { userKey, action: { kind: "text", text: utterance.slice(0, 1000) } };
}

// ---------- 답 ----------

type QuickReply = { label: string; action: "message"; messageText: string };
type Button = { label: string; action: "message"; messageText: string } | { label: string; action: "operator" };
type Output = { simpleText: { text: string } } | { textCard: { title: string; description: string; buttons: Button[]; buttonLayout: "vertical" } };
export type SkillResponse = { version: "2.0"; template: { outputs: Output[]; quickReplies?: QuickReply[] } };

const qr = (label: string): QuickReply => ({ label, action: "message", messageText: label });

export function reply(texts: string[], quick: string[] = []): SkillResponse {
    return {
        version: "2.0",
        template: {
            outputs: texts.slice(0, 3).map(t => ({ simpleText: { text: t.slice(0, 1000) } })),
            ...(quick.length ? { quickReplies: quick.map(qr) } : {}),
        },
    };
}

/** 두 갈래 카드: 운영자 상담 연결 · 행사 알리기 (textCard 단일형은 제목+설명 400자까지) */
function menu(title: string, description: string): SkillResponse {
    return {
        version: "2.0",
        template: {
            outputs: [{
                textCard: {
                    title: title.slice(0, 50),
                    description: description.slice(0, 400 - title.length),
                    buttons: [
                        { label: OPERATOR_LABEL, action: "operator" },
                        { label: TIP_TEXT, action: "message", messageText: TIP_TEXT },
                    ],
                    buttonLayout: "vertical",
                },
            }],
        },
    };
}

export const MSG = {
    /** 웰컴: 채널 소개 + 두 갈래 */
    welcome: () => menu(
        "피카 카카오톡 채널이에요",
        "가까운 공연·전시·축제를 날짜순으로 알려 드려요(picka.news).\n\n궁금한 것은 «운영자에게 문의»를 눌러 주세요. 운영자가 채팅으로 답해요.\n공연·전시를 알리고 싶은 단체·예술가는 «행사 알리기»를 눌러 주세요.",
    ),
    /** 채팅방 메뉴 «운영자 문의»: 상담 연결 버튼 (운영자 채팅 시간은 채널 관리자센터 채팅 설정과 같게: 매일 오전 9시~오후 6시) */
    ask: () => menu(
        "운영자에게 문의하기",
        "아래 «운영자에게 문의»를 누르면 운영자와 1:1 채팅으로 이어져요. 매일 오전 9시~오후 6시에 답하고, 그 밖 시간에 남기면 다음 채팅 시간에 답해요.\n\n공연·전시를 알리려면 «행사 알리기»를 눌러 주세요.",
    ),
    /** 제보 시간이 아닐 때 온 말·사진: 저장하지 않았음을 밝히고 두 갈래 */
    notTip: () => menu(
        "무엇을 도와드릴까요?",
        "방금 보낸 내용은 저장하거나 운영자에게 넘기지 않았어요.\n\n문의는 «운영자에게 문의»를 누른 뒤 다시 보내 주세요.\n행사를 알리려면 «행사 알리기»를 누른 뒤 사진·글을 보내 주세요.",
    ),
    consent: () => reply([
        "피카(picka.news)는 경남·부산의 공연·전시·축제를 날짜순으로 알려 드려요.\n리플렛·포스터 사진이나 일정 글을 보내 주시면 운영자가 확인한 뒤에 피카에 올립니다. 자동으로 올라가지 않아요.",
        `보내기 전에 아래 두 가지에 동의해 주세요.\n\n1. ${RIGHTS_CHECKS[0]}\n\n2. ${RIGHTS_CHECKS[1]}\n\n${PRIVACY_NOTE} 사진은 1년 동안 보관한 뒤 지웁니다. 카카오 이름·전화번호는 받지 않아요. 자세한 내용: picka.news/privacy`,
    ], [AGREE_TEXT]),
    ready: () => reply([
        "지금부터 30분 동안 보내는 사진·글을 행사 제보로 받아요.\n리플렛·포스터 사진을 이 채팅창에 그냥 보내 주세요(여러 장도 돼요). 단체 이름·행사 이름·날짜는 글로 보내 주셔도 돼요. 사진 바로 뒤 10분 안에 보낸 글은 같은 제보로 묶어요.",
    ]),
    agreed: () => reply(["동의해 주셔서 고맙습니다. 지금부터 30분 동안 보내는 리플렛·포스터 사진이나 일정 글을 행사 제보로 받아요. 이 채팅창에 보내 주세요."]),
    gotImages: (n: number, refused: number) => reply([
        `사진 ${n}장 받았어요. 운영자가 확인한 뒤에 피카에 올립니다.` +
        (refused ? `\n하루 5장까지 받아서 ${refused}장은 받지 못했어요. 내일 다시 보내 주세요.` : "") +
        "\n단체 이름이 사진에 없으면 지금 글로 보내 주세요.",
    ]),
    gotText: (attached: boolean) => reply([
        attached ? "방금 보낸 사진과 함께 받았어요. 운영자가 확인한 뒤에 피카에 올립니다." : "글로 받았어요. 운영자가 확인한 뒤에 피카에 올립니다. 리플렛·포스터 사진이 있으면 이 채팅창에 함께 보내 주세요.",
    ]),
    noImage: () => reply(["사진을 받지 못했어요. 이 채팅창에 사진을 다시 보내 주세요."]),
    limit: () => reply(["오늘은 더 받을 수 없어요(하루 5건까지). 내일 다시 보내 주세요."]),
    error: () => reply(["지금은 받지 못했어요. 잠시 뒤에 다시 보내 주세요."]),
};

export { RIGHTS_VERSION };
