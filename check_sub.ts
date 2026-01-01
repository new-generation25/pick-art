
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use service role to bypass RLS

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSubscribers() {
    console.log("Checking subscribers...");

    // 1. Count all
    const { count, error } = await supabase
        .from('subscribers')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error("Error counting:", error);
    } else {
        console.log("Total subscribers (Service Role):", count);
    }

    // 2. Sample data
    const { data, error: fetchError } = await supabase
        .from('subscribers')
        .select('*')
        .limit(5);

    if (fetchError) {
        console.error("Error fetching sample:", fetchError);
    } else {
        console.log("Sample data:", data);
    }
}

checkSubscribers();
