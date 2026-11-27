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
 * «행사 제보하기»(옛 이름 «행사 알리기», 운영자 11/27 이름 바꿈)를 누른 뒤 10분 동안 보낸 사진·글만 제보로 받는다
 * (DB kakao_senders.tip_until, 운영자 11/27 «30분 너무 길어 10분으로»).
 * 그 밖의 말은 저장하지 않고 «피카 보기»·«행사 제보하기»·«문의하기» 세 갈래를 보인다.
 * «문의하기»는 «메시지를 남기면 늦더라도 답한다»는 안내와 «메시지 남기기» 버튼(action "operator" = 채널 1:1 채팅,
 * 파트너센터 «내 채팅»으로 들어감)을 보인다(운영자 11/27 «문의하기 > 메시지를 남겨 놓으시면 추후 응답 > 내채팅 연결»).
 * 버튼 순서는 «피카 보기»가 먼저(운영자 11/27 «피카 서비스 이용자를 늘려야지»).
 */
import { RIGHTS_VERSION } from "./leaflets";

export const SKILL_KEY_HEADER = "x-pica-skill-key";
/** 동의 버튼이 보내는 말. 오픈빌더 «제보 동의» 블록의 발화와 같아야 한다 */
export const AGREE_TEXT = "동의하고 보내기";
/** 사진 받기 버튼이 보내는 말. 오픈빌더 «사진 보내기» 블록(보안 이미지 파라미터)의 발화와 같아야 한다 */
export const PHOTO_TEXT = "사진 보내기";
/** 제보 메뉴. 카드 버튼·채팅방 메뉴가 보내는 말 (운영자 11/27 «행사 알리기 말고 행사 제보하기로») */
export const TIP_TEXT = "행사 제보하기";
/** 제보 시간(분). DB kakao_intake 의 tip_until 과 같아야 한다 */
export const TIP_MINUTES = 10;
const TIP_WORDS = new Set([TIP_TEXT, "행사 알리기", "제보", "제보하기", "행사 제보", PHOTO_TEXT, "리플렛 보내기", "포스터 보내기"]);
/** 오픈빌더 제보 블록 이름(블록 이름은 옛 이름 그대로). 이 블록에서 온 요청은 발화와 상관없이 제보 시작으로 읽는다 */
export const TIP_BLOCK = "행사 알리기";
/** 문의 메뉴·버튼이 보내는 말 */
export const ASK_TEXT = "문의하기";
/** 1:1 채팅으로 넘기는 버튼 이름(스킬 응답 버튼 action "operator") */
export const OPERATOR_LABEL = "메시지 남기기";
/** «문의»·«상담» 같은 말을 받는 오픈빌더 블록 이름 */
export const ASK_BLOCK = "운영자 문의";
/** 카드의 «피카 보기» 버튼 주소(채팅방 메뉴 «피카 보기»와 같음) */
export const PICA_URL = "https://picka.news";
/** 채널 추가 주소 */
export const CHANNEL_ADD_URL = "https://pf.kakao.com/_xoxdxkvX/friend";
const ASK_WORDS = new Set([ASK_TEXT, OPERATOR_LABEL, "운영자에게 문의", ASK_BLOCK, "문의", "상담", "상담원 연결", "운영자 연결"]);
export const MAX_IMAGES = 10;
/** 카카오에서 내려받을 때 상한(PC에서 보낸 원본 PNG 7.5MB 확인). 저장 전에 긴 변 2048px JPEG 로 줄인다 */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/** 피카 회원 잇기(운영자 11/27 «연결 코드 방식»): «내 정보»에서 받은 6자리 코드를 «연결 123456»처럼 보낸다 */
const LINK_RE = /^(?:피카\s*)?(?:회원\s*)?연결(?:\s*코드)?\s*[:：]?\s*(\d{6})$/;
const LINK_HELP_WORDS = new Set(["연결", "회원 연결", "피카 연결", "연결 코드", "회원연결"]);

export type SkillAction =
    | { kind: "welcome" }
    /** bare: 숫자 6자리만 보냄(운영자 11/28 시험에서 «507627»만 보내 제보로 저장됨). 맞는 코드가 아니면 평소 글로 다룬다 */
    | { kind: "link"; code: string; bare?: boolean }
    | { kind: "linkHelp" }
    | { kind: "agree" }
    | { kind: "tip" }
    | { kind: "ask" }
    /** plugin: 보안 이미지 플러그인(«사진 보내기» 블록)으로 온 사진 — 그 블록을 부른 것 자체가 제보 뜻이다 */
    | { kind: "image"; urls: string[]; plugin?: boolean }
    | { kind: "text"; text: string };

/** isFriend: 보낸 사람이 채널을 추가했는지. 공식 문서(answer_json_format, user.properties.isFriend):
 *  «사용자가 봇과 연결된 카카오톡 채널을 추가한 경우 제공», 추가하지 않았거나 차단했으면 값이 오지 않는다.
 *  운영자 11/27 «카톡은 채널구독, 피카에서는 로그인» → 제보는 채널을 추가한 사람만 받는다 */
export type SkillRequest = { userKey: string; isFriend: boolean; action: SkillAction };

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
    const b0 = obj(body);
    const props0 = obj(obj(obj(b0.userRequest).user).properties);
    const isFriend = props0.isFriend === true || props0.isFriend === "true";
    const r = parseAction(body);
    return r && { ...r, isFriend };
}

function parseAction(body: unknown): { userKey: string; action: SkillAction } | null {
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
    const link = LINK_RE.exec(utterance.replace(/\s+/g, " "));
    if (link) return { userKey, action: { kind: "link", code: link[1] } };
    if (/^\d{6}$/.test(utterance)) return { userKey, action: { kind: "link", code: utterance, bare: true } };
    if (LINK_HELP_WORDS.has(utterance)) return { userKey, action: { kind: "linkHelp" } };
    if (TIP_WORDS.has(utterance) || blockName === TIP_BLOCK) return { userKey, action: { kind: "tip" } };
    if (ASK_WORDS.has(utterance) || blockName === ASK_BLOCK) return { userKey, action: { kind: "ask" } };
    if (/웰컴|welcome/i.test(blockName) || !utterance) return { userKey, action: { kind: "welcome" } };
    return { userKey, action: { kind: "text", text: utterance.slice(0, 1000) } };
}

// ---------- 답 ----------

type QuickReply = { label: string; action: "message"; messageText: string };
type Button =
    | { label: string; action: "message"; messageText: string }
    | { label: string; action: "webLink"; webLinkUrl: string }
    | { label: string; action: "operator" };
type TextCard = { textCard: { title?: string; description: string; buttons: Button[]; buttonLayout: "vertical" } };
type Output = { simpleText: { text: string } } | TextCard;
export type SkillResponse = { version: "2.0"; template: { outputs: Output[]; quickReplies?: QuickReply[] } };

const qr = (label: string): QuickReply => ({ label, action: "message", messageText: label });
const PICA_BTN: Button = { label: "피카 보기", action: "webLink", webLinkUrl: PICA_URL };
const TIP_BTN: Button = { label: TIP_TEXT, action: "message", messageText: TIP_TEXT };
const ASK_BTN: Button = { label: ASK_TEXT, action: "message", messageText: ASK_TEXT };

export function reply(texts: string[], quick: string[] = []): SkillResponse {
    return {
        version: "2.0",
        template: {
            outputs: texts.slice(0, 3).map(t => ({ simpleText: { text: t.slice(0, 1000) } })),
            ...(quick.length ? { quickReplies: quick.map(qr) } : {}),
        },
    };
}

/** 카드 하나 (textCard 단일형은 제목+설명 400자까지, 버튼 3개까지) */
function card(title: string, description: string, buttons: Button[]): TextCard {
    // 제목은 비워도 된다(제목·설명 중 하나만 있으면 됨). 비우면 보내지 않는다
    return { textCard: { ...(title ? { title: title.slice(0, 50) } : {}), description: description.slice(0, 400 - title.length), buttons: buttons.slice(0, 3), buttonLayout: "vertical" } };
}
const one = (c: TextCard): SkillResponse => ({ version: "2.0", template: { outputs: [c] } });
/** 세 갈래 카드: 피카 보기 · 행사 제보하기 · 문의하기 (피카 보기가 먼저 — 운영자 11/27 «피카 서비스 이용자를 늘려야지») */
const menu = (title: string, description: string) => one(card(title, description, [PICA_BTN, TIP_BTN, ASK_BTN]));

/** 제보를 받은 답: 받았다는 말과 피카 안내를 말풍선 하나로(운영자 11/28 «메시지를 2개씩 보내? 1개로 응답만 해도») */
const AFTER_TIP = "\n\n피카 회원이면 «내 정보»에서 «카카오톡 제보 연결»을 해 두세요. 보낸 제보가 내 기록에 남아요.";
const gotCard = (text: string): SkillResponse => one(card("", text + AFTER_TIP, [PICA_BTN]));

export const MSG = {
    /** 웰컴: 채널 소개 + 세 갈래 */
    welcome: () => menu(
        "피카 카카오톡 채널이에요",
        "가까운 공연·전시·축제를 날짜순으로 알려 드려요(picka.news).\n\n공연·전시를 알리고 싶은 단체·예술가는 «행사 제보하기», 운영자에게 남길 말이 있으면 «문의하기»를 눌러 주세요.",
    ),
    /** «문의하기»: 메시지를 남기면 늦더라도 답한다 + «메시지 남기기»(1:1 채팅 → 파트너센터 «내 채팅») */
    ask: () => one(card(
        "문의하기",
        "메시지를 남겨 놓으시면 운영자가 확인하고 답을 드려요. 답이 조금 늦을 수 있어요.\n아래 «메시지 남기기»를 누른 뒤 보내 주세요.",
        [{ label: OPERATOR_LABEL, action: "operator" }, PICA_BTN],
    )),
    /** 제보 시간이 아닐 때 온 말·사진: 저장하지 않았음을 밝히고 세 갈래 */
    notTip: () => menu(
        "무엇을 도와드릴까요?",
        "방금 보낸 내용은 저장하지 않았어요.\n\n행사를 알리려면 «행사 제보하기»를 누른 뒤 사진·글을 보내 주세요. 운영자에게 남길 말이 있으면 «문의하기»를 눌러 주세요.",
    ),
    /** 동의 안내: 한 줄 요지로 줄임(운영자 11/27 «동의 체크도 통합해서 줄여»). 버튼 «동의하고 보내기» 하나는 그대로 */
    consent: () => reply([
        "리플렛·포스터 사진이나 일정 글을 보내 주시면 운영자가 확인한 뒤에 피카에 올려요.\n\n«동의하고 보내기»를 누르면 보낸 정보가 사실이고, 이미지 권리를 확인했다는 뜻이에요. (사진 1년 보관 · 이름·전화번호는 받지 않음 · picka.news/privacy)",
    ], [AGREE_TEXT]),
    /** 채널을 추가하지 않은 사람: 제보를 받지 않고 채널 추가를 권한다(운영자 11/27 «카톡은 채널구독») */
    needFriend: () => one(card(
        "채널을 추가해 주세요",
        "피카 채널을 추가하면 행사 제보를 받을 수 있어요. 추가한 뒤 «행사 제보하기»를 다시 눌러 주세요.\n방금 보낸 내용은 저장하지 않았어요.",
        [{ label: "채널 추가하기", action: "webLink", webLinkUrl: CHANNEL_ADD_URL }, PICA_BTN],
    )),
    ready: () => reply([
        `지금부터 ${TIP_MINUTES}분 동안 보내는 사진·글을 행사 제보로 받아요.\n리플렛·포스터 사진을 이 채팅창에 그냥 보내 주세요(여러 장도 돼요). 단체 이름·행사 이름·날짜는 글로 보내 주셔도 돼요. 사진 바로 뒤에 보낸 글은 같은 제보로 묶어요.`,
    ]),
    agreed: () => reply([`동의해 주셔서 고맙습니다. 지금부터 ${TIP_MINUTES}분 동안 보내는 리플렛·포스터 사진이나 일정 글을 행사 제보로 받아요. 이 채팅창에 보내 주세요.`]),
    gotImages: (n: number, refused: number) => gotCard(
        `사진 ${n}장 받았어요. 운영자가 확인한 뒤에 피카에 올려요.` +
        (refused ? `\n하루 5장까지 받아서 ${refused}장은 받지 못했어요. 내일 다시 보내 주세요.` : "") +
        "\n단체 이름이 사진에 없으면 지금 글로 보내 주세요.",
    ),
    gotText: (attached: boolean) => attached
        ? reply(["방금 보낸 사진과 함께 받았어요. 운영자가 확인한 뒤에 피카에 올려요."])
        : gotCard("글로 받았어요. 운영자가 확인한 뒤에 피카에 올려요. 리플렛·포스터 사진이 있으면 이 채팅창에 함께 보내 주세요."),
    linked: () => reply(["피카 회원과 연결했어요. 이 채팅방에서 보내는 행사 제보는 회원님이 보낸 것으로 기록돼요.\n연결을 끊으려면 피카 «내 정보»(picka.news/me)에서 «연결 끊기»를 눌러 주세요."]),
    badCode: () => reply(["연결 코드가 맞지 않거나 10분이 지났어요. 피카 «내 정보»(picka.news/me)에서 새 코드를 받아 «연결 123456»처럼 보내 주세요."]),
    linkLimit: () => reply(["오늘은 연결을 더 시도할 수 없어요. 내일 다시 해 주세요."]),
    linkHelp: () => reply(["피카 회원과 연결하려면 피카 «내 정보»(picka.news/me)에서 «연결 코드 받기»를 누르고, 받은 6자리를 «연결 123456»처럼 이 채팅창에 보내 주세요."]),
    noImage: () => reply(["사진을 받지 못했어요. 이 채팅창에 사진을 다시 보내 주세요."]),
    limit: () => reply(["오늘은 더 받을 수 없어요(하루 5건까지). 내일 다시 보내 주세요."]),
    error: () => reply(["지금은 받지 못했어요. 잠시 뒤에 다시 보내 주세요."]),
};

export { RIGHTS_VERSION };
