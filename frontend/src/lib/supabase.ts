import { createClient } from '@supabase/supabase-js';
import { todayKST } from './utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getPublishedEvents(filters?: { region?: string; category?: string; search?: string; date?: string }) {
    // 끝난 행사는 빼고, 가까운 날짜부터 보여 준다
    let query = supabase
        .from('events')
        .select('*')
        .eq('status', 'PUBLISHED')
        .gte('event_date_end', todayKST());

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
