import pg from 'pg';
const { Client } = pg;

async function addDetailedLogColumn() {
    const client = new Client({
        connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
    });

    try {
        await client.connect();
        console.log('Connected to local Supabase database');

        const result = await client.query(`
            ALTER TABLE crawl_logs ADD COLUMN IF NOT EXISTS detailed_log TEXT;
        `);
        console.log('✅ detailed_log column added successfully');

        // 컬럼 확인
        const checkResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'crawl_logs' AND column_name = 'detailed_log';
        `);
        console.log('Column info:', checkResult.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

addDetailedLogColumn();
