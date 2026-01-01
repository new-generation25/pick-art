import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
    host: '127.0.0.1',
    port: 54322,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres'
});

async function fixProfiles() {
    try {
        console.log('🔧 Connecting to database...\n');
        await client.connect();

        const queries = [
            'ALTER TABLE public.profiles RENAME COLUMN residence TO region',
            'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true',
            'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS new_event_notifications BOOLEAN DEFAULT true',
            'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()'
        ];

        for (const query of queries) {
            try {
                await client.query(query);
                console.log(`✅ ${query.substring(0, 60)}...`);
            } catch (error) {
                console.log(`⚠️  ${query.substring(0, 60)}... - ${error.message}`);
            }
        }

        // Check final structure
        console.log('\n📊 Checking updated table structure...');
        const result = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'profiles' AND table_schema = 'public'
            ORDER BY ordinal_position
        `);

        console.log('\n✅ Current columns:');
        result.rows.forEach(row => {
            console.log(`   - ${row.column_name} (${row.data_type})`);
        });

        console.log('\n✅ Done! Refresh your frontend page.');
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

fixProfiles();
