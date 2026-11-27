/**
 * 오류 신고·행사 제보 (specs/007, 020). 표: public.reports
 *   오류 신고: 로그인 회원만(표에 직접 넣는다, supabase/migrations/20261126020000_reports.sql)
 *   행사 제보(「숨은 행사 찾기」): 로그인 회원이 보낸다(specs/021). 접수는 submit_tip() 함수로만(20261127140000_points.sql)
 *     피카에 실리면 100포인트가 쌓인다(DB 트리거). 커피 쿠폰은 2026-12-31 까지
 * 관리자가 확인한 뒤에만 공개 피드에 반영한다(헌장 I).
 */

export const ERROR_CATEGORIES = ["날짜·시간", "장소", "관람료", "링크", "취소·변경", "포스터", "기타"] as const;

/** 카카오톡 채널 «피카» 1:1 채팅(「행사 제보하기」 챗봇, specs/017) */
export const KAKAO_CHAT = "https://pf.kakao.com/_xoxdxkvX/chat";

/** 쿠폰 연락처 수집·이용 동의 문구와 그 판. 문구를 바꾸면 판도 바꾼다(개인정보처리방침과 같은 내용이어야 한다) */
export const REWARD_CONSENT_VERSION = "tip-reward-r1-2026-11-27";
export const REWARD_CONSENT_TEXT = "커피 쿠폰을 보내는 데만 쓰고, 보낸 뒤 지워요. 쿠폰을 받지 못한 연락처도 90일 뒤 지웁니다. 이 내용으로 연락처를 받는 데 동의해요.";

export const TIP_PHOTO_MAX = 10 * 1024 * 1024;

/** 이벤트 이름과 보상 (운영자 2026-11-27) */
export const TIP_EVENT_NAME = "숨은 행사 찾기";
export const TIP_POINTS = 100;
/** 포인트의 쓰임(운영자 문구 «활동포인트(랭킹)와 추후 공연, 전시 등에 사용가능(예정)») */
export const POINTS_NOTE = "활동 포인트예요. 랭킹에 쓰이고, 앞으로 공연·전시 등에 쓸 수 있게 할 예정이에요.";
/** 커피 쿠폰은 이 날짜(한국 날짜)까지만 안내하고 연락처를 받는다(운영자 «12월까지») */
export const COUPON_UNTIL = "2026-12-31";
export const COUPON_NOTE = "12월까지 매주 5명께 커피 쿠폰도 드려요.";
/** 쿠폰 풀이: 제보 화면의 «선택 항목» 안, 연락처 칸 위에 보인다 (specs/023 — 머리말은 한 줄로) */
export const COUPON_DETAIL = "제일 많이 알리신 두 분은 무조건 당첨이에요. 당첨은 인스타그램과 카카오톡 채널 «피카»에서 알려요.";
/** today: 한국 날짜 YYYY-MM-DD (lib/utils todayKST) */
export function couponOpen(today: string): boolean {
    return today <= COUPON_UNTIL;
}

export type TipInput = {
    title: string;
    url: string;
    date_start: string;
    date_end: string;
    venue: string;
    region: string;
    body: string;
    /** 쿠폰 받을 연락처(전화번호나 이메일). 비우면 받지 않는다 */
    contact: string;
    consent: boolean;
    /** 「제보: ○○」로 보일 이름. 비우면 어디에도 나오지 않는다 */
    credit: string;
    /** 사람 눈에 안 보이는 칸. 차 있으면 자동 프로그램이다 */
    website: string;
};

export const EMPTY_TIP: TipInput = {
    title: "", url: "", date_start: "", date_end: "", venue: "", region: "", body: "", contact: "", consent: false, credit: "", website: "",
};

/** 붙여 넣은 링크 다듬기: «instagram.com/p/…»처럼 http 없이 붙여도 받는다(https:// 를 앞에 붙인다) */
export function normalizeTipUrl(raw: string): string {
    const u = raw.trim();
    if (!u || /^https?:\/\//i.test(u)) return u;
    return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u) ? `https://${u}` : u;
}

/** 제보 입력 검사. 문제가 없으면 빈 배열 */
export function checkTip(t: TipInput, hasPhoto: boolean): string[] {
    const errs: string[] = [];
    const url = normalizeTipUrl(t.url);
    if (t.title.trim().length < 2) errs.push("행사 이름을 적어 주세요.");
    if (url && !/^https?:\/\/\S+\.\S+$/i.test(url)) errs.push("링크를 다시 확인해 주세요. 게시물이나 안내 페이지 주소를 통째로 붙여 주세요.");
    if (!url && !hasPhoto) errs.push("링크나 사진 가운데 하나는 필요해요. 확인한 행사만 올리기 위해서예요.");
    if (t.date_start && t.date_end && t.date_end < t.date_start) errs.push("끝나는 날짜가 시작보다 앞이에요.");
    const contact = t.contact.trim();
    if (contact && contact.length < 5) errs.push("연락처를 다시 확인해 주세요(전화번호나 이메일).");
    if (contact && !t.consent) errs.push("연락처를 남기려면 동의가 필요해요.");
    return errs;
}

/** submit_tip() 이 돌려준 오류를 화면 문구로 */
export function tipErrorText(message: string): string {
    if (message.includes("login_required")) return "로그인한 뒤 보낼 수 있어요. 다시 로그인해 주세요.";
    if (message.includes("duplicate")) return "오늘 이미 받은 제보예요. 고맙습니다.";
    if (message.includes("daily_limit")) return "오늘은 더 보낼 수 없어요(하루 10건). 내일 다시 알려 주세요.";
    if (message.includes("need_source")) return "링크나 사진 가운데 하나는 필요해요.";
    if (message.includes("need_consent")) return "연락처를 남기려면 동의가 필요해요.";
    if (message.includes("bad_url")) return "링크를 다시 확인해 주세요. 게시물이나 안내 페이지 주소를 통째로 붙여 주세요.";
    if (message.includes("bad_title")) return "행사 이름을 적어 주세요.";
    if (message.includes("bad_date")) return "날짜를 다시 확인해 주세요.";
    return "보내지 못했어요. 잠시 뒤 다시 해 주세요.";
}

/** 로그인 화면으로 보낸 뒤 이 자리로 돌아오는 주소 */
export function loginHref(path: string): string {
    return `/login?next=${encodeURIComponent(path)}`;
}
