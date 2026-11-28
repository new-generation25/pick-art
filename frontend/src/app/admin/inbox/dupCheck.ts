// 공개 승인 전에 이미 공개된 행사와 겹치는지 본다 (운영자 2026-11-28 «공개승인을 눌러도 등록 하기 전에 중복확인 절차를 넣어»).
// 기준은 정기 실행의 공개 단계(collector/dedupe.py loose·similar·words, tools/publish_verified.py)와 같다:
//   느슨한 제목(지역 꼬리표·연극/뮤지컬 접두·연도·기호 뺌)이 같거나 짧은 쪽(3글자 이상)이 긴 쪽에 들어 있거나, 낱말 묶음이 같으면 같은 행사.
//   여기에 기간이 겹치는 행사만 견준다(날짜를 모르면 아직 끝나지 않은 행사 가운데 제목으로만).
// 승인 화면에서 쓰는 «미리 보기»다. 공개 단계는 그대로 다시 확인한다.
import { supabase } from "@/lib/supabase";
import { todayKST } from "@/lib/utils";
import { sameEvent } from "@/lib/dupRules";

export type DupEvent = { id: string; title: string; event_date_start: string | null; event_date_end: string | null; venue: string | null; region: string | null };

const ISO = /^20\d\d-\d\d-\d\d$/;

/** 이 글과 같은 행사로 보이는, 이미 공개된 행사들. 읽지 못하면 오류를 던진다 */
export async function findPublishedDuplicates(title: string, start?: string, end?: string): Promise<DupEvent[]> {
    if (!title?.trim()) return [];
    let q = supabase.from("events").select("id,title,event_date_start,event_date_end,venue,region").eq("status", "PUBLISHED");
    if (ISO.test(start || "") && ISO.test(end || "")) {
        q = q.lte("event_date_start", end!).gte("event_date_end", start!);   // 기간이 겹치는 행사
    } else {
        q = q.gte("event_date_end", todayKST());                              // 날짜를 모르면 끝나지 않은 행사 가운데서
    }
    const { data, error } = await q.limit(2000);
    if (error) throw new Error(`공개된 행사를 읽지 못했습니다: ${error.message}`);
    return ((data || []) as DupEvent[]).filter(e => sameEvent(title, e.title));
}

export const dupLine = (e: DupEvent) =>
    `- ${e.title} (${e.event_date_start || "?"} ~ ${e.event_date_end || "?"}${e.venue ? ` · ${e.venue}` : ""})`;
