import { supabase } from "@/lib/supabase";

/**
 * 단체 메모(협약 확인·철회·해지 기록)를 관리자만 읽는 표 org_admin_notes 에 덧붙인다 (specs/019 A0).
 * orgs 는 로그인하지 않아도 읽히는 표라, 거기 있던 partner_note 칸은 쓰지 않는다.
 * 돌려주는 값: 실패하면 오류 글, 성공하면 null
 */
export async function appendOrgNote(orgId: string, add: string): Promise<string | null> {
    const { data, error: readErr } = await supabase.from("org_admin_notes").select("note").eq("org_id", orgId).maybeSingle();
    if (readErr) return readErr.message;
    const note = [data?.note, add].filter(Boolean).join(" / ").slice(-2000);
    const { error } = await supabase.from("org_admin_notes").upsert({ org_id: orgId, note, updated_at: new Date().toISOString() });
    return error ? error.message : null;
}
