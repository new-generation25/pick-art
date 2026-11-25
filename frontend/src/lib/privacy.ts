/**
 * 개인 연락처 가리기 (운영자 2026-11-26: «개인 휴대전화는 우리 사이트에서는 노출되지 않게 하고, 해당 출처로 이동해서 확인하도록»)
 * 수집한 행사 설명에 담당자 휴대전화(010·011·016·017·018·019, +82)가 들어 있는 경우가 있다.
 * 피카 화면·공유 미리보기·캘린더에는 보이지 않게 바꾸고, 원본 안내에서 확인하도록 적는다. DB 원문은 그대로 둔다.
 * 기관 대표 유선번호(055-…, 051-…, 1588-… 등)는 그대로 둔다.
 */
const MOBILE = /(?:\+?82[\s.\-]*0?|(?<!\d)0)1[016789][\s.\-)]*\d{3,4}[\s.\-]*\d{4}(?!\d)/g;

export const MASK_TEXT = "(개인 연락처는 원본 안내에서 확인)";

export function hasPersonalPhone(text?: string | null): boolean {
    return !!text && new RegExp(MOBILE.source).test(text);
}

export function maskPersonalPhones(text: string): string;
export function maskPersonalPhones(text: string | null | undefined): string | null | undefined;
export function maskPersonalPhones(text: string | null | undefined) {
    if (!text) return text;
    return text.replace(MOBILE, MASK_TEXT);
}
