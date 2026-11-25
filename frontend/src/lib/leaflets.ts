/**
 * 리플렛 한 장으로 행사 등록 (specs/013). 화면·관리자 화면이 같이 쓰는 문구와 검사.
 * 운영자 11/26: 로그인 회원만, AI 읽기는 클로드 예약작업, 공식 페이지가 있으면 원본으로 잇고 «단체 제공» 표시,
 * 이미지 보관 1년, 휴대폰으로 찍은 사진은 포스터로 쓰지 않음
 */

/** 권리 확인 문구. 문구를 바꾸면 판(version)을 올린다 — 제출마다 동의한 판을 저장한다 */
export const RIGHTS_VERSION = "r1-2026-11-26";
export const RIGHTS_CHECKS = [
    "이 리플렛·포스터를 피카에 올릴 권한이 있습니다. 우리 단체가 만들었거나, 디자이너·사진가 등 권리자에게 허락을 받았습니다.",
    "피카가 이 이미지에 담긴 행사 정보(제목·날짜·장소·요금 등)를 정리해 피카 사이트와 SNS에 알리는 데 쓰는 것에 동의합니다. 리플렛·포스터 파일이면 행사 포스터로도 씁니다. 요청하시면 7일 안에 내립니다.",
] as const;
export const PRIVACY_NOTE = "개인 휴대전화 번호·계좌번호는 공개하지 않습니다. 가능하면 그런 정보가 없는 판으로 올려 주세요.";

export const IMAGE_KINDS = [
    { value: "file", label: "리플렛·포스터 파일", hint: "디자인 원본, 인쇄용 파일을 이미지로 저장한 것 — 포스터로도 씁니다" },
    { value: "photo", label: "휴대폰으로 찍은 사진", hint: "벽에 붙은 포스터, 손에 든 리플렛을 찍은 것 — 글자만 읽고 포스터로는 쓰지 않습니다" },
] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number]["value"];

export const DAILY_LIMIT = 5;
export const MAX_BYTES = 10 * 1024 * 1024;
export const SOURCE_LABEL = "단체 제공";

export type LeafletInput = {
    image_kind: ImageKind | "";
    group_name: string;
    official_url: string;
    title: string;
    date_text: string;
    venue: string;
    note: string;
    rights: boolean[];
};

/** 보내기 전 검사. 빈 배열이면 통과 */
export function checkLeaflet(f: LeafletInput, file: { size: number; type: string } | null): string[] {
    const errs: string[] = [];
    if (!file) errs.push("이미지를 골라 주세요.");
    else if (!/^image\//.test(file.type)) errs.push("이미지 파일만 올릴 수 있어요.");
    else if (file.size > 30 * 1024 * 1024) errs.push("이미지가 너무 커요(30MB 이하로 골라 주세요).");
    if (!f.image_kind) errs.push("이미지 종류를 골라 주세요.");
    if (!f.group_name.trim()) errs.push("단체 이름을 적어 주세요.");
    if (f.group_name.trim().length > 80) errs.push("단체 이름은 80자 이내로 적어 주세요.");
    if (f.official_url.trim() && !/^https?:\/\/\S+$/.test(f.official_url.trim())) errs.push("공식 안내 주소는 http로 시작하는 주소로 적어 주세요.");
    if (f.note.length > 1000) errs.push("더 알려 줄 것은 1000자 이내로 적어 주세요.");
    if (f.rights.length !== RIGHTS_CHECKS.length || f.rights.some(r => !r)) errs.push("권리 확인 두 가지에 모두 체크해 주세요.");
    return errs;
}

/** 단체가 적은 칸 → given (빈 칸은 뺀다) */
export function givenFields(f: LeafletInput): Record<string, string> {
    const out: Record<string, string> = {};
    for (const k of ["title", "date_text", "venue"] as const) {
        const v = f[k].trim().slice(0, 200);
        if (v) out[k] = v;
    }
    return out;
}

/** 행사 출처 글자: «단체 제공 · 극단 ○○» */
export function leafletSource(groupName: string): string {
    return `${SOURCE_LABEL} · ${groupName.trim()}`.slice(0, 120);
}
export const isGroupProvided = (source?: string | null) => !!source && source.startsWith(SOURCE_LABEL);
