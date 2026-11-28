/**
 * 정식 협약(정보 제공 동의) 신청 (specs/016). 표: public.partner_agreements
 * (supabase/migrations/20261127040000_partner_agreements.sql)
 *
 * 동의서 문구는 이 파일에만 둔다. 원본: docs/partner/동의서_초안.md (초안 · 법률 검토 전).
 * 법률 검토 뒤 문구를 고치면 TERMS_VERSION 을 올리고 IS_DRAFT 를 false 로 바꾼다.
 * 신청마다 그때의 TERMS_VERSION 이 함께 저장되어, 어느 문구에 동의했는지 남는다.
 * (원본 초안의 사이트 주소 pick-art.vercel.app 은 지금 주소 picka.news 로 적었다)
 */

// 2026-11-27: 동의서 글은 그대로, 받는 방법이 바뀌었다(필수 체크 4개 → «전체 동의» 하나, 로그인 필수 — specs/023)
// 2026-11-28: 개인/단체 구분을 받고, 단체에는 «단체를 대표해 동의할 수 있어요» 한 줄을 더했다
export const TERMS_VERSION = "2026-11-28-draft";
export const IS_DRAFT = true;
export const CONTACT_EMAIL = "pick.art.pica@gmail.com";

export type TermsSection = { title: string; items: { strong?: string; text: string }[] };

/** 1~5 절. 화면에 그대로 보인다 */
export const TERMS_SECTIONS: TermsSection[] = [
    {
        title: "1. 무엇에 동의하나요",
        items: [
            { strong: "정보 게재", text: "단체의 공연·전시·행사 정보(제목, 날짜·시간, 장소, 요금, 예매 방법과 링크, 출연진, 소개 글)를 피카 사이트(picka.news)와 피카 인스타그램 @picka.news에 싣는 것." },
            { strong: "자동 수집", text: "단체의 공식 누리집·SNS에 공개된 행사 공지를 피카가 자동으로 모아 싣는 것. 단체가 따로 보내지 않아도 됩니다." },
            { strong: "이미지 사용", text: "단체가 보내거나 공개한 포스터·사진을 위 1의 범위에서 쓰는 것. 동의하지 않으면 글 정보만 싣습니다." },
        ],
    },
    {
        title: "2. 피카가 약속하는 것",
        items: [
            { strong: "공연 정보는 단체의 것이며, 요청하시면 7일 안에 삭제합니다.", text: "" },
            { strong: "공개 정보를 바탕으로 한 비식별 통계는 피카가 공공에 제공할 수 있습니다.", text: "(예: 지역·장르별 행사 수. 단체 이름이 드러나는 개별 정보는 팔지 않습니다.)" },
            { text: "게재와 정정은 무료입니다. 돈을 낸 단체를 위에 올리지 않고, 목록은 날짜·지역 규칙으로만 정렬합니다." },
            { text: "확인한 정보만 싣습니다. 날짜가 없거나 원본 링크가 열리지 않으면 단체에 먼저 묻습니다." },
            { text: "담당자 연락처는 연락에만 쓰고 공개하지 않습니다." },
        ],
    },
    {
        title: "3. 단체가 확인해 주실 것",
        items: [
            { text: "보낸 정보가 사실과 다르지 않습니다. 바뀌면 알려 주세요." },
            { text: "포스터·사진에 사진가·디자이너 등 다른 권리자가 있으면, 그 권리자에게 피카 게재를 허락받았습니다." },
            { text: "관객·출연자의 개인 연락처는 보내지 않습니다." },
        ],
    },
    {
        title: "4. 기간과 철회",
        items: [
            { text: "신청을 피카가 확인한 날부터 1년이며, 어느 쪽도 그만두겠다고 하지 않으면 1년씩 이어집니다." },
            { text: `단체는 언제든 이 페이지의 «철회 요청» 또는 메일(${CONTACT_EMAIL})로 철회할 수 있습니다. 피카는 7일 안에 단체 정보를 내립니다. 이미 공개된 비식별 통계에서는 단체 이름이 드러나지 않게 합니다.` },
        ],
    },
];

/** 동의 칸 위에 보이는 요약(체크 항목과 짝). 전문은 접어 둔 TERMS_SECTIONS */
export const CONSENT_SUMMARY = {
    listing: { title: "게재", text: "공연·전시 정보(제목·날짜·장소·요금·예매 링크·출연·소개)를 피카 사이트 picka.news와 인스타그램 @picka.news에 실어요." },
    collect: { title: "자동 수집", text: "공식 SNS·누리집에 올린 공지를 피카가 찾아 확인한 뒤 실어요. 따로 보내지 않아도 돼요." },
    image: { title: "이미지", text: "포스터·사진을 위 범위에서만 써요. 원하지 않으면 글 정보만 실어요." },
    confirm: "보낸 정보가 사실이고, 포스터·사진에 다른 권리자(사진가·디자이너)가 있으면 허락을 받았어요. 관객·출연자 개인 연락처는 보내지 않아요.",
} as const;

/**
 * «전체 동의» 체크 하나 아래에 한 줄씩 보이는 항목 (specs/023, 운영자 2026-11-27 «동의 체크도 통합해서 줄여»).
 * 체크하면 네 값(agree_listing·agree_collect·agree_confirm·agree_privacy)이 모두 동의로 저장된다.
 * 담당 연락처(개인정보)는 다른 동의와 구분해 알려야 해서 화면에서 따로 보인다(CONSENT_PRIVACY + PRIVACY_NOTICE).
 */
// 운영자 2026-11-28 «동의 부분을 축약 통합해 너무 많고 복잡해»: 항목마다 한 줄. 긴 풀이(CONSENT_SUMMARY·PRIVACY_NOTICE·전문)는 «자세히 보기» 안에 둔다
export const CONSENT_ITEMS = [
    { title: "게재", text: "공연·전시 정보를 피카 사이트와 인스타그램에 실어요." },
    { title: "자동 수집", text: "공식 SNS·누리집 공지를 피카가 찾아 확인한 뒤 실어요." },
    { title: "확인", text: "보낸 정보는 사실이고, 포스터·사진의 권리를 확인했어요." },
] as const;
export const CONSENT_PRIVACY = { title: "연락처(개인정보)", text: "담당 연락처는 협약 확인과 연락에만 쓰고, 협약이 끝난 뒤 1년 지나면 지워요." } as const;
export const CONSENT_KEYS = ["agree_listing", "agree_collect", "agree_confirm", "agree_privacy"] as const;
/** 단체로 신청할 때만 목록에 더 보이는 줄: 단체 이름으로 동의하는 것이라 그럴 권한이 있는지 확인한다 */
export const CONSENT_ORG_AUTH = { title: "권한", text: "단체를 대표해 동의할 수 있어요." } as const;

/**
 * 누가 신청하나 (운영자 2026-11-28 «파트너 협약할때 단체인지 개인인지 구분» → «넣어»).
 * person = 개인(작가·연주자), org = 단체·공간. 운영자가 «협약 확인»으로 새 줄을 만들 때 orgs.kind 가 «개인»/«단체»로 갈린다
 */
export const APPLICANT_TYPES = [
    { value: "person", label: "개인", hint: "작가·연주자" },
    { value: "org", label: "단체·공간", hint: "극단·갤러리·공연장" },
] as const;
export type ApplicantType = (typeof APPLICANT_TYPES)[number]["value"];
export const APPLICANT_LABEL: Record<string, string> = { person: "개인", org: "단체·공간" };

/** 제출 뒤 안내 */
export const AFTER_SUBMIT = [
    "운영자가 공식 SNS·누리집으로 단체를 확인해요. 일주일 안에 적어 주신 연락처로 결과를 알려 드려요.",
    "확인되면 단체 페이지에 «협약» 표시가 붙고, 그 뒤 공지는 따로 묻지 않고 실어요.",
    "그만두고 싶으면 «내가 보낸 신청»의 «철회 요청»이나 메일 한 통이면 돼요. 7일 안에 내려요.",
];

/** 5 선택 항목(둘 다 준비 중) */
export const EXTRAS = [
    { key: "monthly_report", label: "월간 노출·클릭 정리 메일 (준비 중)" },
    { key: "grant_alerts", label: "단체 조건에 맞을 수 있는 지원사업 공고 알림 — 마감 2주 전, 참고용 (준비 중)" },
] as const;

/** 담당자 연락처 수집·이용 안내(필수 동의). 개인정보처리방침(/privacy)과 같은 내용 */
export const PRIVACY_NOTICE =
    "수집 항목: 담당자 연락처(전화 또는 메일), 적었다면 대표자 이름. 목적: 협약 확인과 게재 관련 연락. " +
    "보유 기간: 협약이 끝나거나 철회한 날부터 1년. 동의하지 않을 수 있지만, 그러면 협약을 맺을 수 없습니다.";

export type AgreementInput = {
    applicant_type: ApplicantType | "";
    org_name: string;
    representative: string;
    reg_no: string;
    official_url: string;
    insta_handle: string;
    region: string;
    contact_private: string;
    contact_public: string;
    agree_listing: boolean;
    agree_collect: boolean;
    image_use: "" | "yes" | "no";
    agree_confirm: boolean;
    agree_privacy: boolean;
    monthly_report: boolean;
    grant_alerts: boolean;
    grant_profile: string;
};

export const EMPTY_AGREEMENT: AgreementInput = {
    applicant_type: "", org_name: "", representative: "", reg_no: "", official_url: "", insta_handle: "", region: "",
    contact_private: "", contact_public: "", agree_listing: false, agree_collect: false, image_use: "",
    agree_confirm: false, agree_privacy: false, monthly_report: false, grant_alerts: false, grant_profile: "",
};

/** «@Foo.Bar», «instagram.com/foo.bar/» → «foo.bar». 형식이 아니면 null */
export function normInsta(v: string): string | null {
    let s = (v || "").trim();
    if (!s) return null;
    const m = s.match(/instagram\.com\/@?([A-Za-z0-9._]+)/i);   // «instagram.com/@계정» 도 받는다
    if (m) s = m[1];
    s = s.replace(/^@/, "").toLowerCase();
    return /^[a-z0-9._]{1,30}$/.test(s) ? s : null;
}

/** 입력 검사. 문제가 없으면 빈 배열 */
export function checkAgreement(a: AgreementInput): string[] {
    const errs: string[] = [];
    if (!a.applicant_type) errs.push("② 개인인지 단체·공간인지 골라 주세요.");
    if (!a.org_name.trim()) errs.push(a.applicant_type === "person" ? "활동 이름을 적어 주세요." : "단체·활동 이름을 적어 주세요.");
    if (!/^https?:\/\/\S+\.\S+/.test(a.official_url.trim())) errs.push("공식 SNS·누리집 주소(https로 시작)를 넣어 주세요.");
    if (a.insta_handle.trim() && !normInsta(a.insta_handle)) errs.push("인스타그램 계정은 @계정 또는 instagram.com/계정 모양으로 적어 주세요.");
    if (a.contact_private.trim().length < 3) errs.push("담당 연락처(전화 또는 메일)를 적어 주세요.");
    if (CONSENT_KEYS.some(k => !a[k])) errs.push("① «전체 동의»에 체크해 주셔야 실을 수 있어요.");
    if (!a.image_use) errs.push("① 이미지를 써도 되는지 골라 주세요.");
    return errs;
}

/** DB 에 넣을 줄 */
export function toRow(a: AgreementInput) {
    const opt = (s: string) => (s.trim() ? s.trim() : null);
    const person = a.applicant_type === "person";
    return {
        applicant_type: a.applicant_type,
        org_name: a.org_name.trim(),
        representative: person ? null : opt(a.representative),   // 개인에게는 묻지 않는 칸
        reg_no: person ? null : opt(a.reg_no),
        official_url: a.official_url.trim(),
        insta_handle: normInsta(a.insta_handle),
        region: opt(a.region),
        contact_private: a.contact_private.trim(),
        contact_public: opt(a.contact_public),
        agree_listing: a.agree_listing,
        agree_collect: a.agree_collect,
        image_use: a.image_use,
        agree_confirm: a.agree_confirm,
        agree_privacy: a.agree_privacy,
        extras: {
            monthly_report: a.monthly_report,
            grant_alerts: a.grant_alerts,
            ...(a.grant_alerts && a.grant_profile.trim() ? { grant_profile: a.grant_profile.trim().slice(0, 500) } : {}),
        },
        terms_version: TERMS_VERSION,
    };
}

export const STATUS_LABEL: Record<string, string> = {
    new: "검토 대기",
    confirmed: "협약 확인",
    rejected: "반려",
    withdrawn: "철회",
};

/** 단체 이름 맞추기용 글자 (collector/tools/link_orgs.py norm_name 과 같은 규칙) */
export function orgNormName(name: string): string {
    const s = (name || "").replace(/\((재|사|주|유|합|사단|재단)\)|㈜|㈔|재단법인|사단법인|주식회사|유한회사/g, "");
    return s.replace(/[^0-9A-Za-z가-힣]/g, "").toLowerCase();
}
