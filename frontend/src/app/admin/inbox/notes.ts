// 대기함 글에 운영자가 남기는 코멘트(raw_posts.content.admin_notes)와, 줄을 눌러 자세히 보기를 여는 판정.
// raw_posts 는 관리자만 읽는 표다(supabase/migrations/20261101030000_security_rls.sql).

export interface AdminNote { at: string; by?: string; text: string; bucket?: string; reason?: string }

export function notesOf(c: Record<string, unknown> | undefined | null): AdminNote[] {
    const v = c?.admin_notes;
    return Array.isArray(v) ? (v as AdminNote[]).filter(n => n && typeof n.text === "string") : [];
}

/** 줄 어디를 눌러도 창이 열리게: 링크·버튼·입력칸을 누른 것은 빼고 연다 */
export function opensDetail(e: { target: EventTarget }): boolean {
    return !(e.target as HTMLElement).closest("a,button,input,label,textarea,select,summary");
}
