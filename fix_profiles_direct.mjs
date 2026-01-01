import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixProfiles() {
    console.log('🔧 Fixing profiles table...\n');

    // SQL 쿼리들을 순차적으로 실행
    const queries = [
        'ALTER TABLE public.profiles RENAME COLUMN residence TO region',
        'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true',
        'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS new_event_notifications BOOLEAN DEFAULT true',
        'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()'
    ];

    for (const query of queries) {
        try {
            const { data, error } = await supabase.rpc('exec_sql', { sql: query });
            if (error) {
                console.log(`⚠️  ${query.substring(0, 50)}... - ${error.message}`);
            } else {
                console.log(`✅ ${query.substring(0, 50)}...`);
            }
        } catch (e) {
            console.log(`⚠️  ${query.substring(0, 50)}... - ${e.message}`);
        }
    }

    // 결과 확인
    console.log('\n📊 Checking updated table structure...');
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

    if (data && data.length > 0) {
        console.log('✅ Columns:', Object.keys(data[0]).join(', '));
    } else {
        console.log('ℹ️  No data to check, but table should be updated');
    }

    console.log('\n✅ Done! Refresh your frontend page.');
}

fixProfiles();
