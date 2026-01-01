import { createClient } from '@supabase/supabase-js';

// 하드코딩된 로컬 Supabase 주소와 Service Role Key (RLS 우회용)
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdminUser() {
    console.log("🛠️ Creating Admin User...");

    const email = 'max@artnav.kr';
    const password = 'newstart21';
    const nickname = 'MAX';

    // 1. 기존 유저 확인 (생략 가능, signUp이 알아서 처리하거나 에러냄)
    // 2. 회원가입 (Admin Auth)
    let userId;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true
    });

    if (authError) {
        console.log("⚠️ Auth Note:", authError.message);
        // 이미 존재하는 경우, 로컬 환경에서 ID를 알아내기 위해 로그인 시도
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email, password
        });
        if (loginData.user) {
            userId = loginData.user.id;
            console.log("✅ Retrieved existing Admin ID:", userId);
        } else {
            console.error("❌ Failed to retrieve Admin ID:", loginError?.message);
            return;
        }
    } else {
        userId = authData.user.id;
        console.log("✅ Admin Auth Created:", userId);
    }

    // 3. 프로필 생성 (Upsert 사용)
    if (userId) {
        const { error: profileError } = await supabase.from('profiles').upsert([
            {
                id: userId,
                nickname: nickname,
                role: 'ADMIN',
                residence: 'Headquarters',
                interests: 'System Administration'
            }
        ]);

        if (profileError) {
            console.error("❌ Profile Creation Error:", profileError.message);
        } else {
            console.log("✅ Admin Profile Created/Updated!");
        }
    }
}

createAdminUser();
