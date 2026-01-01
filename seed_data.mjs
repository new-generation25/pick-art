import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByb2plY3QiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzM1NzE3MTUwLCJleHAiOjIwNTEyOTMxNTB9.9r2_YV9s9Rz-p9-U8-s9Rz-p9-U8-s9Rz-p9-U8-s9Rz';

if (!supabaseUrl || !supabaseKey) {
    console.error("Environment variables missing!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedData() {
    console.log("🌱 Seeding test data...");

    // 1. Subscribers
    const { error: subErr } = await supabase.from('subscribers').upsert([
        { email: 'test_user1@example.com', is_active: true },
        { email: 'test_user2@example.com', is_active: true },
        { email: 'admin_test@artnav.kr', is_active: true }
    ], { on_conflict: 'email' });
    if (subErr) console.error("Subscribers Error:", subErr);
    else console.log("✅ Subscribers added.");

    // 2. Whitelist (Trusted Sources)
    const { error: whiteErr } = await supabase.from('whitelist').upsert([
        { type: 'source', value: 'gcf.or.kr', name: '경남문화예술진흥원', auto_publish: true },
        { type: 'source', value: 'gyeongnam.go.kr', name: '경남도청', auto_publish: true }
    ], { on_conflict: 'value' });
    if (whiteErr) console.error("Whitelist Error:", whiteErr);
    else console.log("✅ Whitelist added.");

    // 3. Blacklist (Blocked Sources)
    const { error: blackErr } = await supabase.from('blacklist').upsert([
        { type: 'user', value: '@spam_account_1', reason: 'Spam' },
        { type: 'source', value: 'malicious-site.com', reason: 'Malicious' }
    ], { on_conflict: 'value' });
    if (blackErr) console.error("Blacklist Error:", blackErr);
    else console.log("✅ Blacklist added.");

    // 4. Keywords
    const { error: keyErr } = await supabase.from('keywords').upsert([
        { email: 'test_user1@example.com', keyword: '음악회' },
        { email: 'test_user2@example.com', keyword: '전시' }
    ], { on_conflict: 'email,keyword' });
    if (keyErr) console.error("Keywords Error:", keyErr);
    else console.log("✅ Keywords added.");

    console.log("🚀 Seeding completed!");
}

seedData();
