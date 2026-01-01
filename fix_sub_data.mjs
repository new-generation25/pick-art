
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByb2plY3QiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzM1NzE3MTUwLCJleHAiOjIwNTEyOTMxNTB9.9r2_YV9s9Rz-p9-U8-s9Rz-p9-U8-s9Rz-p9-U8-s9Rz';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAndCheck() {
    console.log("🔍 Checking subscribers table...");

    // 1. Count existing
    const { count, error } = await supabase
        .from('subscribers')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error("Error counting:", error);
        // Maybe table doesn't exist?
        return;
    }

    console.log(`Found ${count} subscribers (Service Role view).`);

    // 2. If 0, seed some
    if (count === 0) {
        console.log("EMPTY! Seeding 20 dummy subscribers...");
        const dummies = Array.from({ length: 20 }).map((_, i) => ({
            email: `subscriber_${i + 1}@example.com`,
            is_active: i % 5 !== 0, // Some inactive
            subscribed_at: new Date(Date.now() - Math.random() * 10000000000).toISOString()
        }));

        const { error: seedError } = await supabase.from('subscribers').insert(dummies);
        if (seedError) console.error("Seed error:", seedError);
        else console.log("✅ Seeded 20 subscribers.");
    }

    // 3. Check RLS?
    // We can't check RLS status via JS client easily.
    // But we will generate a SQL file for the user to run if needed.
}

fixAndCheck();
