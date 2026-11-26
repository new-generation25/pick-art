import { createClient } from '@supabase/supabase-js';
import { todayKST, monthsAgoKST } from './utils';
import { addDays } from './feedOrder';
import { HIDDEN_CATEGORIES } from './categories';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getPublishedEvents(filters?: { region?: string; regions?: string[]; category?: string; categories?: string[]; search?: string; date?: string; ended?: string }) {
    // 기본은 끝나지 않은 행사만. ended=1 이면 종료 1개월 이내 행사도 맨 뒤에 붙인다.
    // 종료 1개월이 지난 행사는 공개 피드에 나오지 않는다 (3개월이 지나면 관리자 저장공간 화면에서 삭제 후보가 된다)
    const today = todayKST();
    let query = supabase
        .from('events')
        .select('*')
        .eq('status', 'PUBLISHED')
        .gte('event_date_end', filters?.ended === '1' ? monthsAgoKST(1) : today);

    // 숨김 분야(예: 관광)는 공개 피드에 내보내지 않는다
    for (const c of HIDDEN_CATEGORIES) {
        query = query.neq('category', c);
    }

    // 필터 창에서 여러 개 고르면 regions·categories 목록으로 온다 (2026-11-26)
    if (filters?.regions?.length) {
        query = query.in('region', filters.regions);
    } else if (filters?.region && filters.region !== '전체') {
        query = query.eq('region', filters.region);
    }

    if (filters?.categories?.length) {
        query = query.in('category', filters.categories);
    } else if (filters?.category && filters.category !== '전체') {
        query = query.eq('category', filters.category);
    }

    if (filters?.search) {
        query = query.ilike('title', `%${filters.search}%`);
    }

    // 기간 필터: 한국 날짜 기준. 예전에는 toISOString(UTC)이라 자정~오전 9시에 '오늘'이 어제로 잡혔다.
    // [오늘, 마지막 날] 안에 하루라도 걸치는 행사(끝나는 날 ≥ 오늘, 시작일 ≤ 마지막 날)
    if (filters?.date) {
        const last = filters.date === 'today' ? today
            : filters.date === 'week' ? addDays(today, 7)
            : filters.date === 'month' ? addDays(today, 30)
            : null;
        if (last) {
            query = query.gte('event_date_end', today).lte('event_date_start', last);
        }
    }

    // 한 번에 1,000줄까지만 오므로 나눠 읽는다(공개 행사가 1,000건을 넘으면 뒤가 빠지던 문제). 같은 정렬에 id 를 더해 쪽이 겹치지 않게 한다
    const ordered = query.order('event_date_start', { ascending: true }).order('id', { ascending: true });
    const rows: any[] = [];
    for (let from = 0; from < 20000; from += 1000) {
        const { data, error } = await ordered.range(from, from + 999);
        if (error) {
            console.error('Error fetching events:', error);
            return rows.length ? rows : [];
        }
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
    }
    // 노출 순서(묶음·정렬·섞기)는 lib/feedOrder.ts 의 orderFeed 가 정한다
    return rows;
}

/** 상세에 보일 장소 정보 (specs/009). 공개 뷰라 좌표가 확인된 장소만 나온다 */
export async function getVenueInfo(venueId: string | null | undefined): Promise<{ closed_days: string | null; capacity: number | null; lat: number | null; lng: number | null; name: string | null } | null> {
    if (!venueId) return null;
    const { data, error } = await supabase.from('public_venues').select('closed_days,capacity,lat,lng,name').eq('id', venueId).maybeSingle();
    if (error) {
        console.error('Error fetching venue info:', error.message);
        return null;
    }
    return data;
}

/** 부산 구·군에 있는 장소 id (specs/010, venues.district). 좌표가 확인된 공개 장소만 */
export async function getDistrictVenueIds(district: string): Promise<Set<string>> {
    const { data, error } = await supabase.from('public_venues').select('id').eq('district', district);
    if (error) {
        console.error('Error fetching district venues:', error.message);
        return new Set();
    }
    return new Set((data ?? []).map((v: { id: string }) => v.id));
}

export async function getEventById(id: string) {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching event detail:', error);
        return null;
    }
    return data;
}
