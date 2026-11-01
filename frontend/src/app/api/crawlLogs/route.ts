import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { blockOnDeploy } from '@/lib/localOnly';

export async function GET() {
    const blocked = blockOnDeploy();
    if (blocked) return blocked;
    const { data, error } = await supabase
        .from('crawl_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
}
