import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createConfigsTable() {
    console.log('🔧 Creating configs table...');

    // Create table using raw SQL
    const { data: createData, error: createError } = await supabase.rpc('exec_sql', {
        sql: `
            CREATE TABLE IF NOT EXISTS public.configs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                description TEXT,
                updated_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `
    });

    if (createError) {
        console.error('❌ Table creation error:', createError.message);
        console.log('\n📝 Trying alternative approach...');

        // Alternative: Use direct query
        const { error: altError } = await supabase
            .from('configs')
            .select('*')
            .limit(1);

        if (altError && altError.code === 'PGRST116') {
            console.log('✅ Table does not exist, will create via migration');
            console.log('\nPlease run this SQL in Supabase Studio:');
            console.log(`
CREATE TABLE IF NOT EXISTS public.configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);
            `);
        }
    } else {
        console.log('✅ Configs table created!');
    }
}

createConfigsTable();
