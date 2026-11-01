import { createClient } from '@supabase/supabase-js';
import { todayKST, monthsAgoKST } from './utils';
import { addDays } from './feedOrder';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getPublishedEvents(filters?: { region?: string; category?: string; search?: string; date?: string; ended?: string }) {
    // 기본은 끝나지 않은 행사만. ended=1 이면 종료 1개월 이내 행사도 맨 뒤에 붙인다.
    // 종료 1개월이 지난 행사는 공개 피드에 나오지 않는다 (3개월이 지나면 관리자 저장공간 화면에서 삭제 후보가 된다)
    const today = todayKST();
    let query = supabase
        .from('events')
        .select('*')
        .eq('status', 'PUBLISHED')
        .gte('event_date_end', filters?.ended === '1' ? monthsAgoKST(1) : today);

    if (filters?.region && filters.region !== '전체') {
        query = query.eq('region', filters.region);
    }

    if (filters?.category && filters.category !== '전체') {
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

    const { data, error } = await query.order('event_date_start', { ascending: true });

    if (error) {
        console.error('Error fetching events:', error);
        return [];
    }
    // 노출 순서(묶음·정렬·섞기)는 lib/feedOrder.ts 의 orderFeed 가 정한다
    return data;
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
