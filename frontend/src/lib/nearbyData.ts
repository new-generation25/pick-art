import { supabase } from './supabase';
import { todayKST } from './utils';
import { addDays } from './feedOrder';
import { HIDDEN_CATEGORIES } from './categories';

/**
 * 내 주변 행사(specs/002-nearby-events): 오늘~2주 안에 열리는 공개 행사와, 좌표가 확인된 장소.
 * 방문자 위치는 이 요청에 들어가지 않는다(거리 계산은 브라우저에서).
 * public_venues 뷰가 아직 없으면(마이그레이션 전) 좌표 없이 돌려준다.
 */
export type NearbyRow = {
    id: string;
    title: string;
    category: string | null;
    region: string | null;
    venue: string | null;
    event_date_start: string;
    event_date_end: string;
    poster_image_url: string | null;
    is_free: boolean | null;
    poster_placeholder?: boolean | null;
    source?: string | null;
    venue_id?: string | null;
    coords: { lat: number; lng: number } | null;
};

type EventDbRow = Omit<NearbyRow, 'coords'> & { venue_id?: string | null };

export async function getNearbyRows(): Promise<NearbyRow[]> {
    const today = todayKST();
    let q = supabase
        .from('events')
        .select('*')
        .eq('status', 'PUBLISHED')
        .gte('event_date_end', today)
        .lte('event_date_start', addDays(today, 13));
    for (const c of HIDDEN_CATEGORIES) q = q.neq('category', c);
    const { data, error } = await q.order('event_date_start', { ascending: true });
    const events = data as EventDbRow[] | null;
    if (error || !events) {
        console.error('nearby events:', error);
        return [];
    }

    const ids = [...new Set(events.map((e) => e.venue_id).filter(Boolean))] as string[];
    const coords = new Map<string, { lat: number; lng: number }>();
    for (let i = 0; i < ids.length; i += 200) {
        const { data, error: vErr } = await supabase
            .from('public_venues')
            .select('id,lat,lng')
            .in('id', ids.slice(i, i + 200));
        if (vErr) {
            console.error('public_venues:', vErr.message);
            break;
        }
        for (const v of data || []) coords.set(v.id, { lat: v.lat, lng: v.lng });
    }

    return events.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        region: e.region,
        venue: e.venue,
        event_date_start: e.event_date_start,
        event_date_end: e.event_date_end,
        poster_image_url: e.poster_image_url,
        is_free: e.is_free,
        poster_placeholder: e.poster_placeholder ?? false,
        source: e.source ?? null,
        venue_id: e.venue_id ?? null,
        coords: e.venue_id ? coords.get(e.venue_id) ?? null : null,
    }));
}
