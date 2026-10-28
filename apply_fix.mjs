import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

async function applyFix() {
    const client = new Client({
        connectionString: "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    });

    try {
        console.log('🔄 Connecting to local Supabase Postgres...');
        await client.connect();

        const sql = fs.readFileSync('fix_schema_columns.sql', 'utf8');
        console.log('📜 Executing SQL fix...');
        await client.query(sql);

        console.log('✅ SQL fix applied successfully!');
    } catch (err) {
        console.error('❌ Error applying fix:', err.message);
        if (err.message.includes('ECONNREFUSED')) {
            console.log('💡 Tip: Make sure Supabase is running (npx supabase start)');
        }
    } finally {
        await client.end();
    }
}

applyFix();
