import { createClient } from '@supabase/supabase-js';
import { todayKST, monthsAgoKST } from './utils';

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

    // Date filtering
    if (filters?.date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let startDate: Date | null = null;
        let endDate: Date | null = null;

        if (filters.date === 'today') {
            startDate = new Date(today);
            endDate = new Date(today);
            endDate.setDate(endDate.getDate() + 1);
        } else if (filters.date === 'week') {
            startDate = new Date(today);
            endDate = new Date(today);
            endDate.setDate(endDate.getDate() + 7);
        } else if (filters.date === 'month') {
            startDate = new Date(today);
            endDate = new Date(today);
            endDate.setMonth(endDate.getMonth() + 1);
        }

        if (startDate && endDate) {
            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];

            // Filter events where event_date_start or event_date_end is within the range
            query = query.or(`event_date_start.gte.${startDateStr},event_date_end.gte.${startDateStr}`)
                         .lte('event_date_start', endDateStr);
        }
    }

    const { data, error } = await query
        .order('event_date_start', { ascending: true })
        .order('event_date_end', { ascending: true });

    if (error) {
        console.error('Error fetching events:', error);
        return [];
    }
    // 진행 중·예정 행사를 먼저(시작일순), 끝난 행사는 뒤에(최근에 끝난 순)
    const ongoing = data.filter(e => e.event_date_end >= today);
    const ended = data.filter(e => e.event_date_end < today)
        .sort((a, b) => (b.event_date_end || '').localeCompare(a.event_date_end || ''));
    return [...ongoing, ...ended];
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
